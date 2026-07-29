"""
Flexible YouTube search for the admin "Поиск" tab.

All filters optional — empty ones are ignored, so you can go precise or broad:
  query, author, period(any|today|yesterday|7d|30d|range), date_from/date_to (YYYY-MM-DD),
  min_views, sort(relevance|date|views), lang(tag), only_poe2, limit.

Fast path: no date filter -> flat search only (yt-dlp gives views/channel/duration).
Date filter -> full-extract candidates to read upload_date, then filter.
"""
from __future__ import annotations
import datetime as _dt


def _ymd(s: str) -> str:
    return (s or "").replace("-", "").strip()

def _date_range(period: str, date_from: str, date_to: str):
    today = _dt.datetime.now(_dt.timezone.utc).date()
    fmt = lambda d: d.strftime("%Y%m%d")
    if period == "today":     return fmt(today), fmt(today)
    if period == "yesterday": d = today - _dt.timedelta(days=1); return fmt(d), fmt(d)
    if period == "7d":        return fmt(today - _dt.timedelta(days=7)), fmt(today)
    if period == "30d":       return fmt(today - _dt.timedelta(days=30)), fmt(today)
    if period == "range":     return (_ymd(date_from) or None), (_ymd(date_to) or None)
    return None, None  # any


def _fmt_duration(sec):
    if not sec: return ""
    sec = int(sec); h, m, s = sec // 3600, (sec % 3600) // 60, sec % 60
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"


def search_videos(query="", author="", period="any", date_from="", date_to="",
                  min_views=0, sort="relevance", lang="", only_poe2=True, limit=15) -> list[dict]:
    from yt_dlp import YoutubeDL

    parts = [p for p in (query.strip(), author.strip()) if p]
    q = " ".join(parts)
    if only_poe2 and "exile" not in q.lower() and "poe" not in q.lower():
        q = (q + " Path of Exile 2").strip()
    if not q:
        q = "Path of Exile 2"

    df, dt = _date_range(period, date_from, date_to)
    need_dates = bool(df or dt) or sort == "date"
    limit = max(1, min(int(limit or 15), 30))
    fetch_n = min(max(limit * 2, 20), 40)

    # pass 1: flat search (fast; gives views/channel/duration/id/title)
    with YoutubeDL({"quiet": True, "no_warnings": True, "extract_flat": True, "skip_download": True}) as y:
        info = y.extract_info(f"ytsearch{fetch_n}:{q}", download=False)
    entries = [e for e in (info.get("entries") or []) if e]

    rows = []
    for e in entries:
        rows.append({
            "id": f"yt:{e.get('id')}", "video_id": e.get("id"), "type": "video",
            "title": e.get("title") or "", "channel": e.get("channel") or e.get("uploader") or "",
            "url": f"https://youtu.be/{e.get('id')}", "views": e.get("view_count"),
            "duration": _fmt_duration(e.get("duration")), "thumb_url": f"https://i.ytimg.com/vi/{e.get('id')}/hqdefault.jpg",
            "upload_date": None, "lang": lang or "en",
        })

    # pass 2: only if we need dates — full-extract to read upload_date
    if need_dates:
        detailed = []
        with YoutubeDL({"quiet": True, "no_warnings": True, "skip_download": True}) as y:
            for r in rows[:25]:
                try:
                    e = y.extract_info(f"https://www.youtube.com/watch?v={r['video_id']}", download=False)
                except Exception:
                    continue
                r["upload_date"] = e.get("upload_date")
                if r["views"] is None:
                    r["views"] = e.get("view_count")
                detailed.append(r)
        rows = detailed

    # filters (empty = ignored)
    def keep(r):
        if author and author.lower() not in (r["channel"] or "").lower():
            return False
        if min_views and (r["views"] or 0) < int(min_views):
            return False
        if df and (not r["upload_date"] or r["upload_date"] < df):
            return False
        if dt and (not r["upload_date"] or r["upload_date"] > dt):
            return False
        return True

    rows = [r for r in rows if keep(r)]

    if sort == "views":
        rows.sort(key=lambda r: r["views"] or 0, reverse=True)
    elif sort == "date":
        rows.sort(key=lambda r: r["upload_date"] or "", reverse=True)

    return rows[:limit]
