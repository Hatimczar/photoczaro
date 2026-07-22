#!/usr/bin/env python3
"""
Submit all photoczaro.com URLs to Bing + Yandex + Seznam via IndexNow.
Run once after each deploy: python3 indexnow_submit.py
"""
import urllib.request, json

KEY  = "2412699535ea4bb3898250ab1aa9e0f3"
HOST = "photoczaro.com"

URLS = [
    "https://photoczaro.com/",
    "https://photoczaro.com/journal.html",
    "https://photoczaro.com/blog/modeling-portfolio-dubai-guide.html",
    "https://photoczaro.com/blog/fujifilm-x100vi-review.html",
    "https://photoczaro.com/blog/malvie-magazine-interview.html",
    "https://photoczaro.com/blog/shooting-golden-hour-dubai.html",
    "https://photoczaro.com/blog/sony-a7cr-portrait-photographer.html",
    # Translated pages
    "https://photoczaro.com/fr/",
    "https://photoczaro.com/fr/journal.html",
    "https://photoczaro.com/fr/blog/modeling-portfolio-dubai-guide.html",
    "https://photoczaro.com/ru/",
    "https://photoczaro.com/ru/journal.html",
    "https://photoczaro.com/ru/blog/modeling-portfolio-dubai-guide.html",
    "https://photoczaro.com/es/",
    "https://photoczaro.com/es/journal.html",
    "https://photoczaro.com/es/blog/modeling-portfolio-dubai-guide.html",
    "https://photoczaro.com/cs/",
    "https://photoczaro.com/cs/journal.html",
    "https://photoczaro.com/cs/blog/modeling-portfolio-dubai-guide.html",
]

PAYLOAD = json.dumps({
    "host": HOST,
    "key": KEY,
    "keyLocation": f"https://{HOST}/{KEY}.txt",
    "urlList": URLS,
}).encode()

# Bing, Yandex, and Seznam all accept the same IndexNow endpoint format
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
