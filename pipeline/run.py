"""
EXILE HUB aggregation pipeline (writes to SQLite via pipeline/db.py).

Stage 1 (keyless): discover YouTube (yt-dlp) + Reddit + PoE news -> upsert into DB.
Stage 2 (ANTHROPIC_API_KEY): transcript -> Claude digest, cached in DB.
Also exports web/data/feed.json (static fallback for the frontend).

Run:  python pipeline/run.py
"""
from __future__ import annotations
import json, os, re, sys, html, time
import urllib.request, urllib.error
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

from db import (init_db, seed_sources, enabled_sources, upsert_item, set_digest,
                get_cached_digest, save_transcript, set_meta, start_run, finish_run,
                get_feed, get_meta_dict)

ROOT = Path(__file__).resolve().parent.parent
WEB_DATA = ROOT / "web" / "data"; WEB_DATA.mkdir(parents=True, exist_ok=True)
DIGEST_FILES = ROOT / "data" / "digests"
TMP = ROOT / "tmp"; TMP.mkdir(parents=True, exist_ok=True)

CFG = json.loads((Path(__file__).parent / "sources.json").read_text(encoding="utf-8"))
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")
NOW = datetime.now(timezone.utc)


def log(*a): print(*a, file=sys.stderr, flush=True)

def http_get(url, timeout=25, tries=3):
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            last = e
            if e.code in (429, 500, 502, 503):
                time.sleep(2.5 * (i + 1)); continue
            raise
    raise last

def localname(tag): return tag.rsplit("}", 1)[-1]
def child_text(elem, name):
    for c in elem:
        if localname(c.tag) == name:
            return (c.text or "").strip()
    return ""
def strip_html(s): return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s or ""))).strip()
def fmt_duration(sec):
    if not sec: return ""
    sec = int(sec); h, m, s = sec // 3600, (sec % 3600) // 60, sec % 60
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"


# ----------------------------- discovery -----------------------------

def discover_videos(sources):
    try:
        from yt_dlp import YoutubeDL
    except ImportError:
        log("! yt-dlp missing"); return []
    opts = {"quiet": True, "no_warnings": True, "extract_flat": True, "skip_download": True}
    seen, items = set(), []
    with YoutubeDL(opts) as ydl:
        for src in sources:
            try:
                info = ydl.extract_info(f"ytsearch{src.n}:{src.value}", download=False)
            except Exception as e:
                log(f"! yt '{src.value}': {e}"); continue
            for e in info.get("entries") or []:
                vid = (e or {}).get("id")
                if not vid or vid in seen: continue
                seen.add(vid)
                items.append({
                    "id": f"yt:{vid}", "kind": "video", "lang": src.lang,
                    "title": e.get("title") or "", "channel": e.get("channel") or e.get("uploader") or "",
                    "url": f"https://youtu.be/{vid}", "video_id": vid,
                    "views": e.get("view_count"), "duration": fmt_duration(e.get("duration")),
                    "thumb_url": f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg",
                })
            log(f"  yt '{src.value}' [{src.lang}] -> {len(items)} so far")
    return items

def fetch_reddit(sources):
    out = []
    for src in sources:
        try:
            root = ET.fromstring(http_get(src.value))
        except Exception as e:
            log(f"! reddit {src.label}: {e}"); continue
        finally:
            time.sleep(1.5)
        for entry in (e for e in root.iter() if localname(e.tag) == "entry"):
            link = next((c.attrib.get("href", "") for c in entry if localname(c.tag) == "link"), "")
            title = child_text(entry, "title")
            if not title: continue
            out.append({"id": f"reddit:{link}", "kind": "reddit", "lang": src.lang,
                        "title": html.unescape(title), "source": src.label, "url": link,
                        "published_at": child_text(entry, "updated") or child_text(entry, "published")})
    return out

def fetch_news(sources):
    out = []
    for src in sources:
        try:
            root = ET.fromstring(http_get(src.value))
        except Exception as e:
            log(f"! news {src.label}: {e}"); continue
        for item in (e for e in root.iter() if localname(e.tag) == "item"):
            title = child_text(item, "title")
            if not title: continue
            out.append({"id": f"news:{child_text(item, 'link')}", "kind": "news", "lang": src.lang,
                        "title": html.unescape(title), "source": src.label, "url": child_text(item, "link"),
                        "snippet": strip_html(child_text(item, "description"))[:200],
                        "published_at": child_text(item, "pubDate")})
    return out


# ----------------------------- transcripts + analysis -----------------------------

def clean_vtt(raw):
    out = []
    for block in re.split(r"\n\s*\n", raw):
        lines = []
        for ln in block.splitlines():
            if ln.startswith(("WEBVTT", "Kind:", "Language:")) or "-->" in ln: continue
            if re.fullmatch(r"\d+", ln.strip()): continue
            ln = re.sub(r"<[^>]+>", "", ln).replace("&nbsp;", " ").strip()
            if ln: lines.append(ln)
        if lines: out.append(lines[-1])
    deduped = []
    for ln in out:
        if not deduped or deduped[-1] != ln: deduped.append(ln)
    return " ".join(deduped)

def get_transcript(video_id):
    try:
        from yt_dlp import YoutubeDL
    except ImportError:
        return ""
    opts = {"quiet": True, "no_warnings": True, "skip_download": True,
            "writeautomaticsub": True, "writesubtitles": True,
            "subtitleslangs": ["en.*", "ru.*"], "subtitlesformat": "vtt",
            "outtmpl": str(TMP / f"{video_id}.%(ext)s")}
    try:
        with YoutubeDL(opts) as ydl:
            ydl.download([f"https://www.youtube.com/watch?v={video_id}"])
    except Exception as e:
        log(f"! transcript {video_id}: {e}"); return ""
    vtts = sorted(TMP.glob(f"{video_id}*.vtt"))
    return clean_vtt(vtts[0].read_text(encoding="utf-8", errors="replace")) if vtts else ""

def analyze(item):
    """Digest for a video via cache (DB or seed file) or Claude API. None if unavailable."""
    cached = get_cached_digest(item["id"])
    if cached:
        return cached
    # seed file (hand-made showcase) -> import into DB
    seed = DIGEST_FILES / f"{item['video_id']}.json"
    if seed.exists():
        digest = json.loads(seed.read_text(encoding="utf-8"))
        set_digest(item["id"], digest, "seed")
        return digest
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return None
    transcript = get_transcript(item["video_id"])
    if len(transcript) < 200:
        return None
    save_transcript(item["id"], item["lang"], transcript)
    try:
        from anthropic import Anthropic
    except ImportError:
        log("! anthropic SDK missing"); return None
    system = (
        "Ты — редактор русскоязычного сайта про Path of Exile 2. По транскрипту видео сделай "
        "сжатый дайджест для новичка. Верни СТРОГО JSON: "
        '{"tldr":"1-2 предложения по-русски","signals":[{"t":"что изменилось в патче","k":"up|down|ok"}],'
        '"builds":["названия билдов/классов"],"tags":["короткие теги"]}. '
        "Чини ошибки авто-субтитров в названиях. Чего нет — пустой список."
    )
    model = CFG.get("analyze_model", "claude-sonnet-4-6")
    try:
        from anthropic import Anthropic
        msg = Anthropic().messages.create(
            model=model, max_tokens=900,
            system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content":
                       f"Видео: {item['title']} (канал {item['channel']}).\n\nТранскрипт:\n{transcript[:14000]}"}])
        text = re.sub(r"^```(?:json)?|```$", "", msg.content[0].text.strip(), flags=re.MULTILINE).strip()
        digest = json.loads(text)
        set_digest(item["id"], digest, model)
        log(f"  ✓ digest: {item['title'][:46]}")
        return digest
    except Exception as e:
        log(f"! analyze {item['video_id']}: {e}"); return None


# ----------------------------- main -----------------------------

def detect_league(videos):
    nums = re.findall(r"\b0\.\d\b", " ".join(v["title"] for v in videos))
    return max(set(nums), key=nums.count) if nums else None

def main():
    init_db(); seed_sources()
    run_id = start_run()
    lim = CFG["limits"]
    try:
        log("→ discovering videos…")
        videos = discover_videos(enabled_sources("yt_query"))
        videos.sort(key=lambda v: v.get("views") or 0, reverse=True)
        videos = videos[: lim["videos"]]

        log("→ reddit + news…")
        reddit = fetch_reddit(enabled_sources("reddit"))[: lim["reddit"]]
        news = fetch_news(enabled_sources("news"))[: lim["news"]]

        for it in videos + news + reddit:
            upsert_item(it)

        analyzed = 0
        for v in videos[: lim.get("analyze_top", 0)]:
            if analyze(v): analyzed += 1

        league = detect_league(videos) or "0.5"
        set_meta("league", league)
        set_meta("last_updated", NOW.isoformat())

        try:
            import poeninja
            m = poeninja.write_meta_json()
            log(f"✓ meta.json (poe.ninja): {len(m['ascendancies'])} asc, {len(m['currency'])} cur")
        except Exception as e:
            log(f"! poe.ninja meta failed: {e}")

        export_feed(lim.get("feed", 60))
        stats = {"videos": len(videos), "news": len(news), "reddit": len(reddit), "analyzed": analyzed}
        finish_run(run_id, True, stats)
        log(f"✓ DB updated + feed.json exported — {stats}, league {league}")
    except Exception as e:
        finish_run(run_id, False, {"error": str(e)})
        raise

def export_feed(limit):
    meta = get_meta_dict()
    feed = {"generated_at": meta["last_updated"], "league": meta["league"],
            "counts": meta["counts"], "items": get_feed(limit=limit)}
    (WEB_DATA / "feed.json").write_text(json.dumps(feed, ensure_ascii=False, indent=2), encoding="utf-8")

if __name__ == "__main__":
    main()
