"""Crop a PNG by normalised coordinates and write the result, so a computed crop
rectangle can be looked at directly instead of inferred from a metric.

Usage: python3 png_crop.py <in.png> <out.png> x0 y0 w h   (all 0..1)
"""

import struct
import sys
import zlib

sys.path.insert(0, "/Users/tusharkant/Github Project/Others/Akanksha/scripts")
from png_stats import read_png


def write_png(path, w, h, nch, px):
    raw = bytearray()
    stride = w * nch
    for y in range(h):
        raw.append(0)
        raw += px[y * stride:(y + 1) * stride]
    ctype = 6 if nch == 4 else 2

    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    out = b"\x89PNG\r\n\x1a\n"
    out += chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, ctype, 0, 0, 0))
    out += chunk(b"IDAT", zlib.compress(bytes(raw), 6))
    out += chunk(b"IEND", b"")
    open(path, "wb").write(out)


def main():
    src, dst = sys.argv[1], sys.argv[2]
    x0, y0, cw, ch = [float(v) for v in sys.argv[3:7]]
    w, h, nch, px = read_png(src)
    ix, iy = int(x0 * w), int(y0 * h)
    iw, ih = max(1, int(cw * w)), max(1, int(ch * h))
    ix, iy = max(0, min(ix, w - 1)), max(0, min(iy, h - 1))
    iw, ih = min(iw, w - ix), min(ih, h - iy)
    out = bytearray(iw * ih * nch)
    for y in range(ih):
        s = ((iy + y) * w + ix) * nch
        out[y * iw * nch:(y + 1) * iw * nch] = px[s:s + iw * nch]
    write_png(dst, iw, ih, nch, bytes(out))
    print("wrote %s  %dx%d  from (%d,%d)" % (dst, iw, ih, ix, iy))


if __name__ == "__main__":
    main()
