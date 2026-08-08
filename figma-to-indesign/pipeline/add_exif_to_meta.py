"""Add EXIF orientation and display dimensions to hashmeta.json.

hashmeta entries become [ext, rawW, rawH, orientation, dispW, dispH].

Figma renders an image with its EXIF orientation applied and expresses crop
rectangles in that display space. An image referenced from IDML, however, is drawn
from its raw pixels with no orientation applied, so the builder needs both: display
dimensions to interpret the crop, raw dimensions to place the actual pixels.
"""

import json
import os
import sys

sys.path.insert(0, "/Users/tusharkant/Github Project/Others/Akanksha/scripts")
from scan_exif import exif_orientation

E8 = ("/private/tmp/claude-501/-Users-tusharkant-Github-Project-Others-Akanksha/"
      "65220df8-93bf-4fdf-bfee-1d7c3882084a/scratchpad/extract8")
IMGS = "/Users/tusharkant/Github Project/Others/Akanksha/OriginalImages"
SWAPPED = (5, 6, 7, 8)          # these quarter-turn orientations transpose the image


def main():
    meta = json.load(open(os.path.join(E8, "hashmeta.json")))
    by_hash = {}
    for f in os.listdir(IMGS):
        if not f.startswith("."):
            by_hash[f.split(".")[0]] = f

    counts, missing = {}, 0
    for h, m in meta.items():
        f = by_hash.get(h)
        if not f:
            missing += 1
            continue
        o = exif_orientation(os.path.join(IMGS, f)) or 1
        rw, rh = m[1], m[2]
        dw, dh = (rh, rw) if o in SWAPPED else (rw, rh)
        meta[h] = [m[0], rw, rh, o, dw, dh]
        counts[o] = counts.get(o, 0) + 1

    json.dump(meta, open(os.path.join(E8, "hashmeta.json"), "w"))
    print("updated %d entries (missing files: %d)" % (len(meta), missing))
    for o in sorted(counts):
        print("  orientation %d: %d%s" % (o, counts[o], "  (dims transposed)" if o in SWAPPED else ""))


if __name__ == "__main__":
    main()
