"""
Telegram posting for EXILE HUB (stdlib only, no deps).

Config via env:
  TELEGRAM_BOT_TOKEN   from @BotFather
  TELEGRAM_CHAT_ID     channel like "@my_poe2" or a numeric chat id

Without a token everything runs in DRY-RUN: format_post/send return the payload
that WOULD be sent, so the admin composer preview works before you wire the bot.
"""
from __future__ import annotations
import os, re, json, html
import urllib.request, urllib.error

API = "https://api.telegram.org/bot{token}/{method}"
EMOJI = {"video": "🎬", "news": "📰", "reddit": "😹"}


def configured() -> bool:
    return bool(os.environ.get("TELEGRAM_BOT_TOKEN") and os.environ.get("TELEGRAM_CHAT_ID"))


def _h(s: str) -> str:
    return html.escape(str(s or ""), quote=False)


def format_post(item: dict) -> str:
    """Build a nice Telegram post (HTML parse_mode) from a feed item + its digest."""
    d = item.get("digest") or {}
    emoji = EMOJI.get(item.get("type"), "🔥")
    lines = [f"{emoji} <b>{_h(item.get('title'))}</b>"]

    who = item.get("channel") or item.get("source")
    if who:
        lines.append(f"<i>{_h(who)}</i>")

    if d.get("tldr"):
        lines += ["", _h(d["tldr"])]
    elif item.get("snippet"):
        lines += ["", _h(item["snippet"])]

    pts = d.get("points") or []
    if pts:
        lines.append("")
        lines += [f"• {_h(p)}" for p in pts[:5]]

    if item.get("url"):
        lines += ["", _h(item["url"])]

    tags = d.get("tags") or []
    if tags:
        lines += ["", " ".join(_hashtag(t) for t in tags[:5])]

    return "\n".join(lines)


def _hashtag(t: str) -> str:
    # Telegram hashtags break on spaces/hyphens/dots -> normalize to word chars + underscore
    return "#" + re.sub(r"[^\w]", "", re.sub(r"[\s\-.]+", "_", _h(t)))


def send(text: str, item: dict | None = None, dry_run: bool | None = None) -> dict:
    """Send a message to the configured channel. Dry-run if no token (or forced)."""
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    chat = os.environ.get("TELEGRAM_CHAT_ID")
    payload = {"chat_id": chat, "text": text, "parse_mode": "HTML",
               "disable_web_page_preview": False}

    if dry_run or not (token and chat):
        return {"ok": True, "dry_run": True, "reason": "нет TELEGRAM_BOT_TOKEN/CHAT_ID" if not token else "forced",
                "preview": text, "payload": payload}

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(API.format(token=token, method="sendMessage"), data=data,
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            res = json.loads(r.read().decode("utf-8"))
        return {"ok": bool(res.get("ok")), "dry_run": False, "result": res.get("result", {})}
    except urllib.error.HTTPError as e:
        return {"ok": False, "dry_run": False, "error": f"HTTP {e.code}: {e.read().decode('utf-8', 'replace')[:300]}"}
    except Exception as e:
        return {"ok": False, "dry_run": False, "error": str(e)}
