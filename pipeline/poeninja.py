"""
poe.ninja PoE2 connector — live meta (ascendancy usage) + currency prices.
Keyless. Writes web/data/meta.json (same static model as feed.json).

Endpoints discovered:
  meta:     https://poe.ninja/poe2/api/data/build-index-state         -> leagueBuilds[].statistics
  economy:  https://poe.ninja/poe2/api/economy/exchange/current/overview?league=<L>&type=Currency
"""
from __future__ import annotations
import json, sys, urllib.request, urllib.parse
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WEB_DATA = ROOT / "web" / "data"
BASE = "https://poe.ninja/poe2"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")


def _get(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.loads(r.read().decode("utf-8"))


def fetch_meta() -> dict:
    """Popular ascendancies for the current (non-HC) league."""
    b = _get(f"{BASE}/api/data/build-index-state")
    lb = b.get("leagueBuilds") or []
    cur = next((x for x in lb if not x.get("hardcore") and x.get("statistics")), lb[0] if lb else {})
    asc = [{"name": s["class"], "pct": round(s.get("percentage", 0), 1), "trend": s.get("trend", 0)}
           for s in cur.get("statistics", [])][:10]
    return {"league": cur.get("leagueName"), "total": cur.get("total"), "ascendancies": asc}


def fetch_economy(league: str) -> tuple[list, str]:
    """Top currencies by value, with sparkline + 24h-ish delta. Returns (rows, unit_name)."""
    url = f"{BASE}/api/economy/exchange/current/overview?league={urllib.parse.quote(league)}&type=Currency"
    j = _get(url)
    by = {it["id"]: it for it in j.get("items", [])}
    unit = by.get((j.get("core") or {}).get("primary"), {}).get("name", "ex")
    rows = []
    for l in j.get("lines", []):
        it = by.get(l.get("id"))
        if not it:
            continue
        spark = l.get("sparkline")
        data = spark.get("data") if isinstance(spark, dict) else spark
        data = [x for x in (data or []) if isinstance(x, (int, float))]
        # sparkline points are % change vs period start; last point = total change
        delta = round(data[-1], 1) if data else 0.0
        rows.append({
            "name": it.get("name"), "value": l.get("primaryValue"),
            "spark": data, "delta": delta, "vol": l.get("volumePrimaryValue") or 0,
        })
    rows.sort(key=lambda r: r["value"] or 0, reverse=True)
    return rows, unit


def write_meta_json(path=None) -> dict:
    path = Path(path) if path else WEB_DATA / "meta.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    meta = fetch_meta()
    league = meta.get("league") or "Runes of Aldur"
    currency, unit = [], "ex"
    try:
        currency, unit = fetch_economy(league)
    except Exception as e:
        print(f"! economy failed: {e}", file=sys.stderr)
    out = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": "poe.ninja", "league": league, "unit": unit, "total": meta.get("total"),
        "ascendancies": meta["ascendancies"], "currency": currency[:10],
    }
    path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    return out


if __name__ == "__main__":
    o = write_meta_json()
    print(f"meta.json: {len(o['ascendancies'])} ascendancies, {len(o['currency'])} currencies, "
          f"league={o['league']}, unit={o['unit']}", file=sys.stderr)
