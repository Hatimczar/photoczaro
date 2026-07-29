#!/usr/bin/env python3
"""
Submit all photoczaro.com URLs to Bing + Yandex + Seznam via IndexNow.
Run once after each deploy: python3 indexnow_submit.py
"""
import urllib.request, json

KEY  = "2412699535ea4bb3898250ab1aa9e0f3"
HOST = "photoczaro.com"

URLS = [
    # Main pages
    "https://photoczaro.com/",
    "https://photoczaro.com/journal",
    "https://photoczaro.com/work-with-me",
    "https://photoczaro.com/for-agencies",
    "https://photoczaro.com/ru/for-agencies",
    # English blog posts
    "https://photoczaro.com/blog/what-its-like-to-work-with-me",
    "https://photoczaro.com/blog/best-modeling-agencies-dubai",
    "https://photoczaro.com/blog/fujifilm-x100vi-review",
    "https://photoczaro.com/blog/shooting-golden-hour-dubai",
    "https://photoczaro.com/blog/malvie-magazine-interview",
    "https://photoczaro.com/blog/sony-a7cr-portrait-photographer",
    "https://photoczaro.com/blog/modeling-portfolio-dubai-guide",
    "https://photoczaro.com/blog/start-modeling-dubai-no-experience",
    "https://photoczaro.com/blog/photoshoot-cost-dubai",
    # French
    "https://photoczaro.com/fr/",
    "https://photoczaro.com/fr/journal",
    "https://photoczaro.com/fr/blog/fujifilm-x100vi-review",
    "https://photoczaro.com/fr/blog/shooting-golden-hour-dubai",
    "https://photoczaro.com/fr/blog/malvie-magazine-interview",
    "https://photoczaro.com/fr/blog/sony-a7cr-portrait-photographer",
    "https://photoczaro.com/fr/blog/modeling-portfolio-dubai-guide",
    "https://photoczaro.com/fr/blog/start-modeling-dubai-no-experience",
    "https://photoczaro.com/fr/blog/photoshoot-cost-dubai",
    "https://photoczaro.com/fr/blog/what-its-like-to-work-with-me",
    "https://photoczaro.com/fr/blog/best-modeling-agencies-dubai",
    # Russian
    "https://photoczaro.com/ru/",
    "https://photoczaro.com/ru/journal",
    "https://photoczaro.com/ru/blog/fujifilm-x100vi-review",
    "https://photoczaro.com/ru/blog/shooting-golden-hour-dubai",
    "https://photoczaro.com/ru/blog/malvie-magazine-interview",
    "https://photoczaro.com/ru/blog/sony-a7cr-portrait-photographer",
    "https://photoczaro.com/ru/blog/modeling-portfolio-dubai-guide",
    "https://photoczaro.com/ru/blog/start-modeling-dubai-no-experience",
    "https://photoczaro.com/ru/blog/photoshoot-cost-dubai",
    "https://photoczaro.com/ru/blog/what-its-like-to-work-with-me",
    "https://photoczaro.com/ru/blog/best-modeling-agencies-dubai",
    # Spanish
    "https://photoczaro.com/es/",
    "https://photoczaro.com/es/journal",
    "https://photoczaro.com/es/blog/fujifilm-x100vi-review",
    "https://photoczaro.com/es/blog/shooting-golden-hour-dubai",
    "https://photoczaro.com/es/blog/malvie-magazine-interview",
    "https://photoczaro.com/es/blog/sony-a7cr-portrait-photographer",
    "https://photoczaro.com/es/blog/modeling-portfolio-dubai-guide",
    "https://photoczaro.com/es/blog/start-modeling-dubai-no-experience",
    "https://photoczaro.com/es/blog/photoshoot-cost-dubai",
    "https://photoczaro.com/es/blog/what-its-like-to-work-with-me",
    "https://photoczaro.com/es/blog/best-modeling-agencies-dubai",
    # Czech
    "https://photoczaro.com/cs/",
    "https://photoczaro.com/cs/journal",
    "https://photoczaro.com/cs/blog/fujifilm-x100vi-review",
    "https://photoczaro.com/cs/blog/shooting-golden-hour-dubai",
    "https://photoczaro.com/cs/blog/malvie-magazine-interview",
    "https://photoczaro.com/cs/blog/sony-a7cr-portrait-photographer",
    "https://photoczaro.com/cs/blog/modeling-portfolio-dubai-guide",
    "https://photoczaro.com/cs/blog/start-modeling-dubai-no-experience",
    "https://photoczaro.com/cs/blog/photoshoot-cost-dubai",
    "https://photoczaro.com/cs/blog/what-its-like-to-work-with-me",
    "https://photoczaro.com/cs/blog/best-modeling-agencies-dubai",
    # Other
    "https://photoczaro.com/privacy-policy",
]

PAYLOAD = json.dumps({
    "host": HOST,
    "key": KEY,
    "keyLocation": f"https://{HOST}/{KEY}.txt",
    "urlList": URLS,
}).encode()

ENDPOINTS = [
    "https://www.bing.com/indexnow",
    "https://yandex.com/indexnow",
    "https://search.seznam.cz/indexnow",
]

for endpoint in ENDPOINTS:
    req = urllib.request.Request(
        endpoint,
        data=PAYLOAD,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            print(f"{endpoint} → {r.status}")
    except urllib.error.HTTPError as e:
        print(f"{endpoint} → HTTP {e.code}: {e.read().decode()}")
    except Exception as e:
        print(f"{endpoint} → ERROR: {e}")
