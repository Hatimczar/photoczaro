#!/usr/bin/env python3
"""
Responsive derivatives for Photoczaro Models roster photos.

For every image a model record references, this creates WebP versions at
320 / 640 / 960 / 1280 / 1600 px wide (never larger than the source), named
by a hash of the source bytes so a replaced photograph always gets new URLs:

    models/<slug>/<name>.<hash8>-<width>.webp

The same naming is used by the admin uploader and js/render.js
(variantKey). Originals are never touched or deleted, so existing inbound
URLs keep working.

Usage (needs Pillow; wrangler logged in for --upload/--kv):
    derive_model_images.py derive   # download sources, write ./derived + manifest.json, print byte report
    derive_model_images.py upload   # put derived files into the R2 bucket (additive)
    derive_model_images.py kv       # write imageSets into each model record (backs up records first)
"""
import hashlib, io, json, os, subprocess, sys, urllib.request, concurrent.futures as cf
from PIL import Image, ImageOps

ORIGIN = "https://models.photoczaro.com"
BUCKET = "photoczaro-models-media"
KV_NS = "248fb268a2d34eadbd4e0bc3f473d542"
WIDTHS = [320, 640, 960, 1280, 1600]
WORK = os.environ.get("DERIVE_WORK", "/private/tmp/akk")
QUALITY = 80

def sh(*a, **k):
    return subprocess.run(a, capture_output=True, text=True, cwd="models-site", **k)

def records():
    keys = json.loads(sh("npx", "wrangler", "kv", "key", "list", "--namespace-id", KV_NS, "--prefix", "model:", "--remote").stdout)
    out = {}
    for k in keys:
        out[k["name"]] = json.loads(sh("npx", "wrangler", "kv", "key", "get", k["name"], "--namespace-id", KV_NS, "--remote").stdout)
    return out

def image_keys(rec):
    im = rec.get("images") or {}
    return [v for v in [im.get("headshot"), im.get("fullFront"), im.get("fullSide")] + list(im.get("gallery") or []) if v]

def variant_key(key, h, w):
    base = key.rsplit(".", 1)[0]
    return f"{base}.{h}-{w}.webp"

def fetch(key):
    p = os.path.join(WORK, "media", key.replace("/", "__"))
    if not os.path.exists(p):
        os.makedirs(os.path.dirname(p), exist_ok=True)
        urllib.request.urlretrieve(f"{ORIGIN}/media/{key}", p)
    return p

def derive_one(key):
    src_path = fetch(key)
    raw = open(src_path, "rb").read()
    h = hashlib.sha256(raw).hexdigest()[:8]
    im = ImageOps.exif_transpose(Image.open(io.BytesIO(raw)))   # bake orientation in
    im.load()
    sw, sh_ = im.size
    is_webp = Image.open(io.BytesIO(raw)).format == "WEBP"
    widths = [w for w in WIDTHS if w < sw]
    top = min(sw, WIDTHS[-1])
    if top not in widths: widths.append(top)
    widths = sorted(set(widths))
    files = []
    for w in widths:
        out = os.path.join(WORK, "derived", variant_key(key, h, w).replace("/", "__"))
        os.makedirs(os.path.dirname(out), exist_ok=True)
        if w == sw and is_webp:                  # top size of a WebP source: keep the bytes, no re-encode
            open(out, "wb").write(raw)
        else:
            r = im if w == sw else im.resize((w, round(sh_ * w / sw)), Image.LANCZOS)
            if r.mode not in ("RGB", "RGBA"): r = r.convert("RGB")
            r.save(out, "WEBP", quality=QUALITY, method=6)   # metadata (EXIF/GPS) is not carried over
        files.append({"w": w, "key": variant_key(key, h, w), "bytes": os.path.getsize(out)})
    return {"key": key, "hash": h, "w": sw, "h": sh_, "srcBytes": len(raw), "variants": files}

def cmd_derive():
    recs = records()
    keys = []
    for r in recs.values(): keys += image_keys(r)
    with cf.ThreadPoolExecutor(4) as ex: res = list(ex.map(derive_one, keys))
    json.dump({"images": res, "records": {k: v.get("slug") for k, v in recs.items()}}, open(os.path.join(WORK, "manifest.json"), "w"), indent=1)
    tot_src = sum(r["srcBytes"] for r in res)
    tot_960 = sum(next((v["bytes"] for v in r["variants"] if v["w"] >= 640 and v["w"] <= 960), r["variants"][-1]["bytes"]) for r in res)
    print(f"{len(res)} images; originals {tot_src/1048576:.1f} MB; one mid-size (<=960) variant each {tot_960/1048576:.1f} MB")

def cmd_upload():
    m = json.load(open(os.path.join(WORK, "manifest.json")))
    jobs = [(v["key"], os.path.join(WORK, "derived", v["key"].replace("/", "__"))) for r in m["images"] for v in r["variants"]]
    def put(j):
        k, f = j
        r = sh("npx", "wrangler", "r2", "object", "put", f"{BUCKET}/{k}", "--file", os.path.join("..", f) if not f.startswith("/") else f, "--content-type", "image/webp", "--remote")
        return k, r.returncode
    with cf.ThreadPoolExecutor(4) as ex: res = list(ex.map(put, jobs))
    bad = [k for k, c in res if c]
    print(f"uploaded {len(res)-len(bad)}/{len(res)}", "FAILED: " + ", ".join(bad) if bad else "")

def cmd_kv():
    m = json.load(open(os.path.join(WORK, "manifest.json")))
    by_key = {r["key"]: r for r in m["images"]}
    recs = records()
    json.dump(recs, open(os.path.join(WORK, "records-backup.json"), "w"), ensure_ascii=False)
    for name, rec in recs.items():
        sets = {}
        for k in image_keys(rec):
            r = by_key.get(k)
            if r: sets[k] = {"v": r["hash"], "w": r["w"], "h": r["h"], "widths": [v["w"] for v in r["variants"]]}
        rec["imageSets"] = sets
        p = os.path.join(WORK, "kv-" + name.replace(":", "_") + ".json")
        json.dump(rec, open(p, "w"), ensure_ascii=False)
        r = sh("npx", "wrangler", "kv", "key", "put", name, "--path", p, "--namespace-id", KV_NS, "--remote")
        print(name, "ok" if r.returncode == 0 else "FAILED " + r.stderr[:200])

if __name__ == "__main__":
    {"derive": cmd_derive, "upload": cmd_upload, "kv": cmd_kv}[sys.argv[1]]()
