"""Download raw-image URLs from a download_assets response into OriginalImages/.

Usage: echo '<download_assets JSON>' | python3 harvest_batch.py
Files are named by sha1 of their content (== Figma imageHash) + sniffed extension.
Updates extract8/hashmeta.json and prints progress: total needed vs on disk.
"""

import hashlib
import json
import os
import struct
import subprocess
import sys

E8 = ("/private/tmp/claude-501/-Users-tusharkant-Github-Project-Others-Akanksha/"
      "65220df8-93bf-4fdf-bfee-1d7c3882084a/scratchpad/extract8")
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


def size_of(ext, b):
    try:
        if ext == "png":
            return struct.unpack(">II", b[16:24])
        if ext == "gif":
            return struct.unpack("<HH", b[6:10])
        if ext == "jpg":
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
                i += 2 + struct.unpack(">H", b[i + 2:i + 4])[0]
        if ext == "webp":
            if b[12:16] == b"VP8X":
                w = int.from_bytes(b[24:27], "little") + 1
                h = int.from_bytes(b[27:30], "little") + 1
                return w, h
            if b[12:16] == b"VP8 ":
                w, h = struct.unpack("<HH", b[26:30])
                return w & 0x3FFF, h & 0x3FFF
    except Exception:
        pass
    return 0, 0


def needed():
    d = json.load(open(os.path.join(E8, "extract.json")))
    hs = set()
    for f in d["ex"]["frames"].values():
        for r in f["rects"]:
            if r[5]:
                hs.add(r[5])
    return hs


def on_disk():
    return {f.rsplit(".", 1)[0] for f in os.listdir(OUTDIR) if not f.startswith(".")}


def main():
    os.makedirs(OUTDIR, exist_ok=True)
    raw = sys.stdin.read()
    start = raw.find("{")
    data, _ = json.JSONDecoder().raw_decode(raw[start:])
    urls = [r["url"] for r in data.get("rawImages", [])]
    meta = json.load(open(META)) if os.path.exists(META) else {}
    need = needed()
    got, dup, alien = 0, 0, 0
    for u in urls:
        try:
            b = subprocess.run(["curl", "-sL", "-m", "120", u],
                               capture_output=True, check=True).stdout
            if len(b) < 50:
                print("TINY", u[-20:], len(b))
                continue
            h = hashlib.sha1(b).hexdigest()
            ext = sniff(b)
            w, hh = size_of(ext, b)
            if h not in need:
                alien += 1
                continue
            p = os.path.join(OUTDIR, "%s.%s" % (h, ext))
            if os.path.exists(p):
                dup += 1
                continue
            with open(p, "wb") as fh:
                fh.write(b)
            meta[h] = [ext, int(w), int(hh)]
            got += 1
        except Exception as e:
            print("ERR", u[-24:], str(e)[:80])
    json.dump(meta, open(META, "w"))
    disk = on_disk()
    print("batch: new=%d dup=%d alien=%d | disk %d / needed %d | missing %d"
          % (got, dup, alien, len(disk & need), len(need), len(need - disk)))


if __name__ == "__main__":
    main()
