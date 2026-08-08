"""Report EXIF orientation for every original image.

Matters because Figma renders an image with its EXIF orientation applied and
expresses crop rectangles in that display space, while the stored pixels (and the
width/height read from the JPEG header) are in raw space. Where the two differ, a
crop computed in raw coordinates selects the wrong region.
"""

import collections
import os
import struct

OUT = "/Users/tusharkant/Github Project/Others/Akanksha/OriginalImages"


def exif_orientation(path):
    try:
        d = open(path, "rb").read(256 * 1024)
    except Exception:
        return None
    if d[:2] != b"\xff\xd8":
        return 1                      # PNG/GIF/WebP here carry no EXIF orientation
    i = 2
    while i < len(d) - 4:
        if d[i] != 0xFF:
            i += 1
            continue
        m = d[i + 1]
        if m in (0xD8, 0xD9):
            i += 2
            continue
        if i + 4 > len(d):
            break
        ln = struct.unpack(">H", d[i + 2:i + 4])[0]
        if m == 0xE1:
            seg = d[i + 4:i + 2 + ln]
            if seg[:6] == b"Exif\x00\x00":
                t = seg[6:]
                bo = ">" if t[:2] == b"MM" else "<"
                try:
                    off = struct.unpack(bo + "I", t[4:8])[0]
                    n = struct.unpack(bo + "H", t[off:off + 2])[0]
                    for k in range(n):
                        e = off + 2 + k * 12
                        tag = struct.unpack(bo + "H", t[e:e + 2])[0]
                        if tag == 0x0112:
                            return struct.unpack(bo + "H", t[e + 8:e + 10])[0]
                except Exception:
                    return 1
            return 1
        if m in (0xDA,):
            break
        i += 2 + ln
    return 1


def main():
    counts = collections.Counter()
    odd = []
    for f in sorted(os.listdir(OUT)):
        if f.startswith("."):
            continue
        o = exif_orientation(os.path.join(OUT, f)) or 1
        counts[o] += 1
        if o != 1:
            odd.append((f.split(".")[0][:12], o))
    names = {1: "normal", 2: "mirror-h", 3: "rotate-180", 4: "mirror-v",
             5: "transpose", 6: "rotate-90-cw", 7: "transverse", 8: "rotate-90-ccw"}
    print("EXIF orientation across %d originals:" % sum(counts.values()))
    for o, n in sorted(counts.items()):
        print("  %d (%-12s): %d" % (o, names.get(o, "?"), n))
    print("\nneeding correction: %d" % len(odd))
    for f, o in odd[:15]:
        print("   ", f, o)


if __name__ == "__main__":
    main()
