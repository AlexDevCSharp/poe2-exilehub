"""
EXILE HUB backend — FastAPI.

Serves the JSON API from the local SQLite DB AND the static site (web/) at the same origin,
so the frontend just fetches /api/feed. Run:

    .venv/Scripts/python -m uvicorn backend.app:app --port 8000 --reload
"""
from __future__ import annotations
import os, subprocess, sys
from pathlib import Path

from fastapi import FastAPI, HTTPException, Body
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

ROOT = Path(__file__).resolve().parent.parent


def _load_env(path: Path):
    """Minimal .env loader (no dependency). Existing env vars win."""
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


_load_env(ROOT / ".env")
sys.path.insert(0, str(ROOT / "pipeline"))
import db  # noqa: E402
import telegram as tg  # noqa: E402
import search  # noqa: E402
import run as prun  # noqa: E402  (reuse analyze/get_transcript for search "add")

db.init_db()
db.seed_sources()

app = FastAPI(title="EXILE HUB API", version="0.1")


@app.middleware("http")
async def _no_cache(request, call_next):
    """Local dev: always serve fresh assets (no browser caching of app.js/css/json)."""
    resp = await call_next(request)
    resp.headers["Cache-Control"] = "no-store"
    return resp


@app.get("/api/meta")
def api_meta():
    return db.get_meta_dict()


@app.get("/api/feed")
def api_feed(type: str = "all", lang: str = "all", limit: int = 60):
    m = db.get_meta_dict()
    return {
        "items": db.get_feed(kind=type, lang=lang, limit=limit),
        "league": m["league"],
        "generated_at": m["last_updated"],
        "counts": m["counts"],
    }


@app.get("/api/item/{item_id:path}")
def api_item(item_id: str):
    item = db.get_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="item not found")
    return item


@app.post("/api/refresh")
def api_refresh():
    """Local-only convenience: trigger a pipeline run and return its log tail."""
    proc = subprocess.run([sys.executable, str(ROOT / "pipeline" / "run.py")],
                          capture_output=True, text=True)
    return {"ok": proc.returncode == 0, "log": (proc.stderr or "")[-2000:]}


# ----------------------------- ADMIN (editorial) -----------------------------

@app.get("/api/admin/items")
def admin_items(status: str = "all"):
    return {"items": db.get_admin_items(status=status), "counts": db.admin_counts(),
            "meta": db.get_meta_dict()}


@app.post("/api/admin/item/{item_id:path}")
def admin_update(item_id: str, payload: dict = Body(...)):
    """Update editorial fields and/or the digest. Body: {status?, pinned?, title?, ..., digest?{...}}."""
    if "digest" in payload and payload["digest"] is not None:
        db.update_digest_fields(item_id, payload["digest"])
    fields = {k: v for k, v in payload.items() if k != "digest"}
    if fields:
        if not db.set_item_fields(item_id, fields):
            raise HTTPException(status_code=404, detail="item not found")
    return {"ok": True, "item": db.get_item(item_id)}


@app.delete("/api/admin/item/{item_id:path}")
def admin_delete(item_id: str, hard: bool = False):
    (db.hard_delete_item if hard else db.delete_item)(item_id)   # soft by default
    return {"ok": True, "hard": hard}


@app.post("/api/admin/add")
def admin_add(payload: dict = Body(...)):
    return {"ok": True, "id": db.add_manual_item(payload)}


@app.post("/api/admin/publish")
def admin_publish():
    """Regenerate ALL static snapshots the public site reads."""
    data = ROOT / "web" / "data"
    n = db.export_feed(data / "feed.json", limit=80)
    a = db.export_articles(data / "articles.json")
    c = db.export_creators(data / "creators.json")
    return {"ok": True, "items": n, "articles": a, "creators": c}


# ----------------------------- TELEGRAM -----------------------------

@app.get("/api/telegram/status")
def tg_status():
    return {"configured": tg.configured()}


@app.post("/api/telegram/preview")
def tg_preview(payload: dict = Body(...)):
    item = db.get_item(payload["item_id"]) if payload.get("item_id") else None
    text = payload.get("text") or (tg.format_post(item) if item else "")
    return {"text": text, "configured": tg.configured()}


@app.post("/api/telegram/send")
def tg_send(payload: dict = Body(...)):
    item = db.get_item(payload["item_id"]) if payload.get("item_id") else None
    text = payload.get("text") or (tg.format_post(item) if item else "")
    if not text.strip():
        raise HTTPException(status_code=400, detail="empty post")
    res = tg.send(text, item=item, dry_run=payload.get("dry_run"))
    if res.get("ok") and not res.get("dry_run") and payload.get("item_id"):
        db.mark_tg_posted(payload["item_id"], True)
    return res


# ----------------------------- SEARCH (admin discovery tool) -----------------------------

@app.post("/api/admin/search")
def admin_search(payload: dict = Body(...)):
    try:
        results = search.search_videos(
            query=payload.get("query", ""), author=payload.get("author", ""),
            period=payload.get("period", "any"), date_from=payload.get("date_from", ""),
            date_to=payload.get("date_to", ""), min_views=payload.get("min_views") or 0,
            sort=payload.get("sort", "relevance"), lang=payload.get("lang", ""),
            only_poe2=payload.get("only_poe2", True), limit=payload.get("limit", 15))
        known = db.known_status([r.get("video_id") for r in results])
        for r in results:                       # annotate for dedup: already in DB / analyzed
            k = known.get(r["id"], {})
            r["known"], r["analyzed"] = k.get("known", False), k.get("analyzed", False)
        return {"ok": True, "count": len(results), "results": results}
    except Exception as e:
        return {"ok": False, "error": str(e), "results": []}


@app.post("/api/admin/search/add")
def admin_search_add(payload: dict = Body(...)):
    """Add selected search results to the queue; skip re-analysis of already-analyzed videos."""
    added, digested = 0, 0
    for it in payload.get("items", []):
        it = dict(it); it["kind"] = "video"; it["found_via"] = "search"
        db.upsert_item(it)
        added += 1
        if it.get("analyzed"):                  # already analyzed earlier — don't redo
            continue
        if payload.get("analyze", True) and it.get("video_id"):
            try:
                if prun.analyze(it):
                    digested += 1
            except Exception:
                pass
    return {"ok": True, "added": added, "digested": digested}


# ----------------------------- CREATORS (data backbone) -----------------------------

@app.get("/api/admin/creators")
def admin_creators(status: str = "all"):
    return {"creators": db.list_creators(status=status)}


@app.post("/api/admin/creator/{creator_id}")
def admin_creator_update(creator_id: int, payload: dict = Body(...)):
    if not db.update_creator(creator_id, payload):
        raise HTTPException(status_code=404, detail="creator not found")
    return {"ok": True}


@app.post("/api/admin/creators/backfill")
def admin_creators_backfill():
    return {"ok": True, "linked": db.backfill_creators()}


# ----------------------------- ARTICLES -----------------------------

@app.get("/api/admin/articles")
def admin_articles(status: str = "all"):
    return {"articles": db.list_articles(status=status), "counts": db.article_counts()}


@app.get("/api/admin/article/{article_id}")
def admin_article_get(article_id: int):
    a = db.get_article(article_id)
    if not a:
        raise HTTPException(status_code=404, detail="article not found")
    return a


@app.post("/api/admin/articles")
def admin_article_create(payload: dict = Body(...)):
    return {"ok": True, "id": db.create_article(payload)}


@app.post("/api/admin/article/{article_id}")
def admin_article_update(article_id: int, payload: dict = Body(...)):
    if not db.update_article(article_id, payload):
        raise HTTPException(status_code=404, detail="article not found")
    return {"ok": True}


@app.delete("/api/admin/article/{article_id}")
def admin_article_delete(article_id: int):
    db.delete_article(article_id)
    return {"ok": True}


@app.post("/api/admin/articles/publish")
def admin_articles_publish():
    n = db.export_articles(ROOT / "web" / "data" / "articles.json")
    return {"ok": True, "published": n}


@app.post("/api/admin/backup")
def admin_backup():
    return {"ok": True, "file": db.backup_db()}


@app.get("/admin")
def admin_page():
    return FileResponse(str(ROOT / "web" / "admin.html"))


# static site LAST so /api/* and /admin win; html=True serves index.html at "/"
app.mount("/", StaticFiles(directory=str(ROOT / "web"), html=True), name="site")
