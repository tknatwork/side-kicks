"""Check every placed image in the InDesign document against the Figma extract.

Compares, per image node: the frame rectangle and the placed graphic's rectangle
(position + size), where the graphic rectangle encodes the crop — FILL images are
scaled to cover and centred, CROP images are positioned by Figma's imageTransform.
A match here means the picture shows the same region of the same pixels at the same
place on the page, which is what "looks like the Figma frame" reduces to.

Bounds from InDesign are spread-relative, so a recto page's items carry a +842pt
x offset. Rotated items are reported separately: their bounds are in item space and
are not comparable this way.

Run after scripts/dump-geometry.jsx has written scripts/geometry-dump.csv.
"""

import csv
import json
import os

E8 = ("/private/tmp/claude-501/-Users-tusharkant-Github-Project-Others-Akanksha/"
      "65220df8-93bf-4fdf-bfee-1d7c3882084a/scratchpad/extract8")
PROJ = "/Users/tusharkant/Github Project/Others/Akanksha"
PW, PH = 842.0, 595.0
TOL = 1.0
STRAY = {"3177:2727", "3177:2728", "3177:3338"}


def content_tf(mode, xf, w, h, sw, sh):
    if sw <= 0 or sh <= 0:
        return 1, 1, 0, 0
    if mode == "CROP" and xf:
        a, _c, tx, _b, d, ty = xf
        a = a if abs(a) > 1e-6 else 1.0
        d = d if abs(d) > 1e-6 else 1.0
        dw, dh = w / a, h / d
        return dw / sw, dh / sh, -tx * dw, -ty * dh
    if mode == "FIT":
        s = min(w / sw, h / sh)
        return s, s, (w - sw * s) / 2, (h - sh * s) / 2
    s = max(w / sw, h / sh)
    return s, s, (w - sw * s) / 2, (h - sh * s) / 2


def main():
    ex = json.load(open(os.path.join(E8, "extract.json")))
    frames = ex["ex"]["frames"]
    order = json.load(open(os.path.join(E8, "order.json")))
    meta = json.load(open(os.path.join(E8, "hashmeta.json")))
    pos = {fid: i + 1 for i, fid in enumerate(order)}

    exp = {}
    for fid, f in frames.items():
        off = PW if f["cx"] >= 500 else 0.0
        for r in f["rects"]:
            if not r[5] or r[0] in STRAY:
                continue
            m = meta.get(r[5])
            if not m:
                continue
            x, y, w, h = r[1], r[2], r[3], r[4]
            if x + w <= 0 or x >= PW or y + h <= 0 or y >= PH:
                continue                      # dropped: invisible behind the frame clip
            # Crops are expressed against the EXIF-corrected (display) image.
            dpw, dph = (m[4], m[5]) if len(m) > 5 else (m[1], m[2])
            sx, sy, ox, oy = content_tf(r[6], r[7], w, h, dpw, dph)
            # The builder trims an overflowing frame to the page (Figma's frames clip,
            # InDesign's pages do not); the picture inside keeps its position, so only
            # the frame rectangle changes.
            cx, cy = max(x, 0.0), max(y, 0.0)
            cw = min(x + w, PW) - cx
            chh = min(y + h, PH) - cy
            if abs(r[15]) > 1:
                cx, cy, cw, chh = x, y, w, h        # rotated items are not trimmed
            exp[r[0].replace(":", "-")] = dict(
                seq=pos[fid], page=pos[fid] + 1, frame=f["name"], mode=r[6], ang=r[15],
                fx=cx + off, fy=cy, fw=cw, fh=chh,
                ix=x + off + ox, iy=y + oy, iw=dpw * sx, ih=dph * sy)

    rows = list(csv.DictReader(open(os.path.join(PROJ, "scripts/geometry-dump.csv"))))
    bad_frame, bad_img, unmatched, rotated = [], [], [], 0
    for row in rows:
        e = exp.get(row["node"])
        if not e:
            unmatched.append((row["page"], row["node"], row["link"][:16]))
            continue
        if abs(e["ang"]) > 1:
            rotated += 1
            continue
        df = max(abs(float(row["fx"]) - e["fx"]), abs(float(row["fy"]) - e["fy"]),
                 abs(float(row["fw"]) - e["fw"]), abs(float(row["fh"]) - e["fh"]))
        di = max(abs(float(row["ix"]) - e["ix"]), abs(float(row["iy"]) - e["iy"]),
                 abs(float(row["iw"]) - e["iw"]), abs(float(row["ih"]) - e["ih"]))
        if df > TOL:
            bad_frame.append((e["page"], row["node"], e["frame"], round(df, 1)))
        if di > TOL:
            bad_img.append((e["page"], row["node"], e["frame"], e["mode"], round(di, 1)))

    print("placed images: %d   expectations: %d   rotated (skipped): %d"
          % (len(rows), len(exp), rotated))
    print("frame-rect mismatches >%.0fpt: %d" % (TOL, len(bad_frame)))
    for b in bad_frame[:10]:
        print("   page %s %s (%s) off by %spt" % b)
    print("crop/scale mismatches >%.0fpt: %d" % (TOL, len(bad_img)))
    for b in bad_img[:10]:
        print("   page %s %s (%s) %s off by %spt" % b)
    print("images with no expectation: %d" % len(unmatched))
    for u in unmatched[:10]:
        print("   ", u)

    ppis = sorted(int(r["ppi"]) for r in rows if r["ppi"].isdigit() and int(r["ppi"]) > 0)
    if ppis:
        print("\neffective ppi: min=%d p10=%d median=%d max=%d | below300=%d of %d"
              % (ppis[0], ppis[len(ppis) // 10], ppis[len(ppis) // 2], ppis[-1],
                 sum(1 for p in ppis if p < 300), len(ppis)))
    return len(bad_frame) + len(bad_img) + len(unmatched)


if __name__ == "__main__":
    raise SystemExit(1 if main() else 0)
