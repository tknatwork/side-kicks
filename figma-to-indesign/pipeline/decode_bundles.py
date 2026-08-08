"""Decode figma-limitless image bundles into OriginalImages/<hash>.<ext>.

Usage: python3 decode_bundles.py <bundle.txt> [...]
Each bundle is a persisted execute_code tool result: JSON with
{"result": {"kind": "IMGB", "items": [[hash, base64], ...], "shapes": {...}|null,
            "textsup": {...}|null, "failsList": [...]|null }}
Writes images, appends hash meta (ext, pxw, pxh) into extract8/hashmeta.json,
and writes shapes.json / textsup.json when present.
"""

import base64
import json
import os
import struct
import sys

E8 = "/private/tmp/claude-501/-Users-tusharkant-Github-Project-Others-Akanksha/65220df8-93bf-4fdf-bfee-1d7c3882084a/scratchpad/extract8"
OUTDIR = "/Users/tusharkant/Github Project/Others/Akanksha/OriginalImages"
META = os.path.join(E8, "hashmeta.json")


def sniff(b):
    if b[:2] == b"\xff\xd8":
        return "jpg"
    if b[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if b[:6] in (b"GIF87a", b"GIF89a"):
        return "gif"
    if b[:4] == b"RIFF" and b[8:12] == b"WEBP":
        return "webp"
    return "bin"


def png_size(b):
    w, h = struct.unpack(">II", b[16:24])
    return w, h


def jpg_size(b):
    i = 2
    while i < len(b) - 9:
        if b[i] != 0xFF:
            i += 1
            continue
        m = b[i + 1]
        if m in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7,
                 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
            h, w = struct.unpack(">HH", b[i + 5:i + 9])
            return w, h
        ln = struct.unpack(">H", b[i + 2:i + 4])[0]
        i += 2 + ln
    return 0, 0


def gif_size(b):
    w, h = struct.unpack("<HH", b[6:10])
    return w, h


def size_of(ext, b):
    try:
        if ext == "png":
            return png_size(b)
        if ext == "jpg":
            return jpg_size(b)
        if ext == "gif":
            return gif_size(b)
    except Exception:
        pass
    return 0, 0


def main(paths):
    os.makedirs(OUTDIR, exist_ok=True)
    meta = json.load(open(META)) if os.path.exists(META) else {}
    wrote = 0
    for p in paths:
        d = json.loads(open(p).read())
        r = d.get("result", d)
        for h, b64 in r.get("items", []):
            b = base64.b64decode(b64)
            ext = sniff(b)
            w, hh = size_of(ext, b)
            with open(os.path.join(OUTDIR, "%s.%s" % (h, ext)), "wb") as fh:
                fh.write(b)
            meta[h] = [ext, w, hh]
            wrote += 1
        if r.get("shapes"):
            json.dump(r["shapes"], open(os.path.join(E8, "shapes.json"), "w"))
            print("shapes.json written (%d)" % len(r["shapes"]))
        if r.get("textsup"):
            json.dump(r["textsup"], open(os.path.join(E8, "textsup.json"), "w"))
            print("textsup.json written (%d)" % len(r["textsup"]))
        if r.get("failsList"):
            json.dump(r["failsList"], open(os.path.join(E8, "fails.json"), "w"))
            print("fails.json written (%d)" % len(r["failsList"]))
    json.dump(meta, open(META, "w"))
    zero = [h for h, m in meta.items() if not m[1]]
    print("decoded %d images | meta total %d | zero-size %d %s"
          % (wrote, len(meta), len(zero), zero[:3]))


if __name__ == "__main__":
    main(sys.argv[1:])
