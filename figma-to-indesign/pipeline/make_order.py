"""Derive page reading order from canvas position and write order.json + the page map.

The Figma frame names are not in reading order, so pages are sequenced by where the
frames sit on the canvas: rows top to bottom, then left to right within a row.

Row grouping tolerance: frames in one row are nominally at the same y, but a designer
nudge can leave a few points of drift — A4-848 and A4-853 differ by 6pt. A 5pt
tolerance split that pair into two single-frame rows and swapped those two pages.
Row spacing is ~700pt, so anything from 20 to 200 yields the same 204 clean pairs;
20 sits safely inside that plateau.
"""

import csv
import json
import os

E8 = ("/private/tmp/claude-501/-Users-tusharkant-Github-Project-Others-Akanksha/"
      "65220df8-93bf-4fdf-bfee-1d7c3882084a/scratchpad/extract8")
PROJ = "/Users/tusharkant/Github Project/Others/Akanksha"
ROW_TOL = 20.0
MID_X = 500.0          # canvas x separating the left and right columns


def main():
    ex = json.load(open(os.path.join(E8, "extract.json")))
    frames = ex["ex"]["frames"]
    fl = sorted((f["cy"], f["cx"], fid) for fid, f in frames.items())

    rows, cur = [], [fl[0]]
    for e in fl[1:]:
        if abs(e[0] - cur[0][0]) <= ROW_TOL:
            cur.append(e)
        else:
            rows.append(cur)
            cur = [e]
    rows.append(cur)

    order, problems = [], []
    for r in rows:
        r.sort(key=lambda e: e[1])
        if len(r) != 2:
            problems.append(("row is not a pair", [frames[e[2]]["name"] for e in r]))
        elif not (r[0][1] < MID_X <= r[1][1]):
            problems.append(("row is not left+right", [frames[e[2]]["name"] for e in r]))
        order += [e[2] for e in r]

    json.dump(order, open(os.path.join(E8, "order.json"), "w"))

    with open(os.path.join(PROJ, "Page-to-Figma-map-v2.csv"), "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["seq", "indesign_page_name", "figma_frame_id", "figma_frame_name",
                    "column", "texts", "images", "title"])
        for i, fid in enumerate(order):
            f = frames[fid]
            title = ""
            for t in f["texts"]:
                if t[6] and t[6][0][2] >= 30:
                    title = t[5].replace("\n", " ")[:60]
                    break
            w.writerow([i + 1, i + 2, fid, f["name"],
                        "verso(L)" if f["cx"] < MID_X else "recto(R)",
                        len(f["texts"]), sum(1 for r in f["rects"] if r[5]), title])

    print("rows=%d pages=%d problems=%d" % (len(rows), len(order), len(problems)))
    for p in problems:
        print("  ", p)


if __name__ == "__main__":
    main()
