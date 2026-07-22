"""
Data layer for EXILE HUB — SQLModel + SQLite (local file, portable to Postgres later).

Tables: items, digests, transcripts, sources, runs, meta.
Also exposes query helpers (get_feed / get_item / get_meta_dict) used by BOTH the
pipeline and the FastAPI backend, so the API and the exporter return the same shape.
"""
from __future__ import annotations
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from sqlmodel import SQLModel, Field, create_engine, Session, select

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "exilehub.db"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

# SQLite local file. check_same_thread=False so FastAPI (threaded) can share it.
ENGINE = create_engine(f"sqlite:///{DB_PATH}", echo=False,
                       connect_args={"check_same_thread": False})

NEW_WINDOW_H = 48
def now_iso() -> str: return datetime.now(timezone.utc).isoformat()


# ----------------------------- models -----------------------------

class Item(SQLModel, table=True):
    id: str = Field(primary_key=True)            # "yt:<vid>" / "reddit:<url>" / "news:<url>"
    kind: str = Field(index=True)                # video | news | reddit
    lang: str = Field(index=True)
    title: str
    url: str = ""
    source: str = ""                             # site / subreddit
    channel: str = ""
    views: Optional[int] = None
    duration: str = ""
    published_at: Optional[str] = None
    thumb_url: str = ""
    snippet: str = ""
    video_id: Optional[str] = None
    first_seen: str = ""
    last_seen: str = ""
    score: int = 0
    raw: str = "{}"
    # editorial fields (admin)
    status: str = Field(default="new", index=True)   # new | approved | hidden
    pinned: bool = False                              # editor-featured on the site
    editor_note: str = ""
    manual: bool = False                             # added by hand in the admin
    tg_posted: bool = False                          # already sent to Telegram

class Digest(SQLModel, table=True):
    item_id: str = Field(primary_key=True, foreign_key="item.id")
    tldr: str = ""
    signals: str = "[]"     # [{t,k}] patch changes
    builds: str = "[]"      # recommended builds/classes
    points: str = "[]"      # key takeaways (for non-build guides)
    tags: str = "[]"
    model: str = ""
    created_at: str = ""

class Transcript(SQLModel, table=True):
    item_id: str = Field(primary_key=True, foreign_key="item.id")
    lang: str = ""
    text: str = ""
    fetched_at: str = ""

class Source(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    kind: str                                    # yt_query | reddit | news
    value: str                                   # the query text or the feed url
    label: str = ""                              # display source name (reddit/news)
    lang: str = "en"
    n: int = 12                                  # how many to pull (yt_query)
    enabled: bool = True
    weight: int = 1

class Run(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    started_at: str
    finished_at: Optional[str] = None
    ok: bool = False
    stats: str = "{}"

class Meta(SQLModel, table=True):
    key: str = Field(primary_key=True)
    value: str = ""


# ----------------------------- init / seed -----------------------------

def init_db():
    SQLModel.metadata.create_all(ENGINE)
    _migrate()

def _migrate():
    """Tiny idempotent migrations for a dev SQLite file (create_all won't ALTER)."""
    with ENGINE.begin() as conn:
        dcols = [r[1] for r in conn.exec_driver_sql("PRAGMA table_info(digest)").fetchall()]
        if "points" not in dcols:
            conn.exec_driver_sql("ALTER TABLE digest ADD COLUMN points TEXT DEFAULT '[]'")
        icols = [r[1] for r in conn.exec_driver_sql("PRAGMA table_info(item)").fetchall()]
        for name, ddl in [("status", "TEXT DEFAULT 'new'"), ("pinned", "INTEGER DEFAULT 0"),
                          ("editor_note", "TEXT DEFAULT ''"), ("manual", "INTEGER DEFAULT 0"),
                          ("tg_posted", "INTEGER DEFAULT 0")]:
            if name not in icols:
                conn.exec_driver_sql(f"ALTER TABLE item ADD COLUMN {name} {ddl}")

def seed_sources():
    """Populate `sources` from pipeline/sources.json the first time only."""
    cfg = json.loads((Path(__file__).parent / "sources.json").read_text(encoding="utf-8"))
    with Session(ENGINE) as s:
        if s.exec(select(Source)).first():
            return
        for q in cfg.get("youtube_queries", []):
            s.add(Source(kind="yt_query", value=q["q"], lang=q.get("lang", "en"), n=q.get("n", 12)))
        for r in cfg.get("reddit", []):
            s.add(Source(kind="reddit", value=r["url"], label=r.get("source", ""), lang=r.get("lang", "en")))
        for n in cfg.get("news", []):
            s.add(Source(kind="news", value=n["url"], label=n.get("source", ""), lang=n.get("lang", "en")))
        s.commit()

def enabled_sources(kind: str):
    with Session(ENGINE) as s:
        return list(s.exec(select(Source).where(Source.kind == kind, Source.enabled == True)))


# ----------------------------- writes -----------------------------

def upsert_item(d: dict):
    """Insert a new item or refresh a known one. Sets first_seen once, bumps last_seen."""
    with Session(ENGINE) as s:
        row = s.get(Item, d["id"])
        ts = now_iso()
        if row is None:
            row = Item(id=d["id"], first_seen=ts)
        row.kind = d.get("kind", row.kind)
        row.lang = d.get("lang", row.lang)
        row.title = d.get("title", row.title)
        row.url = d.get("url", row.url)
        row.source = d.get("source", row.source)
        row.channel = d.get("channel", row.channel)
        row.views = d.get("views", row.views)
        row.duration = d.get("duration", row.duration)
        row.published_at = d.get("published_at", row.published_at)
        row.thumb_url = d.get("thumb_url", row.thumb_url)
        row.snippet = d.get("snippet", row.snippet)
        row.video_id = d.get("video_id", row.video_id)
        row.score = d.get("views") or 0
        row.last_seen = ts
        row.raw = json.dumps(d, ensure_ascii=False)
        s.add(row)
        s.commit()
        return row.first_seen

def set_digest(item_id: str, digest: dict, model: str):
    with Session(ENGINE) as s:
        row = s.get(Digest, item_id) or Digest(item_id=item_id)
        row.tldr = digest.get("tldr", "")
        row.signals = json.dumps(digest.get("signals", []), ensure_ascii=False)
        row.builds = json.dumps(digest.get("builds", []), ensure_ascii=False)
        row.points = json.dumps(digest.get("points", []), ensure_ascii=False)
        row.tags = json.dumps(digest.get("tags", []), ensure_ascii=False)
        row.model = model
        row.created_at = now_iso()
        s.add(row); s.commit()

def get_cached_digest(item_id: str) -> Optional[dict]:
    with Session(ENGINE) as s:
        row = s.get(Digest, item_id)
        if not row:
            return None
        return {"tldr": row.tldr, "signals": json.loads(row.signals),
                "builds": json.loads(row.builds), "points": json.loads(row.points or "[]"),
                "tags": json.loads(row.tags)}

def save_transcript(item_id: str, lang: str, text: str):
    with Session(ENGINE) as s:
        row = s.get(Transcript, item_id) or Transcript(item_id=item_id)
        row.lang, row.text, row.fetched_at = lang, text, now_iso()
        s.add(row); s.commit()

def set_meta(key: str, value: str):
    with Session(ENGINE) as s:
        row = s.get(Meta, key) or Meta(key=key)
        row.value = value
        s.add(row); s.commit()

def get_meta(key: str, default: str = "") -> str:
    with Session(ENGINE) as s:
        row = s.get(Meta, key)
        return row.value if row else default

def start_run() -> int:
    with Session(ENGINE) as s:
        r = Run(started_at=now_iso())
        s.add(r); s.commit(); s.refresh(r)
        return r.id

def finish_run(run_id: int, ok: bool, stats: dict):
    with Session(ENGINE) as s:
        r = s.get(Run, run_id)
        if r:
            r.finished_at = now_iso(); r.ok = ok; r.stats = json.dumps(stats, ensure_ascii=False)
            s.add(r); s.commit()


# ----------------------------- reads (shared by API + exporter) -----------------------------

def _rel_time(iso: Optional[str]) -> str:
    if not iso:
        return ""
    try:
        t = datetime.fromisoformat(iso)
    except ValueError:
        return ""
    delta = (datetime.now(timezone.utc) - t).total_seconds()
    if delta < 3600:   return "только что"
    if delta < 86400:  return f"{int(delta // 3600)} ч назад"
    if delta < 172800: return "вчера"
    return f"{int(delta // 86400)} дн назад"

def _to_card(item: Item, digest: Optional[Digest], featured: bool = False) -> dict:
    age_h = 999.0
    if item.first_seen:
        try:
            age_h = (datetime.now(timezone.utc) - datetime.fromisoformat(item.first_seen)).total_seconds() / 3600
        except ValueError:
            pass
    card = {
        "id": item.id, "type": item.kind, "lang": item.lang, "title": item.title,
        "url": item.url, "source": item.source, "channel": item.channel,
        "views": item.views, "duration": item.duration, "thumb_url": item.thumb_url,
        "snippet": item.snippet, "video_id": item.video_id,
        "time": _rel_time(item.published_at or item.first_seen),
        "isNew": age_h < NEW_WINDOW_H,
    }
    if digest:
        card["digest"] = {"tldr": digest.tldr, "signals": json.loads(digest.signals),
                          "builds": json.loads(digest.builds), "points": json.loads(digest.points or "[]"),
                          "tags": json.loads(digest.tags)}
        card["featured"] = featured
    return card

def get_feed(kind: Optional[str] = None, lang: Optional[str] = None, limit: int = 60) -> list[dict]:
    with Session(ENGINE) as s:
        q = select(Item).where(Item.status != "hidden")   # editor-curated public feed
        if kind and kind != "all":
            q = q.where(Item.kind == kind)
        if lang and lang != "all":
            q = q.where(Item.lang == lang)
        q = q.order_by(Item.score.desc(), Item.first_seen.desc()).limit(limit)
        items = list(s.exec(q))
        # featured: an editor-pinned item wins; else most-viewed video with a digest
        featured_id, best = None, -1
        for it in items:
            if it.pinned and (it.views or 0) > best:
                best, featured_id = (it.views or 0), it.id
        if featured_id is None:
            best = -1
            for it in items:
                if it.kind == "video" and s.get(Digest, it.id) and (it.views or 0) > best:
                    best, featured_id = (it.views or 0), it.id
        cards = [_to_card(it, s.get(Digest, it.id), featured=(it.id == featured_id)) for it in items]
        cards.sort(key=lambda c: 0 if c.get("featured") else 1)
        return cards

def get_item(item_id: str) -> Optional[dict]:
    with Session(ENGINE) as s:
        it = s.get(Item, item_id)
        if not it:
            return None
        card = _to_card(it, s.get(Digest, it.id))
        tr = s.get(Transcript, item_id)
        if tr:
            card["transcript"] = tr.text
        return card

def get_meta_dict() -> dict:
    with Session(ENGINE) as s:
        counts = {k: len(list(s.exec(select(Item).where(Item.kind == k)))) for k in ("video", "news", "reddit")}
    return {"league": get_meta("league", "0.5"),
            "last_updated": get_meta("last_updated", ""),
            "counts": counts}


# ----------------------------- admin (editorial) -----------------------------

def _digest_dict(d: Optional[Digest]) -> Optional[dict]:
    if not d:
        return None
    return {"tldr": d.tldr, "points": json.loads(d.points or "[]"), "tags": json.loads(d.tags or "[]"),
            "signals": json.loads(d.signals or "[]"), "builds": json.loads(d.builds or "[]")}

def get_admin_items(status: Optional[str] = None, limit: int = 300) -> list[dict]:
    with Session(ENGINE) as s:
        q = select(Item)
        if status and status != "all":
            q = q.where(Item.status == status)
        q = q.order_by(Item.first_seen.desc()).limit(limit)
        out = []
        for it in s.exec(q):
            out.append({
                "id": it.id, "type": it.kind, "lang": it.lang, "title": it.title, "url": it.url,
                "source": it.source, "channel": it.channel, "views": it.views, "duration": it.duration,
                "thumb_url": it.thumb_url, "snippet": it.snippet, "first_seen": it.first_seen,
                "status": it.status, "pinned": bool(it.pinned), "manual": bool(it.manual),
                "tg_posted": bool(it.tg_posted),
                "has_digest": s.get(Digest, it.id) is not None,
                "digest": _digest_dict(s.get(Digest, it.id)),
            })
        return out

def admin_counts() -> dict:
    with Session(ENGINE) as s:
        out = {"all": len(list(s.exec(select(Item))))}
        for st in ("new", "approved", "hidden"):
            out[st] = len(list(s.exec(select(Item).where(Item.status == st))))
        return out

_EDITABLE = {"status", "pinned", "editor_note", "title", "snippet", "url", "thumb_url", "lang", "channel", "source"}

def set_item_fields(item_id: str, fields: dict) -> bool:
    with Session(ENGINE) as s:
        it = s.get(Item, item_id)
        if not it:
            return False
        for k, v in fields.items():
            if k in _EDITABLE:
                setattr(it, k, v)
        s.add(it); s.commit()
        return True

def update_digest_fields(item_id: str, fields: dict):
    with Session(ENGINE) as s:
        d = s.get(Digest, item_id) or Digest(item_id=item_id, created_at=now_iso())
        if "tldr" in fields:
            d.tldr = fields["tldr"]
        for k in ("points", "tags", "signals", "builds"):
            if k in fields:
                setattr(d, k, json.dumps(fields[k], ensure_ascii=False))
        d.model = fields.get("model", d.model or "editor")
        d.created_at = d.created_at or now_iso()
        s.add(d); s.commit()

def delete_item(item_id: str):
    with Session(ENGINE) as s:
        for M in (Digest, Transcript):
            r = s.get(M, item_id)
            if r:
                s.delete(r)
        it = s.get(Item, item_id)
        if it:
            s.delete(it)
        s.commit()

def add_manual_item(d: dict) -> str:
    import uuid
    iid = d.get("id") or f"manual:{uuid.uuid4().hex[:10]}"
    ts = now_iso()
    with Session(ENGINE) as s:
        it = Item(id=iid, kind=d.get("type", "news"), lang=d.get("lang", "ru"),
                  title=d.get("title", ""), url=d.get("url", ""), source=d.get("source", "вручную"),
                  channel=d.get("channel", ""), thumb_url=d.get("thumb_url", ""),
                  snippet=d.get("snippet", ""), first_seen=ts, last_seen=ts,
                  status=d.get("status", "approved"), manual=True, score=d.get("views") or 0)
        s.add(it); s.commit()
    if d.get("digest"):
        update_digest_fields(iid, d["digest"])
    return iid

def mark_tg_posted(item_id: str, posted: bool = True):
    with Session(ENGINE) as s:
        it = s.get(Item, item_id)
        if it:
            it.tg_posted = posted
            s.add(it); s.commit()

def export_feed(path, limit: int = 60):
    """Write the public static snapshot (what the site reads offline)."""
    meta = get_meta_dict()
    feed = {"generated_at": meta["last_updated"], "league": meta["league"],
            "counts": meta["counts"], "items": get_feed(limit=limit)}
    from pathlib import Path as _P
    _P(path).write_text(json.dumps(feed, ensure_ascii=False, indent=2), encoding="utf-8")
    return len(feed["items"])
