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

db.init_db()
db.seed_sources()

app = FastAPI(title="EXILE HUB API", version="0.1")


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
def admin_delete(item_id: str):
    db.delete_item(item_id)
    return {"ok": True}


@app.post("/api/admin/add")
def admin_add(payload: dict = Body(...)):
    return {"ok": True, "id": db.add_manual_item(payload)}


@app.post("/api/admin/publish")
def admin_publish():
    """Regenerate the static snapshot the public site reads (web/data/feed.json)."""
    n = db.export_feed(ROOT / "web" / "data" / "feed.json", limit=80)
    return {"ok": True, "items": n}


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


@app.get("/admin")
def admin_page():
    return FileResponse(str(ROOT / "web" / "admin.html"))


# static site LAST so /api/* and /admin win; html=True serves index.html at "/"
app.mount("/", StaticFiles(directory=str(ROOT / "web"), html=True), name="site")
