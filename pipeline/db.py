"""
Data layer for EXILE HUB — SQLModel + SQLite (local file, portable to Postgres later).

Tables: items, digests, transcripts, sources, runs, meta.
Also exposes query helpers (get_feed / get_item / get_meta_dict) used by BOTH the
pipeline and the FastAPI backend, so the API and the exporter return the same shape.
"""
from __future__ import annotations
import json, re
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

class Creator(SQLModel, table=True):
    """Blogger/streamer we track. Dedup by youtube_channel_id, then normalized name."""
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    name_key: str = Field(default="", index=True)      # normalized for dedup
    youtube_channel_id: Optional[str] = Field(default=None, index=True)  # UC...
    youtube_url: str = ""
    handle: str = ""
    telegram: str = ""
    twitch: str = ""
    twitter: str = ""
    discord: str = ""
    website: str = ""
    lang: str = ""
    notes: str = ""
    promote: bool = False                              # мы продвигаем этого автора
    priority: int = 0
    status: str = Field(default="active")             # active | archived | blocked
    first_seen: str = ""
    last_seen: str = ""

class Item(SQLModel, table=True):
    id: str = Field(primary_key=True)            # "yt:<vid>" / "reddit:<url>" / "news:<url>"  (unique code)
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
    # editorial fields (admin). status supports soft-delete — nothing is ever hard-removed:
    #   new | approved | published | hidden | outdated | deleted | archived
    status: str = Field(default="new", index=True)
    pinned: bool = False                              # editor-featured on the site
    editor_note: str = ""
    manual: bool = False                             # added by hand in the admin
    tg_posted: bool = False                          # already sent to Telegram
    # data-backbone
    creator_id: Optional[int] = Field(default=None, foreign_key="creator.id", index=True)
    analyzed: bool = False
    analyzed_at: Optional[str] = None
    downloaded: bool = False                          # transcript pulled
    rating: int = 0                                  # editor quality 0-5
    found_via: str = ""                              # search | pipeline | manual
    tags: str = "[]"                                 # editor tags (json)
    deleted_at: Optional[str] = None

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

class Article(SQLModel, table=True):
    """Big site article. Persists forever — unpublish/delete only flips status."""
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = ""
    slug: str = Field(default="", index=True)
    body: str = ""
    summary: str = ""
    lang: str = "ru"
    creator_id: Optional[int] = Field(default=None, foreign_key="creator.id")
    related_videos: str = "[]"                        # json list of item ids
    status: str = Field(default="draft", index=True)  # draft|published|outdated|deleted|archived
    published_url: str = ""
    published_at: Optional[str] = None
    promote: bool = False
    priority: int = 0
    created_at: str = ""
    updated_at: str = ""
    deleted_at: Optional[str] = None


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
                          ("tg_posted", "INTEGER DEFAULT 0"),
                          ("creator_id", "INTEGER"), ("analyzed", "INTEGER DEFAULT 0"),
                          ("analyzed_at", "TEXT"), ("downloaded", "INTEGER DEFAULT 0"),
                          ("rating", "INTEGER DEFAULT 0"), ("found_via", "TEXT DEFAULT ''"),
                          ("tags", "TEXT DEFAULT '[]'"), ("deleted_at", "TEXT")]:
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


# ----------------------------- creators -----------------------------

def _name_key(name: str) -> str:
    return re.sub(r"\s+", " ", (name or "").strip().lower())

def get_or_create_creator(name: str, youtube_channel_id: Optional[str] = None, **extra) -> Optional[int]:
    """Dedup: by youtube_channel_id first, then normalized name. Enriches empty fields only."""
    name = (name or "").strip()
    if not name and not youtube_channel_id:
        return None
    key, ts = _name_key(name), now_iso()
    with Session(ENGINE) as s:
        row = None
        if youtube_channel_id:
            row = s.exec(select(Creator).where(Creator.youtube_channel_id == youtube_channel_id)).first()
        if row is None and key:
            row = s.exec(select(Creator).where(Creator.name_key == key)).first()
        if row is None:
            row = Creator(name=name or youtube_channel_id, name_key=key, first_seen=ts)
        if youtube_channel_id and not row.youtube_channel_id:
            row.youtube_channel_id = youtube_channel_id
        for f in ("youtube_url", "handle", "telegram", "twitch", "twitter", "discord", "website", "lang"):
            v = extra.get(f)
            if v and not getattr(row, f):
                setattr(row, f, v)
        row.last_seen = ts
        s.add(row); s.commit(); s.refresh(row)
        return row.id

def list_creators(status: Optional[str] = None) -> list[dict]:
    with Session(ENGINE) as s:
        q = select(Creator)
        if status and status != "all":
            q = q.where(Creator.status == status)
        q = q.order_by(Creator.promote.desc(), Creator.priority.desc(), Creator.name)
        out = []
        for c in s.exec(q):
            nvid = len(list(s.exec(select(Item).where(Item.creator_id == c.id))))
            out.append({"id": c.id, "name": c.name, "youtube_url": c.youtube_url,
                        "youtube_channel_id": c.youtube_channel_id, "handle": c.handle,
                        "telegram": c.telegram, "twitch": c.twitch, "twitter": c.twitter,
                        "discord": c.discord, "website": c.website, "lang": c.lang, "notes": c.notes,
                        "promote": bool(c.promote), "priority": c.priority, "status": c.status,
                        "videos": nvid})
        return out

_CREATOR_EDITABLE = {"name", "youtube_url", "youtube_channel_id", "handle", "telegram", "twitch",
                     "twitter", "discord", "website", "lang", "notes", "promote", "priority", "status"}

def update_creator(creator_id: int, fields: dict) -> bool:
    with Session(ENGINE) as s:
        c = s.get(Creator, creator_id)
        if not c:
            return False
        for k, v in fields.items():
            if k in _CREATOR_EDITABLE:
                setattr(c, k, v)
        if "name" in fields:
            c.name_key = _name_key(fields["name"])
        s.add(c); s.commit()
        return True

def backfill_creators() -> int:
    """One-time: link existing video items to creators by channel name."""
    with Session(ENGINE) as s:
        vids = list(s.exec(select(Item).where(Item.kind == "video", Item.creator_id == None)))
    n = 0
    for it in vids:
        if not it.channel:
            continue
        cid = get_or_create_creator(it.channel, lang=it.lang)
        with Session(ENGINE) as s:
            row = s.get(Item, it.id)
            row.creator_id = cid
            s.add(row); s.commit()
        n += 1
    return n


# ----------------------------- writes -----------------------------

def upsert_item(d: dict):
    """Insert a new item or refresh a known one. Sets first_seen once, bumps last_seen.
    For videos, auto-links (and creates) the creator by channel name."""
    creator_id = None
    if d.get("kind") == "video" and d.get("channel"):
        creator_id = get_or_create_creator(d["channel"], lang=d.get("lang"))
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
        if creator_id and not row.creator_id:
            row.creator_id = creator_id
        if d.get("found_via") and not row.found_via:
            row.found_via = d["found_via"]
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
        s.add(row)
        it = s.get(Item, item_id)              # mark the video analyzed
        if it and not it.analyzed:
            it.analyzed = True
            it.analyzed_at = now_iso()
            s.add(it)
        s.commit()

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
        q = select(Item).where(Item.status.notin_(["hidden", "deleted", "outdated", "archived"]))  # public feed
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
        else:
            q = q.where(Item.status != "deleted")     # main view hides soft-deleted (kept in DB)
        q = q.order_by(Item.first_seen.desc()).limit(limit)
        out = []
        for it in s.exec(q):
            creator = s.get(Creator, it.creator_id) if it.creator_id else None
            out.append({
                "id": it.id, "type": it.kind, "lang": it.lang, "title": it.title, "url": it.url,
                "source": it.source, "channel": it.channel, "views": it.views, "duration": it.duration,
                "thumb_url": it.thumb_url, "snippet": it.snippet, "first_seen": it.first_seen,
                "status": it.status, "pinned": bool(it.pinned), "manual": bool(it.manual),
                "tg_posted": bool(it.tg_posted), "analyzed": bool(it.analyzed), "rating": it.rating,
                "creator_id": it.creator_id, "creator": creator.name if creator else it.channel,
                "has_digest": s.get(Digest, it.id) is not None,
                "digest": _digest_dict(s.get(Digest, it.id)),
            })
        return out

def admin_counts() -> dict:
    with Session(ENGINE) as s:
        out = {"all": len(list(s.exec(select(Item).where(Item.status != "deleted"))))}
        for st in ("new", "approved", "hidden", "deleted"):
            out[st] = len(list(s.exec(select(Item).where(Item.status == st))))
        out["creators"] = len(list(s.exec(select(Creator))))
        return out

def known_status(video_ids: list) -> dict:
    """Search dedup: which ids are already in the DB / already analyzed."""
    with Session(ENGINE) as s:
        out = {}
        for v in video_ids:
            iid = v if str(v).startswith("yt:") else f"yt:{v}"
            it = s.get(Item, iid)
            out[iid] = {"known": it is not None, "analyzed": bool(it.analyzed) if it else False,
                        "status": it.status if it else None}
        return out

_EDITABLE = {"status", "pinned", "editor_note", "title", "snippet", "url", "thumb_url",
             "lang", "channel", "source", "rating"}

def set_item_fields(item_id: str, fields: dict) -> bool:
    with Session(ENGINE) as s:
        it = s.get(Item, item_id)
        if not it:
            return False
        for k, v in fields.items():
            if k in _EDITABLE:
                setattr(it, k, v)
        if fields.get("status") and fields["status"] != "deleted":
            it.deleted_at = None                 # un-delete clears the marker
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
    """SOFT-delete: nothing is removed — status=deleted, kept forever (restorable)."""
    with Session(ENGINE) as s:
        it = s.get(Item, item_id)
        if it:
            it.status = "deleted"
            it.deleted_at = now_iso()
            s.add(it); s.commit()

def restore_item(item_id: str, status: str = "new"):
    with Session(ENGINE) as s:
        it = s.get(Item, item_id)
        if it:
            it.status = status
            it.deleted_at = None
            s.add(it); s.commit()

def hard_delete_item(item_id: str):
    """Permanent removal (rarely needed — soft-delete is the default)."""
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

# ----------------------------- articles -----------------------------

def _slugify(title: str) -> str:
    s = re.sub(r"[^0-9a-zа-яё]+", "-", (title or "").lower().strip())
    return s.strip("-")[:60] or "article"

def _article_dict(a: Article) -> dict:
    return {"id": a.id, "title": a.title, "slug": a.slug, "summary": a.summary, "body": a.body,
            "lang": a.lang, "status": a.status, "promote": bool(a.promote), "priority": a.priority,
            "creator_id": a.creator_id, "related_videos": json.loads(a.related_videos or "[]"),
            "published_url": a.published_url, "published_at": a.published_at,
            "created_at": a.created_at, "updated_at": a.updated_at}

def list_articles(status: Optional[str] = None) -> list[dict]:
    with Session(ENGINE) as s:
        q = select(Article)
        if status and status != "all":
            q = q.where(Article.status == status)
        else:
            q = q.where(Article.status != "deleted")
        q = q.order_by(Article.promote.desc(), Article.priority.desc(), Article.updated_at.desc())
        return [_article_dict(a) for a in s.exec(q)]

def get_article(article_id: int) -> Optional[dict]:
    with Session(ENGINE) as s:
        a = s.get(Article, article_id)
        return _article_dict(a) if a else None

def create_article(d: dict) -> int:
    ts = now_iso()
    with Session(ENGINE) as s:
        a = Article(title=d.get("title", ""), slug=d.get("slug") or _slugify(d.get("title", "")),
                    body=d.get("body", ""), summary=d.get("summary", ""), lang=d.get("lang", "ru"),
                    creator_id=d.get("creator_id"), related_videos=json.dumps(d.get("related_videos", []), ensure_ascii=False),
                    status=d.get("status", "draft"), promote=d.get("promote", False), priority=d.get("priority", 0),
                    created_at=ts, updated_at=ts)
        s.add(a); s.commit(); s.refresh(a)
        return a.id

_ARTICLE_EDITABLE = {"title", "slug", "body", "summary", "lang", "status", "promote", "priority",
                     "creator_id", "published_url"}

def update_article(article_id: int, fields: dict) -> bool:
    with Session(ENGINE) as s:
        a = s.get(Article, article_id)
        if not a:
            return False
        for k, v in fields.items():
            if k in _ARTICLE_EDITABLE:
                setattr(a, k, v)
        if "related_videos" in fields:
            a.related_videos = json.dumps(fields["related_videos"], ensure_ascii=False)
        if fields.get("status") == "published" and not a.published_at:
            a.published_at = now_iso()
        if fields.get("status") and fields["status"] != "deleted":
            a.deleted_at = None
        a.updated_at = now_iso()
        s.add(a); s.commit()
        return True

def delete_article(article_id: int):
    """Soft-delete — kept in DB forever."""
    with Session(ENGINE) as s:
        a = s.get(Article, article_id)
        if a:
            a.status = "deleted"; a.deleted_at = now_iso(); a.updated_at = now_iso()
            s.add(a); s.commit()

def export_articles(path, limit: int = 100) -> int:
    """Public snapshot of PUBLISHED articles for the static site."""
    with Session(ENGINE) as s:
        rows = list(s.exec(select(Article).where(Article.status == "published")
                           .order_by(Article.promote.desc(), Article.priority.desc(), Article.published_at.desc()).limit(limit)))
        creators = {c.id: c.name for c in s.exec(select(Creator))}
        arts = []
        for a in rows:
            d = _article_dict(a)
            d["author"] = creators.get(a.creator_id)
            arts.append(d)
    out = {"generated_at": now_iso(), "articles": arts}
    from pathlib import Path as _P
    _P(path).write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    return len(arts)

def export_creators(path, limit: int = 50) -> int:
    """Public snapshot of PROMOTED (⭐) active creators + their socials, for the site."""
    with Session(ENGINE) as s:
        rows = list(s.exec(select(Creator).where(Creator.promote == True, Creator.status == "active")
                           .order_by(Creator.priority.desc(), Creator.name).limit(limit)))
        out = [{"name": c.name, "youtube_url": c.youtube_url, "telegram": c.telegram, "twitch": c.twitch,
                "twitter": c.twitter, "discord": c.discord, "website": c.website, "lang": c.lang} for c in rows]
    from pathlib import Path as _P
    _P(path).write_text(json.dumps({"generated_at": now_iso(), "creators": out}, ensure_ascii=False, indent=2), encoding="utf-8")
    return len(out)

def backup_db(keep: int = 12) -> str:
    """Consistent copy of the DB (safe even with the app connected). Keeps last `keep`."""
    import sqlite3
    bdir = DB_PATH.parent / "backups"
    bdir.mkdir(exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    dst = bdir / f"exilehub-{ts}.db"
    src, out = sqlite3.connect(str(DB_PATH)), sqlite3.connect(str(dst))
    with out:
        src.backup(out)
    src.close(); out.close()
    for old in sorted(bdir.glob("exilehub-*.db"))[:-keep]:
        old.unlink()
    return dst.name

def article_counts() -> dict:
    with Session(ENGINE) as s:
        out = {"all": len(list(s.exec(select(Article).where(Article.status != "deleted"))))}
        for st in ("draft", "published", "deleted"):
            out[st] = len(list(s.exec(select(Article).where(Article.status == st))))
        return out


def export_feed(path, limit: int = 60):
    """Write the public static snapshot (what the site reads offline)."""
    meta = get_meta_dict()
    feed = {"generated_at": meta["last_updated"], "league": meta["league"],
            "counts": meta["counts"], "items": get_feed(limit=limit)}
    from pathlib import Path as _P
    _P(path).write_text(json.dumps(feed, ensure_ascii=False, indent=2), encoding="utf-8")
    return len(feed["items"])
