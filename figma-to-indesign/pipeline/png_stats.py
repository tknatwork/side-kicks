"""Minimal PNG reader + a grey-fraction metric, for comparing renders without PIL.

Used to check how much of a fabric-swatch frame is filled by the grey sofa
background: the fraction is rotation-invariant, so a Figma node render and an
InDesign page render can be compared directly even though one is rotated.

Usage: python3 png_stats.py <file.png> [x y w h]
"""

import sys
import zlib


def read_png(path):
    data = open(path, "rb").read()
    assert data[:8] == b"\x89PNG\r\n\x1a\n", "not a png"
    pos, idat, w, h, depth, ctype = 8, [], 0, 0, 0, 0
    while pos < len(data):
        ln = int.from_bytes(data[pos:pos + 4], "big")
        typ = data[pos + 4:pos + 8]
        body = data[pos + 8:pos + 8 + ln]
        if typ == b"IHDR":
            w = int.from_bytes(body[0:4], "big")
            h = int.from_bytes(body[4:8], "big")
            depth, ctype = body[8], body[9]
        elif typ == b"IDAT":
            idat.append(body)
        elif typ == b"IEND":
            break
        pos += 12 + ln
    assert depth == 8, "only 8-bit supported, got %d" % depth
    nch = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[ctype]
    assert ctype in (2, 6), "only RGB/RGBA supported, got colour type %d" % ctype
    raw = zlib.decompress(b"".join(idat))
    stride = w * nch
    out = bytearray(h * stride)
    prev = bytearray(stride)
    p = 0
    for y in range(h):
        ft = raw[p]
        p += 1
        line = bytearray(raw[p:p + stride])
        p += stride
        if ft == 1:
            for i in range(nch, stride):
                line[i] = (line[i] + line[i - nch]) & 255
        elif ft == 2:
            for i in range(stride):
                line[i] = (line[i] + prev[i]) & 255
        elif ft == 3:
            for i in range(stride):
                a = line[i - nch] if i >= nch else 0
                line[i] = (line[i] + ((a + prev[i]) >> 1)) & 255
        elif ft == 4:
            for i in range(stride):
                a = line[i - nch] if i >= nch else 0
                c = prev[i - nch] if i >= nch else 0
                b = prev[i]
                pa, pb, pc = abs(b - c), abs(a - c), abs(a + b - 2 * c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pr) & 255
        out[y * stride:(y + 1) * stride] = line
        prev = line
    return w, h, nch, bytes(out)


def grey_fraction(w, h, nch, px, box=None, step=2):
    x0, y0, x1, y1 = (0, 0, w, h) if not box else (box[0], box[1], box[0] + box[2], box[1] + box[3])
    x0, y0 = max(0, x0), max(0, y0)
    x1, y1 = min(w, x1), min(h, y1)
    grey = tot = 0
    for y in range(y0, y1, step):
        row = y * w * nch
        for x in range(x0, x1, step):
            i = row + x * nch
            r, g, b = px[i], px[i + 1], px[i + 2]
            mx, mn = max(r, g, b), min(r, g, b)
            tot += 1
            # low saturation and not near-white paper => the grey sofa
            if mx - mn <= 24 and 70 <= mx <= 215:
                grey += 1
    return grey, tot, (100.0 * grey / tot if tot else 0)


if __name__ == "__main__":
    path = sys.argv[1]
    box = [int(v) for v in sys.argv[2:6]] if len(sys.argv) >= 6 else None
    w, h, nch, px = read_png(path)
    g, t, pct = grey_fraction(w, h, nch, px, box)
    print("%s  %dx%d box=%s  grey=%.1f%% (%d/%d)" % (path, w, h, box or "full", pct, g, t))
