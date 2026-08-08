"""Compare every InDesign page against its Figma frame and rank the differences.

Both sides are reduced to a small greyscale grid and compared cell by cell. That is
deliberately coarse: it will not care about hinting or a half-point of leading, but
it does catch the failures that matter — a wrong picture, a crop showing the wrong
region, a missing or displaced element.

The Figma renders come from the plugin. Note that it *reports* each frame's own
(portrait) dimensions but writes the PNG in canvas orientation, so the files are
already landscape and need no rotation — worth checking rather than assuming, since
a wrongly rotated reference makes every page look broken.

Pages carrying a loose canvas item are reported separately: Figma's frame render
excludes page-level siblings, so a difference there is expected and not a defect.

Usage: python3 compare_pages.py [top_n]
"""

import json
import os
import sys

sys.path.insert(0, "/Users/tusharkant/Github Project/Others/Akanksha/scripts")
from png_stats import read_png

PROJ = "/Users/tusharkant/Github Project/Others/Akanksha"
E8 = ("/private/tmp/claude-501/-Users-tusharkant-Github-Project-Others-Akanksha/"
      "65220df8-93bf-4fdf-bfee-1d7c3882084a/scratchpad/extract8")
INDD = os.path.join(PROJ, "proofs/all")
FIGMA = os.path.join(PROJ, "figma_ref/all")
GW, GH = 24, 17           # grid over a 842x595 page


def grid(path, rotate_quarter=False):
    """Mean luminance per cell, sampled over a GW x GH grid."""
    w, h, nch, px = read_png(path)
    cells = []
    for gy in range(GH):
        for gx in range(GW):
            if rotate_quarter:
                sx0 = w * gy / GH
                sx1 = w * (gy + 1) / GH
                sy0 = h * (GW - 1 - gx) / GW
                sy1 = h * (GW - gx) / GW
            else:
                sx0, sx1 = w * gx / GW, w * (gx + 1) / GW
                sy0, sy1 = h * gy / GH, h * (gy + 1) / GH
            tot = cnt = 0
            y = sy0
            stepy = max(1.0, (sy1 - sy0) / 6)
            stepx = max(1.0, (sx1 - sx0) / 6)
            while y < sy1:
                iy = int(y)
                if 0 <= iy < h:
                    row = iy * w * nch
                    x = sx0
                    while x < sx1:
                        ix = int(x)
                        if 0 <= ix < w:
                            i = row + ix * nch
                            tot += (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) // 1000
                            cnt += 1
                        x += stepx
                y += stepy
            cells.append(tot / cnt if cnt else 255)
    return cells


def main():
    top_n = int(sys.argv[1]) if len(sys.argv) > 1 else 25
    ex = json.load(open(os.path.join(E8, "extract.json")))
    order = json.load(open(os.path.join(E8, "order.json")))
    frames = ex["ex"]["frames"]

    loose = set()
    LOOSE_IDS = set(json.load(open(os.path.join(E8, "loose_ids.json"))))
    for i, fid in enumerate(order):
        f = frames[fid]
        ids = {r[0] for r in f["rects"]} | {t[0] for t in f["texts"]}
        if ids & LOOSE_IDS:
            loose.add(i + 1)

    results, missing = [], 0
    for i, fid in enumerate(order):
        seq = i + 1
        a = os.path.join(INDD, "s%d.png" % seq)
        b = os.path.join(FIGMA, "s%d.png" % seq)
        if not (os.path.exists(a) and os.path.exists(b)):
            missing += 1
            continue
        ga = grid(a)
        gb = grid(b)
        diff = sum(abs(x - y) for x, y in zip(ga, gb)) / len(ga)
        results.append((diff, seq, frames[fid]["name"], seq in loose))

    results.sort(reverse=True)
    clean = [r for r in results if not r[3]]
    print("compared %d pages (missing %d)" % (len(results), missing))
    if clean:
        vals = sorted(r[0] for r in clean)
        print("difference (pages without loose items): median=%.1f  p90=%.1f  max=%.1f"
              % (vals[len(vals) // 2], vals[int(len(vals) * 0.9)], vals[-1]))
    print("\nworst %d pages:" % top_n)
    print("%-6s %-6s %-12s %-8s %s" % ("rank", "page", "frame", "diff", "note"))
    for n, (d, seq, name, is_loose) in enumerate(results[:top_n], 1):
        print("%-6d %-6d %-12s %-8.1f %s"
              % (n, seq + 1, name, d, "loose item (expected)" if is_loose else ""))
    json.dump([[r[1], r[0], r[3]] for r in results],
              open(os.path.join(E8, "page_diffs.json"), "w"))


if __name__ == "__main__":
    main()
