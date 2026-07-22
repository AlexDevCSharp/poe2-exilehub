"""Import digest JSONs from data/digests/<video_id>.json into the DB.

This is the bridge for the "no-API" workflow: a Claude chat (or `claude` CLI) writes
digest files, this loads them into the DB so the site/API shows them.

Usage:  python pipeline/import_digests.py
"""
import json, sys
from pathlib import Path
from sqlmodel import Session
import db

db.init_db()
DIG = Path("data/digests")
imported = 0
for f in sorted(DIG.glob("*.json")):
    item_id = f"yt:{f.stem}"
    with Session(db.ENGINE) as s:
        exists = s.get(db.Item, item_id) is not None
    if not exists:
        print(f"skip (no item in DB): {f.stem}", file=sys.stderr); continue
    try:
        digest = json.loads(f.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"bad json {f.name}: {e}", file=sys.stderr); continue
    db.set_digest(item_id, digest, digest.get("_by", "chat"))
    imported += 1
    print(f"imported {f.stem}", file=sys.stderr)

print(f"done: {imported} digests in DB", file=sys.stderr)
