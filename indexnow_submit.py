#!/usr/bin/env python3
"""
Submit photoczaro.com URLs to Bing + Yandex + Seznam via IndexNow.

Reads the URL list from sitemap.xml, so new pages are included automatically.
Yandex Webmaster shows IndexNow as the source for most pages it picks up, so run
this after each deploy.

  python3 indexnow_submit.py --days 3      # URLs whose <lastmod> is within the last 3 days (default 3)
  python3 indexnow_submit.py --all         # every URL in the sitemap
  python3 indexnow_submit.py --dry-run     # list what would be sent, send nothing
"""
import argparse, datetime, json, re, urllib.request, urllib.error
from pathlib import Path

KEY  = "2412699535ea4bb3898250ab1aa9e0f3"
HOST = "photoczaro.com"
SITEMAP = Path(__file__).with_name("sitemap.xml")
ENDPOINTS = [
    "https://www.bing.com/indexnow",
    "https://yandex.com/indexnow",
    "https://search.seznam.cz/indexnow",
]

ap = argparse.ArgumentParser()
ap.add_argument("--days", type=int, default=3)
ap.add_argument("--all", action="store_true")
ap.add_argument("--dry-run", action="store_true")
args = ap.parse_args()

xml = SITEMAP.read_text(encoding="utf-8")
cutoff = datetime.date.today() - datetime.timedelta(days=args.days)
urls = []
for block in re.findall(r"<url>(.*?)</url>", xml, re.S):
    loc = re.search(r"<loc>([^<]+)</loc>", block).group(1).strip()
    lm = re.search(r"<lastmod>([^<]+)</lastmod>", block)
    if args.all or (lm and datetime.date.fromisoformat(lm.group(1).strip()[:10]) >= cutoff):
        urls.append(loc)
urls = sorted(set(urls))[:10000]
print(f"{len(urls)} URLs selected" + (" (all)" if args.all else f" (lastmod within {args.days} days)"))
if args.dry_run or not urls:
    print("\n".join(urls[:20]) + ("\n..." if len(urls) > 20 else ""))
    raise SystemExit(0)

payload = json.dumps({"host": HOST, "key": KEY, "keyLocation": f"https://{HOST}/{KEY}.txt", "urlList": urls}).encode()
for endpoint in ENDPOINTS:
    req = urllib.request.Request(endpoint, data=payload, headers={"Content-Type": "application/json; charset=utf-8"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            print(f"{endpoint} -> {r.status}")
    except urllib.error.HTTPError as e:
        print(f"{endpoint} -> HTTP {e.code}: {e.read().decode()[:200]}")
    except Exception as e:
        print(f"{endpoint} -> ERROR: {e}")
