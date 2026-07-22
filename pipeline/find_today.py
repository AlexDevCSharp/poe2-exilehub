"""Find PoE2 videos uploaded TODAY (UTC). Dumps candidates to tmp/today.json.

Two-pass: (1) fast flat search sorted by date -> ids in date order,
          (2) full-extract each id to get exact upload_date + views + duration + description.
Usage:  python pipeline/find_today.py
"""
import json, sys, datetime
from collections import Counter
from pathlib import Path
from yt_dlp import YoutubeDL

TODAY = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d")
QUERIES = [
    "https://www.youtube.com/results?search_query=Path+of+Exile+2&sp=CAI%3D",
    "https://www.youtube.com/results?search_query=PoE2+build+guide&sp=CAI%3D",
]
TMP = Path("tmp"); TMP.mkdir(exist_ok=True)

# pass 1: ids in date order (flat = fast)
ids, seen = [], set()
with YoutubeDL({"quiet": True, "no_warnings": True, "skip_download": True,
                "extract_flat": True, "playlistend": 12}) as y:
    for q in QUERIES:
        try:
            info = y.extract_info(q, download=False)
        except Exception as e:
            print(f"! flat {q[:40]}: {e}", file=sys.stderr); continue
        for e in info.get("entries") or []:
            vid = (e or {}).get("id")
            if vid and vid not in seen:
                seen.add(vid); ids.append(vid)

# pass 2: full extract for exact upload_date
rows = []
with YoutubeDL({"quiet": True, "no_warnings": True, "skip_download": True}) as y:
    for vid in ids[:16]:
        try:
            e = y.extract_info(f"https://www.youtube.com/watch?v={vid}", download=False)
        except Exception as ex:
            print(f"! full {vid}: {ex}", file=sys.stderr); continue
        rows.append({
            "id": vid, "title": e.get("title") or "", "channel": e.get("channel") or e.get("uploader") or "",
            "upload_date": e.get("upload_date"), "views": e.get("view_count"),
            "duration": e.get("duration"), "desc": (e.get("description") or "")[:400],
        })

print(f"TODAY(UTC)={TODAY}  full_extracted={len(rows)}", file=sys.stderr)
print("dates:", Counter(r["upload_date"] for r in rows).most_common(8), file=sys.stderr)

today = [r for r in rows if r.get("upload_date") == TODAY]
today.sort(key=lambda r: r.get("views") or 0, reverse=True)
(TMP / "today.json").write_text(json.dumps(today or rows, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"uploaded_today={len(today)}  (saved {'today' if today else 'ALL as fallback'} -> tmp/today.json)", file=sys.stderr)
