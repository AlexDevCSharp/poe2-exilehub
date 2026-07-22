"""Dump cleaned transcripts of given video ids to tmp/<id>.txt (for analysis in a Claude chat).

Usage:  python pipeline/fetch_transcripts.py <video_id> [<video_id> ...]
"""
import sys, time
from pathlib import Path
import run   # same dir on sys.path

TMP = Path("tmp"); TMP.mkdir(exist_ok=True)
LIMIT = 8000   # chars — enough for a digest, keeps chat context bounded

ids = sys.argv[1:]
for n, vid in enumerate(ids):
    text = run.get_transcript(vid)
    (TMP / f"{vid}.txt").write_text(text[:LIMIT], encoding="utf-8")
    print(f"{vid}: {len(text.split())} words -> tmp/{vid}.txt (saved {min(len(text), LIMIT)} chars)",
          file=sys.stderr)
    if n < len(ids) - 1:
        time.sleep(5)   # be gentle with YouTube (avoid 429)
