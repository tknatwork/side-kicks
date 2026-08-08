"""Build the InDesign IDML for the 408 A4-landscape frames of Figma "Page 8 - to show Pragati".

Successor to build.py (Page 1 edition). Same proven skeleton — Adobe's converter IDML as
base package, ordered designmap, hex object ids — with these upgrades:

  * images are the ORIGINAL Figma bitmaps (OriginalImages/<hash>.<ext>), placed with an
    independent content transform: FILL = cover (scale to fill, centred), CROP = Figma's
    normalized imageTransform matrix converted to display scale + offset. Crops stay editable.
  * paragraph styles are generated from the observed type signatures (family/style, size,
    alignment, colour) instead of a hand-maintained table.
  * colours are generated for every hex used by text or solid rects.
  * items rotated on the page (loose canvas items on rotated frames) get real rotation
    matrices in ItemTransform.
  * solid rects render filled, ellipses render as Ovals, LINE nodes as GraphicLines.
  * FigJam annotation content (SHAPE_WITH_TEXT / CONNECTOR) renders as filled boxes with
    centred text and straight connector lines.

Inputs (scratchpad/extract8/):
  extract.json   {'ex': {'frames': {id: F}}, 'sizes': {hash: [w,h]}}
                 F = {id,name,cx,cy,w,h,rot,bg,texts,rects,order,errs}
                 text row: [id,px,py,pw,ph,chars,segs,alignH,alignV,op,ang,autoResize]
                   seg: [len, 'Family/Style', size, hex|null, opacity]
                 rect row: [id,px,py,pw,ph,hash,mode,xf,sf,irot,solid,sop,rad,stroke,op,ang,
                            type,name,clips,grad]   stroke: [hex, weight]|null
  order.json     frame ids in reading order (canvas rows, L then R)
  hashmeta.json  {hash: [ext, pxw, pxh]}   from decode_bundles.py
  shapes.json    {id: {type, shapeType?, chars, font?, fontSize?, textColor?,
                       start?, end?, startMagnet?, endMagnet?, endCap?}}
  textsup.json   optional {id: [[len, lineHeightPxOrNull, letterSpacing], ...]}
"""

import json
import math
import os
import re
import zipfile
from xml.sax.saxutils import escape

SP = "/private/tmp/claude-501/-Users-tusharkant-Github-Project-Others-Akanksha/65220df8-93bf-4fdf-bfee-1d7c3882084a/scratchpad"
E8 = os.path.join(SP, "extract8")
REF = os.path.join(SP, "ref/idml")
PROJ = "/Users/tusharkant/Github Project/Others/Akanksha"
OUT = os.path.join(PROJ, "Akanksha-Book-v2.idml")

PW, PH = 842.0, 595.0
DOM = "21.3"
PKG = "http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging"
HDR = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
PI = '<?aid style="50" type="%s" readerVersion="6.0" featureSet="257" product="21.3(51)" ?>'
LAYER = "ud3"
MASTER = "udd"
LEADING_RATIO = 1.2102
_next = [0x10000]


def uid():
    v = _next[0]
    _next[0] += 1
    return "u%x" % v


def n(v):
    r = round(float(v), 4)
    return str(int(r)) if r == int(r) else ("%.4f" % r).rstrip("0").rstrip(".")


ALIGN = {"LEFT": "LeftAlign", "CENTER": "CenterAlign", "RIGHT": "RightAlign",
         "JUSTIFIED": "LeftJustified"}
VJ = {"TOP": "TopAlign", "CENTER": "CenterAlign", "BOTTOM": "BottomAlign"}

# Figma names Inter's compound weights with a space ("Extra Light"); the installed
# OpenType faces do not ("ExtraLight"). Asking for the spaced name does not fail
# loudly — InDesign quietly substitutes a different face (Extra Light landed on Thin
# Italic) and only preflight admits it, because document.fonts reports the
# SUBSTITUTE as installed. Every style name is normalised here, once.
FONT_STYLE_FIXES = {
    "Extra Light": "ExtraLight",
    "Extra Light Italic": "ExtraLight Italic",
    "Semi Bold": "SemiBold",
    "Semi Bold Italic": "SemiBold Italic",
    "Extra Bold": "ExtraBold",
    "Extra Bold Italic": "ExtraBold Italic",
    "Ultra Light": "ExtraLight",
}


def font_style(name):
    return FONT_STYLE_FIXES.get(name, name)


# --- vector routing -------------------------------------------------------
# True vector geometry goes to SVG: InDesign places SVG as a first-class vector
# object (verified — no rasterisation at 4x enlargement, GraphicBounds and
# ItemTransform behave exactly like an image's). The extract does not carry path
# data, so nothing proves a VECTOR node is "really just a rectangle" — every
# true-vector type routes to SVG, and only provably degenerate cases (zero-height
# or zero-width stroked boxes, i.e. rules) stay native. When no SVG export exists
# yet for a node, the builder falls back to the old flat approximation and lists
# the node in scripts/svg-place-jobs.tsv so a later pass can fetch + place it.
SVG_TYPES = {"VECTOR", "STAR", "POLYGON", "BOOLEAN_OPERATION", "REGULAR_POLYGON"}

svg_jobs = []          # populated during build_items, written by main()


def needs_svg(ntype):
    return ntype in SVG_TYPES


# Footers the design sets in white so they read over a dark full-bleed image — but
# on these 20 pages the artwork behind the footer is light, so white text all but
# disappears. Measured from the rendered pages (mean background luminance >= 130 out
# of 255), not eyeballed. The other 14 white footers sit on genuinely dark artwork
# and are left alone: forcing every footer black would break those instead.
FOOTER_FORCE_BLACK = {
    "3177:1773", "3177:1787", "3177:2565",
    "3177:2095", "3177:1184", "3177:2026",
    "3177:1153", "3177:2042", "3177:2050",
    "3177:2591", "3177:2034", "3177:1160",
    "3177:2745", "3177:3022", "3177:2954",
    "3177:2975", "3177:2731", "3177:2800",
    "3177:3095", "3177:2779",
}

# ---------------------------------------------------------------------------
# colours + styles generated from the data
# ---------------------------------------------------------------------------

_colors = {}          # hex -> Color name


def color_name(hexv):
    if hexv is None or hexv == "000000":
        return "Black"
    if hexv not in _colors:
        _colors[hexv] = "AK " + hexv
    return _colors[hexv]


_styles = {}          # sig tuple -> style name
_font_styles = set(["Regular"])


def style_name(fam, fs, size, alignh, hexv):
    sig = (fam, fs, size, alignh, hexv or "000000")
    if sig in _styles:
        return _styles[sig]
    col = "" if sig[4] == "000000" else (" White" if sig[4] == "FFFFFF" else
                                         " Red" if sig[4] == "FF0000" else " " + sig[4])
    al = {"LEFT": "", "CENTER": " Ctr", "RIGHT": " Rt", "JUSTIFIED": " Just"}.get(alignh, "")
    nm = "%s %s%s%s" % (fs, n(size), al, col)
    base = nm
    i = 2
    while nm in _styles.values():
        nm = "%s (%d)" % (base, i)
        i += 1
    _styles[sig] = nm
    _font_styles.add(fs)
    return nm


def text_sig(t):
    segs = t[6]
    if segs:
        fam_fs = segs[0][1]
        fam, fs = fam_fs.split("/", 1) if "/" in fam_fs else ("Inter", fam_fs)
        return fam, font_style(fs), segs[0][2], t[7], segs[0][3]
    return "Inter", "Light", 10.0, t[7], "000000"


# ---------------------------------------------------------------------------
# text stories
# ---------------------------------------------------------------------------

def char_runs(text, segs, sup):
    """-> paragraphs of (txt, font_style, size, colorname, leading)."""
    per = []
    if segs:
        i = 0
        for si, seg in enumerate(segs):
            ln, fontkey, size, colhex = seg[0], seg[1], seg[2], seg[3]
            fs = font_style(fontkey.split("/", 1)[1] if "/" in fontkey else "Regular")
            _font_styles.add(fs)
            col = color_name(colhex)
            lead = None
            if sup and si < len(sup):
                lh = sup[si][1]
                if isinstance(lh, (int, float)):
                    lead = float(lh)
                elif isinstance(lh, list) and lh and lh[0] == "%":
                    lead = float(size) * float(lh[1]) / 100.0
            if lead is None:
                lead = float(size) * LEADING_RATIO
            for _ in range(ln):
                if i < len(text):
                    per.append((text[i], fs, size, col, lead))
                i += 1
        while i < len(text):
            fs0 = font_style(segs[0][1].split("/", 1)[1] if "/" in segs[0][1] else "Regular")
            per.append((text[i], fs0, segs[0][2], color_name(segs[0][3]),
                        float(segs[0][2]) * LEADING_RATIO))
            i += 1
    else:
        per = [(c, "Light", 10.0, "Black", 10.0 * LEADING_RATIO) for c in text]

    paras, cur = [], []
    for ch, st, sz, col, ld in per:
        if ch == "\n":
            paras.append(cur)
            cur = []
            continue
        if ch in ("\r", "​", "﻿"):
            continue
        if ord(ch) < 0x20 and ch != "\t":
            continue
        cur.append((ch, st, sz, col, ld))
    paras.append(cur)

    out = []
    for p in paras:
        runs, buf, key = [], [], None
        for ch, st, sz, col, ld in p:
            k = (st, sz, col, ld)
            if k != key and buf:
                runs.append(("".join(buf),) + key)
                buf = []
            key = k
            buf.append(ch)
        if buf:
            runs.append(("".join(buf),) + key)
        out.append(runs)
    return out


def content_xml(s):
    # Tabs need care on two counts:
    #  * There is no <Tab/> element in IDML. Emitting one is not an error — InDesign
    #    silently DROPS it on import, welding the words on either side into one token
    #    ("Founded<Tab/>in" -> "Foundedin"). A token wider than the column then cannot
    #    be composed at all and the whole story goes overset with no visible cause.
    #    A tab is written as the literal character inside <Content>.
    #  * A tab between two non-space characters is a word separator in the source
    #    (text pasted out of a PDF), not a tab stop, and Figma renders it as a plain
    #    word gap — so it becomes a space rather than a tab advance.
    s = re.sub(r"(?<=\S)\t(?=\S)", " ", s)
    return "<Content>%s</Content>" % escape(s) if s else ""


def story_part(sid, item):
    stylename = item["style"]
    paras = char_runs(item["text"], item.get("segs"), item.get("sup"))
    body = []
    for pi_, runs in enumerate(paras):
        last = pi_ == len(paras) - 1
        if not runs:
            runs = [("", "Light", 10.0, "Black", 12.1)]
        csrs = []
        for ri, (txt, st, sz, col, ld) in enumerate(runs):
            csrs.append(
                '<CharacterStyleRange AppliedCharacterStyle="CharacterStyle/$ID/[No character style]"'
                ' FontStyle="%s" PointSize="%s" FillColor="Color/%s" StrokeWeight="0">'
                '<Properties><AppliedFont type="string">Inter</AppliedFont>'
                '<Leading type="unit">%s</Leading></Properties>%s%s'
                "</CharacterStyleRange>"
                % (escape(st), n(sz), escape(col), n(ld), content_xml(txt),
                   "" if (last or ri != len(runs) - 1) else "<Br/>"))
        body.append('<ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/%s">%s</ParagraphStyleRange>'
                    % (escape(stylename), "".join(csrs)))
    return (HDR + (PI % "story")
            + '<idPkg:Story xmlns:idPkg="%s" DOMVersion="%s">' % (PKG, DOM)
            + '<Story Self="%s" AppliedTOCStyle="n" UserText="true" IsEndnoteStory="false"'
              ' TrackChanges="false" StoryTitle="$ID/" AppliedNamedGrid="n">' % sid
            + '<StoryPreference OpticalMarginAlignment="false" OpticalMarginSize="12"'
              ' FrameType="TextFrameType" StoryOrientation="Horizontal"'
              ' StoryDirection="LeftToRightDirection"/>'
            + '<InCopyExportOption IncludeGraphicProxies="true" IncludeAllResources="false"/>'
            + "".join(body) + "</Story></idPkg:Story>")


# ---------------------------------------------------------------------------
# geometry
# ---------------------------------------------------------------------------

def path_geo(w, h, open_path=False, pts=None):
    if pts is None:
        pts = [(-w / 2, -h / 2), (-w / 2, h / 2), (w / 2, h / 2), (w / 2, -h / 2)]
    ppa = "".join('<PathPointType Anchor="%s %s" LeftDirection="%s %s" RightDirection="%s %s"/>'
                  % (n(x), n(y), n(x), n(y), n(x), n(y)) for x, y in pts)
    return ('<Properties><PathGeometry><GeometryPathType PathOpen="%s">'
            '<PathPointArray>%s</PathPointArray></GeometryPathType></PathGeometry></Properties>'
            % ("true" if open_path else "false", ppa))


def xform(x, y, w, h, ang=0):
    """ItemTransform for an item whose PAGE AABB is (x,y,w,h) and page rotation ang.

    For ang 0 the item is w x h. For +/-90 the item proper is h x w rotated about
    its centre, so the AABB stays (w, h). Matrix rows are [a b c d tx ty]."""
    tx, ty = x + w / 2 - PW / 2, y + h / 2 - PH / 2
    if abs(ang) < 1:
        return "1 0 0 1 %s %s" % (n(tx), n(ty)), w, h
    if abs(ang - 90) < 1 or abs(ang + 270) < 1:
        return "0 1 -1 0 %s %s" % (n(tx), n(ty)), h, w
    if abs(ang + 90) < 1 or abs(ang - 270) < 1:
        return "0 -1 1 0 %s %s" % (n(tx), n(ty)), h, w
    rad = math.radians(ang)
    a, b = math.cos(rad), math.sin(rad)
    return "%s %s %s %s %s %s" % (n(a), n(b), n(-b), n(a), n(tx), n(ty)), w, h


def opacity_xml(op):
    if op is None or op >= 0.999:
        return ""
    return ('<TransparencySetting><BlendingSetting Opacity="%s"/></TransparencySetting>'
            % n(op * 100))


def corner_xml(rad):
    if not rad:
        return ""
    return (' TopLeftCornerOption="RoundedCorner" TopRightCornerOption="RoundedCorner"'
            ' BottomLeftCornerOption="RoundedCorner" BottomRightCornerOption="RoundedCorner"'
            ' TopLeftCornerRadius="%s" TopRightCornerRadius="%s"'
            ' BottomLeftCornerRadius="%s" BottomRightCornerRadius="%s"'
            % (n(rad), n(rad), n(rad), n(rad)))


def content_transform(mode, xf, w, h, sw, sh):
    """-> (sx, sy, ox, oy): content scale + offset of image top-left from frame top-left."""
    if sw <= 0 or sh <= 0:
        return 1, 1, 0, 0
    if mode == "CROP" and xf:
        a, _c, tx, _b, d, ty = xf
        a = a if abs(a) > 1e-6 else 1.0
        d = d if abs(d) > 1e-6 else 1.0
        disp_w, disp_h = w / a, h / d
        return disp_w / sw, disp_h / sh, -tx * disp_w, -ty * disp_h
    if mode == "FIT":
        s = min(w / sw, h / sh)
        return s, s, (w - sw * s) / 2, (h - sh * s) / 2
    # FILL / TILE / fallback: cover
    s = max(w / sw, h / sh)
    return s, s, (w - sw * s) / 2, (h - sh * s) / 2


# ---------------------------------------------------------------------------
# spread items
# ---------------------------------------------------------------------------

FMT = {"png": ("$ID/Portable Network Graphics (PNG)", "$ID/PNG"),
       "jpg": ("$ID/JPEG", "$ID/JPEG"),
       "gif": ("$ID/GIF", "$ID/GIF")}


def exif_placement(orient, rw, rh, dx, dy, dw, dh):
    """Image ItemTransform mapping raw pixels so the DISPLAYED result lands on
    (dx, dy, dw, dh) in the frame's local space.

    An image placed through IDML is drawn from its raw pixels with EXIF orientation
    ignored, but Figma's crop rectangle describes the EXIF-corrected (display) image.
    Where the two differ the orientation has to be folded into the placement matrix,
    otherwise the frame shows a different part of the picture — and for a quarter
    turn, a sideways one.

    Returns "a b c d tx ty" for local = (a*px + c*py + tx, b*px + d*py + ty),
    with px, py in raw pixel coordinates.
    """
    if orient == 3:                      # 180: raw (u,v) shows at display (1-u, 1-v)
        return "%s 0 0 %s %s %s" % (n(-dw / rw), n(-dh / rh), n(dx + dw), n(dy + dh))
    if orient == 6:                      # 90 CW: raw (u,v) -> display (1-v, u)
        return "0 %s %s 0 %s %s" % (n(dh / rw), n(-dw / rh), n(dx + dw), n(dy))
    if orient == 8:                      # 90 CCW: raw (u,v) -> display (v, 1-u)
        return "0 %s %s 0 %s %s" % (n(-dh / rw), n(dw / rh), n(dx), n(dy + dh))
    return "%s 0 0 %s %s %s" % (n(dw / rw), n(dh / rh), n(dx), n(dy))


def image_item(oid, it):
    x, y, w, h = it["x"], it["y"], it["w"], it["h"]
    rw, rh = it["src"]                       # raw pixel dimensions
    dpw, dph = it.get("disp", (rw, rh))      # dimensions as Figma displays them
    orient = it.get("orient", 1)
    ext = it["file"].rsplit(".", 1)[1]
    fmt_link, fmt_type = FMT.get(ext, FMT["jpg"])
    # The picture is fitted against the frame's ORIGINAL box — that is what Figma
    # sized it against — and only then is the frame trimmed to the page.
    _tf0, ow, oh = xform(x, y, w, h, it.get("ang", 0))
    # Fit the picture to the frame's OWN box, not its page-space bounding box: for a
    # +/-90 item those are transposed, and using the bounding box scales the image
    # against the wrong axis, so it lands rotated and mis-cropped.
    sx, sy, ox, oy = content_transform(it.get("mode"), it.get("xf"), ow, oh, dpw, dph)
    cx, cy, cw, ch = it.get("clip", (x, y, w, h))
    tf, iw, ih = xform(cx, cy, cw, ch, it.get("ang", 0))
    # Where the whole display image sits, relative to the (possibly trimmed) frame.
    dw, dh = dpw * sx, dph * sy
    dx = -iw / 2 + ox - (cx - x)
    dy = -ih / 2 + oy - (cy - y)
    img_tf = exif_placement(orient, rw, rh, dx, dy, dw, dh)
    img_id, link_id = uid(), uid()
    return (
        '<Rectangle Self="%s" ContentType="GraphicType" ItemLayer="%s" Locked="false"'
        ' Visible="true" StrokeWeight="0" StrokeColor="Swatch/None" FillColor="Swatch/None"'
        '%s AppliedObjectStyle="ObjectStyle/$ID/[Normal Graphics Frame]" Name="%s"'
        ' ItemTransform="%s">%s%s'
        '<Image Self="%s" ItemTransform="%s" Visible="true"'
        ' Space="$ID/#Links" ActualPpi="72 72" EffectivePpi="72 72"'
        ' ImageTypeName="%s" Name="%s"'
        ' AppliedObjectStyle="ObjectStyle/$ID/[None]">'
        "<Properties>"
        '<Profile type="string">$ID/Embedded</Profile>'
        '<GraphicBounds Left="0" Top="0" Right="%d" Bottom="%d"/>'
        "</Properties>"
        '<Link Self="%s" LinkResourceURI="file:OriginalImages/%s"'
        ' LinkResourceFormat="%s" StoredState="Normal" LinkClassID="35906"'
        ' LinkClientID="257" LinkResourceModified="false" LinkObjectModified="false"'
        ' AssetURL="$ID/" AssetID="$ID/" CanPackage="true"'
        ' ImportPolicy="NoAutoImport" ExportPolicy="NoAutoExport"/>'
        "</Image></Rectangle>"
        % (oid, LAYER, corner_xml(it.get("rad")), escape(it["node"].replace(":", "-")),
           tf, path_geo(iw, ih), opacity_xml(it.get("op")),
           img_id, img_tf,
           fmt_type, escape(it["file"]), rw, rh, link_id, escape(it["file"]), fmt_link))


def solid_item(oid, it, elem="Rectangle"):
    cx, cy, cw, ch = it.get("clip", (it["x"], it["y"], it["w"], it["h"]))
    tf, iw, ih = xform(cx, cy, cw, ch, it.get("ang", 0))
    stroke = it.get("stroke")
    sc = ('StrokeWeight="%s" StrokeColor="Color/%s"' % (n(stroke[1]), color_name(stroke[0]))
          if stroke else 'StrokeWeight="0" StrokeColor="Swatch/None"')
    fill = ('FillColor="Color/%s"' % color_name(it["hex"])) if it.get("hex") is not None \
        else 'FillColor="Swatch/None"'
    return ('<%s Self="%s" ContentType="Unassigned" ItemLayer="%s" Locked="false"'
            ' Visible="true" %s %s%s AppliedObjectStyle="ObjectStyle/$ID/[None]" Name="%s"'
            ' ItemTransform="%s">%s%s</%s>'
            % (elem, oid, LAYER, sc, fill, corner_xml(it.get("rad")),
               escape(it["node"].replace(":", "-")), tf, path_geo(iw, ih),
               opacity_xml(it.get("op")), elem))


def vector_item(oid, it):
    """A node routed to SVG.

    With an SVG available: emit an empty named graphics frame; the placement pass
    (scripts/place-svgs.jsx) runs `frame.place(svg)` after the document opens.
    Hand-authoring InDesign's <SVG> element is deliberately avoided — InDesign sets
    UseSVGAs="EmbedCode" and embeds the markup itself, so letting it do the import
    guarantees the representation matches its own format.

    Without one (yet): fall back to the old flat approximation so the document still
    renders, and rely on svg-place-jobs.tsv to flag the gap.
    """
    if not it.get("svg"):
        return solid_item(oid, dict(it, hex=it.get("hex")))
    cx, cy, cw, ch = it.get("clip", (it["x"], it["y"], it["w"], it["h"]))
    tf, iw, ih = xform(cx, cy, cw, ch, it.get("ang", 0))
    return ('<Rectangle Self="%s" ContentType="GraphicType" ItemLayer="%s" Locked="false"'
            ' Visible="true" StrokeWeight="0" StrokeColor="Swatch/None"'
            ' FillColor="Swatch/None" AppliedObjectStyle="ObjectStyle/$ID/[Normal Graphics Frame]"'
            ' Name="%s" ItemTransform="%s">%s%s</Rectangle>'
            % (oid, LAYER, escape(it["node"].replace(":", "-")), tf,
               path_geo(iw, ih), opacity_xml(it.get("op"))))


def line_item(oid, it):
    x, y, w, h = it["x"], it["y"], it["w"], it["h"]
    stroke = it.get("stroke") or ["000000", 1]
    tx, ty = x + w / 2 - PW / 2, y + h / 2 - PH / 2
    pts = [(it.get("x1", -w / 2), it.get("y1", -h / 2)),
           (it.get("x2", w / 2), it.get("y2", h / 2))]
    cap = (' RightLineEnd="SimpleWideArrowHead"' if it.get("arrow") else "")
    return ('<GraphicLine Self="%s" ContentType="Unassigned" ItemLayer="%s" Locked="false"'
            ' Visible="true" StrokeWeight="%s" StrokeColor="Color/%s"%s'
            ' FillColor="Swatch/None" AppliedObjectStyle="ObjectStyle/$ID/[None]" Name="%s"'
            ' ItemTransform="1 0 0 1 %s %s">%s</GraphicLine>'
            % (oid, LAYER, n(stroke[1] or 1), color_name(stroke[0]), cap,
               escape(it["node"].replace(":", "-")), n(tx), n(ty),
               path_geo(w, h, open_path=True, pts=pts)))


def text_item(oid, it, stories):
    story_id = uid()
    stories.append((story_id, it))
    tf, iw, ih = xform(it["x"], it["y"], it["w"], it["h"], it.get("ang", 0))
    return ('<TextFrame Self="%s" ParentStory="%s" PreviousTextFrame="n" NextTextFrame="n"'
            ' ContentType="TextType" ItemLayer="%s" Locked="false" Visible="true"'
            ' StrokeWeight="0" StrokeColor="Swatch/None" FillColor="Swatch/None"'
            ' AppliedObjectStyle="ObjectStyle/$ID/[Normal Text Frame]" Name="%s"'
            ' ItemTransform="%s">%s%s'
            '<TextFramePreference TextColumnCount="1" TextColumnGutter="12"'
            ' FirstBaselineOffset="AscentOffset" VerticalJustification="%s"'
            ' AutoSizingType="Off" IgnoreWrap="false">'
            '<Properties><InsetSpacing type="list">'
            '<ListItem type="unit">0</ListItem><ListItem type="unit">0</ListItem>'
            '<ListItem type="unit">0</ListItem><ListItem type="unit">0</ListItem>'
            "</InsetSpacing></Properties></TextFramePreference>"
            '<TextWrapPreference Inverse="false" ApplyToMasterPageOnly="false"'
            ' TextWrapSide="BothSides" TextWrapMode="None">'
            '<Properties><TextWrapOffset Top="0" Left="0" Bottom="0" Right="0"/></Properties>'
            "</TextWrapPreference></TextFrame>"
            % (oid, story_id, LAYER, escape(it["node"].replace(":", "-")), tf,
               path_geo(iw, ih), opacity_xml(it.get("op")),
               VJ.get(it.get("valign", "TOP"), "TopAlign")))


def spread_part(idx, page, stories, sections):
    sid, pid = uid(), uid()
    sec = sections[0][0] if sections else uid()
    sections.append((sec, pid))
    items = []
    for it in page["items"]:
        oid = uid()
        k = it["kind"]
        if k == "text":
            items.append(text_item(oid, it, stories))
        elif k == "image":
            items.append(image_item(oid, it))
        elif k == "oval":
            items.append(solid_item(oid, it, "Oval"))
        elif k == "line":
            items.append(line_item(oid, it))
        elif k == "vector":
            items.append(vector_item(oid, it))
        elif k == "solid":
            items.append(solid_item(oid, it))
        elif k == "empty":
            it2 = dict(it)
            it2["hex"] = None
            if not it2.get("stroke"):
                it2["stroke"] = ["000000", 0.5]
            items.append(solid_item(oid, it2))
    xml = (HDR + (PI % "spread")
           + '<idPkg:Spread xmlns:idPkg="%s" DOMVersion="%s">' % (PKG, DOM)
           + '<Spread Self="%s" FlattenerOverride="Default" SpreadHidden="false"'
             ' AllowPageShuffle="true" ItemTransform="1 0 0 1 0 0" ShowMasterItems="true"'
             ' PageCount="1" BindingLocation="0" PageTransitionType="None"'
             ' PageTransitionDirection="NotApplicable" PageTransitionDuration="Medium">' % sid
           + '<FlattenerPreference LineArtAndTextResolution="300"'
             ' GradientAndMeshResolution="150" ClipComplexRegions="false"'
             ' ConvertAllStrokesToOutlines="false" ConvertAllTextToOutlines="false">'
             '<Properties><RasterVectorBalance type="double">50</RasterVectorBalance>'
             "</Properties></FlattenerPreference>"
           + '<Page Self="%s" AppliedAlternateLayout="%s" LayoutRule="UseMaster"'
             ' SnapshotBlendingMode="IgnoreLayoutSnapshots" OptionalPage="false"'
             ' GeometricBounds="0 0 %s %s" ItemTransform="1 0 0 1 %s %s" Name="%d"'
             ' AppliedTrapPreset="TrapPreset/$ID/kDefaultTrapStyleName" OverrideList=""'
             ' AppliedMaster="%s" MasterPageTransform="1 0 0 1 0 0" TabOrder=""'
             ' GridStartingPoint="TopOutside" UseMasterGrid="true">'
             '<MarginPreference ColumnCount="1" ColumnGutter="12" Top="0" Bottom="0"'
             ' Left="0" Right="0" ColumnDirection="Horizontal" ColumnsPositions="0 %s"/>'
             "</Page>"
             % (pid, sec, n(PH), n(PW), n(-PW / 2), n(-PH / 2), idx + 1, MASTER, n(PW))
           + "".join(items) + "</Spread></idPkg:Spread>")
    return sid, xml


# ---------------------------------------------------------------------------
# frame -> item list
# ---------------------------------------------------------------------------

# Stray canvas leftovers: page-level rectangles that sit ON TOP of a frame and
# cover an image the frame already contains. Each is a second copy of artwork that
# appears at full size elsewhere in the book, and Figma's own frame render excludes
# them (they are siblings of the frame, not children). Verified individually against
# the Figma renders before listing here — every other loose item lands in empty space
# and IS real page content, so this stays an explicit list, never a blanket rule.
STRAY_OVERLAYS = {
    "3177:2727",   # p338 duplicate of htx-trends image shown full size on p329
    "3177:2728",   # p338 ditto
    "3177:3338",   # p392 second copy of 2510N307A over the original, causes a seam
}


def clip_to_page(x, y, w, h):
    """Intersect an item rectangle with the page.

    A Figma frame clips its children; an InDesign page does not. An oversized
    image — the full-bleed knit patterns run 6600pt wide — therefore stays whole and
    spills across the facing page of the spread, burying it. Trimming the frame to
    the page reproduces Figma's clip; the picture inside keeps its position and size,
    so the crop stays editable and only the visible window changes.

    Returns (nx, ny, nw, nh, trimmed_left, trimmed_top).
    """
    nx, ny = max(x, 0.0), max(y, 0.0)
    nx2, ny2 = min(x + w, PW), min(y + h, PH)
    return nx, ny, nx2 - nx, ny2 - ny, nx - x, ny - y


def fully_clipped(x, y, w, h):
    """True when the rect lies entirely outside the page.

    Every one of the 408 Figma frames has clipsContent=true (verified), so an item
    parked completely outside its frame is invisible in the source. Reproducing it
    would drop an item onto the InDesign pasteboard and carry a pointless link.
    Partially overflowing items are kept — those are the full-bleed images, and the
    frame clips them exactly as Figma does.
    """
    return x + w <= 0 or x >= PW or y + h <= 0 or y >= PH


def build_items(F, hashmeta, shapes, textsup, stats, svgmap=None):
    texts = {t[0]: t for t in F["texts"]}
    rects = {r[0]: r for r in F["rects"]}
    items = []
    for nid in F["order"]:
        if nid in texts:
            t = texts[nid]
            if fully_clipped(t[1], t[2], t[3], t[4]):
                stats["offpage"] += 1
                continue
            fam, fs, size, alignh, colhex = text_sig(t)
            segs = t[6]
            if nid in FOOTER_FORCE_BLACK:
                colhex = "000000"
                segs = [[s[0], s[1], s[2], "000000"] + list(s[4:]) for s in (segs or [])]
                stats["footerBlack"] += 1
            items.append(dict(kind="text", node=nid, x=t[1], y=t[2], w=t[3], h=t[4],
                              text=t[5], segs=segs, sup=(textsup or {}).get(nid),
                              style=style_name(fam, fs, size, alignh, colhex),
                              valign=t[8], op=t[9], ang=t[10]))
            stats["text"] += 1
            continue
        if nid not in rects:
            continue
        if nid in STRAY_OVERLAYS:
            stats["stray"] += 1
            continue
        r = rects[nid]
        (rid, px, py, pw, ph, hsh, mode, xf, sf, irot, solid, sop, rad, stroke,
         nop, ang, ntype, nname, clips, grad) = r
        if fully_clipped(px, py, pw, ph):
            stats["offpage"] += 1
            continue
        op = (nop if nop is not None else 1) * (sop if sop is not None else 1)
        base = dict(node=rid, x=px, y=py, w=pw, h=ph, op=op, ang=ang,
                    rad=rad, stroke=stroke)
        # Reproduce the frame's clip. Skipped for rotated items — none of them
        # overflow, and an axis-aligned trim would be wrong for a rotated box.
        if abs(ang) <= 1 and (px < -0.5 or py < -0.5
                              or px + pw > PW + 0.5 or py + ph > PH + 0.5):
            nx, ny, nw, nh, _tl, _tt = clip_to_page(px, py, pw, ph)
            base["clip"] = (nx, ny, nw, nh)
            stats["clipped"] += 1
        sh_meta = shapes.get(rid) if shapes else None
        if sh_meta and sh_meta["type"] == "CONNECTOR":
            it = dict(base, kind="line", arrow=(sh_meta.get("endCap") not in (None, "NONE")))
            if not it.get("stroke"):
                it["stroke"] = ["808080", 1]
            items.append(it)
            stats["conn"] += 1
            continue
        if hsh:
            meta = hashmeta.get(hsh)
            if meta:
                orient = meta[3] if len(meta) > 3 else 1
                disp = (meta[4], meta[5]) if len(meta) > 5 else (meta[1], meta[2])
                items.append(dict(base, kind="image", file=hsh + "." + meta[0],
                                  src=(meta[1], meta[2]), disp=disp, orient=orient,
                                  mode=mode, xf=xf))
                stats["image"] += 1
                if orient != 1:
                    stats["exif"] += 1
            else:
                items.append(dict(base, kind="empty"))
                stats["noimg"] += 1
        elif ntype == "ELLIPSE":
            items.append(dict(base, kind="oval", hex=solid))
            stats["shape"] += 1
        elif ntype == "LINE" or (ph < 0.51 and stroke) or (pw < 0.51 and stroke):
            # Degenerate box with a stroke IS a rule, whatever Figma calls the node.
            if pw < 0.51:
                items.append(dict(base, kind="line", x1=0, y1=-ph / 2, x2=0, y2=ph / 2))
            else:
                items.append(dict(base, kind="line", x1=-pw / 2, y1=0, x2=pw / 2, y2=0))
            stats["shape"] += 1
        elif needs_svg(ntype):
            # Real vector geometry: InDesign takes SVG as a first-class vector object
            # (verified — placed 4x oversize with no rasterisation, GraphicBounds +
            # ItemTransform work exactly like an image). The SVG is placed in a pass
            # after the document opens rather than hand-authored into the IDML,
            # because InDesign embeds the markup itself. Here we emit the frame that
            # will receive it and record the job.
            svg = (svgmap or {}).get(rid)
            items.append(dict(base, kind="vector", hex=solid, svg=svg))
            svg_jobs.append({"node": rid, "frame": rid.replace(":", "-"),
                             "type": ntype, "name": nname,
                             "w": pw, "h": ph, "svg": svg})
            stats["vector" if svg else "vectorPending"] += 1
        elif solid is not None:
            items.append(dict(base, kind="solid", hex=solid))
            stats["solid"] += 1
        elif stroke:
            items.append(dict(base, kind="solid", hex=None))
            stats["shape"] += 1
        else:
            stats["skip"] += 1
            continue
        if sh_meta and sh_meta["type"] == "SHAPE_WITH_TEXT" and sh_meta.get("chars"):
            fs = font_style((sh_meta.get("font") or "Inter/Light").split("/", 1)[1])
            size = sh_meta.get("fontSize") or 10
            col = sh_meta.get("textColor") or "000000"
            segs = [[len(sh_meta["chars"]), "Inter/" + fs, size, col, 1]]
            items.append(dict(kind="text", node=rid + "t", x=px + 2, y=py + 2,
                              w=max(pw - 4, 8), h=max(ph - 4, 8),
                              text=sh_meta["chars"], segs=segs,
                              style=style_name("Inter", fs, size, "CENTER", col),
                              valign="CENTER", op=1, ang=ang))
            stats["shapetext"] += 1
    return items


# ---------------------------------------------------------------------------
# resources
# ---------------------------------------------------------------------------

def patch_fonts(src):
    fonts = "".join(
        '<Font Self="dInter%s" FontFamily="Inter" Name="Inter\t%s" PostScriptName="Inter-%s"'
        ' Status="Installed" FontStyleName="%s" FontType="OpenTypeCFF" WritingScript="0"'
        ' FullName="Inter %s" FullNameNative="Inter %s" FontStyleNameNative="%s"'
        ' PlatformName="$ID/" Version="" TypekitID="$ID/"/>'
        % (s2.replace(" ", ""), s2, s2.replace(" ", ""), s2, s2, s2, s2)
        for s2 in sorted(_font_styles))
    fam = '<FontFamily Self="dInter" Name="Inter">%s</FontFamily>' % fonts
    idx = src.rfind("</FontFamily>")
    if idx == -1:
        return src.replace("</idPkg:Fonts>", fam + "</idPkg:Fonts>")
    idx += len("</FontFamily>")
    return src[:idx] + fam + src[idx:]


def patch_graphic(src):
    extra = "".join(
        '<Color Self="Color/%s" Model="Process" Space="RGB" ColorValue="%d %d %d"'
        ' ColorOverride="Normal" AlternateSpace="NoAlternateColor" AlternateColorValue=""'
        ' Name="%s" ColorEditable="true" ColorRemovable="true" Visible="true"'
        ' SwatchCreatorID="7937"/>'
        % (nm, int(hx[0:2], 16), int(hx[2:4], 16), int(hx[4:6], 16), nm)
        for hx, nm in sorted(_colors.items()))
    last = None
    for m in re.finditer(r"<Color\b[^>]*/>", src):
        last = m
    if last is None:
        return src.replace("</idPkg:Graphic>", extra + "</idPkg:Graphic>")
    return src[:last.end()] + extra + src[last.end():]


def patch_styles(src):
    ps = []
    for sig, name in sorted(_styles.items(), key=lambda kv: kv[1]):
        fam, fs, size, alignh, hexv = sig
        ps.append(
            '<ParagraphStyle Self="ParagraphStyle/%s" Name="%s" Imported="false"'
            ' PointSize="%s" Justification="%s" FillColor="Color/%s" FontStyle="%s"'
            ' Hyphenation="false" SpaceAfter="0" SpaceBefore="0"'
            ' NextStyle="ParagraphStyle/%s" KeepAllLinesTogether="false">'
            "<Properties>"
            '<BasedOn type="string">$ID/[No paragraph style]</BasedOn>'
            '<AppliedFont type="string">%s</AppliedFont>'
            '<Leading type="unit">%s</Leading>'
            "</Properties></ParagraphStyle>"
            % (escape(name), escape(name), n(size), ALIGN.get(alignh, "LeftAlign"),
               escape(color_name(hexv)), escape(fs), escape(name), escape(fam),
               n(float(size) * LEADING_RATIO)))
    return src.replace("</RootParagraphStyleGroup>", "".join(ps) + "</RootParagraphStyleGroup>")


def patch_designmap(src, spread_ids, story_ids, sections):
    backing = re.search(r'<XmlStory Self="([^"]+)"',
                        open(os.path.join(REF, "XML/BackingStory.xml"), encoding="utf-8").read())
    backing_id = backing.group(1) if backing else None
    src = re.sub(r'<idPkg:Spread src="[^"]+"\s*/>', "@@SPREADS@@", src, count=1)
    src = re.sub(r'<idPkg:Spread src="[^"]+"\s*/>', "", src)
    src = re.sub(r'<idPkg:Story src="[^"]+"\s*/>', "@@STORIES@@", src, count=1)
    src = re.sub(r'<idPkg:Story src="[^"]+"\s*/>', "", src)
    src = re.sub(r"<Section\b.*?</Section>", "@@SEC@@", src, count=1, flags=re.S)
    src = re.sub(r"<Section\b.*?</Section>", "", src, flags=re.S)
    src = re.sub(r"<Section\b[^>]*/>", "", src)
    all_stories = list(story_ids) + ([backing_id] if backing_id else [])
    src = re.sub(r'StoryList="[^"]*"', 'StoryList="%s"' % " ".join(all_stories), src)
    spread_refs = "".join('<idPkg:Spread src="Spreads/Spread_%s.xml"/>' % i for i in spread_ids)
    story_refs = "".join('<idPkg:Story src="Stories/Story_%s.xml"/>' % s for s in story_ids)
    # ONE section; PageNumberStart 2 so the first page is a VERSO once facing pages
    # are enabled (the Figma canvas pairs every row, including the first).
    section = ('<Section Self="%s" Length="%d" AlternateLayoutLength="%d"'
               ' AlternateLayout="Custom H" Name="" ContinueNumbering="false"'
               ' IncludeSectionPrefix="false" Marker="" PageNumberStart="2"'
               ' PageStart="%s" SectionPrefix="">'
               '<Properties><PageNumberStyle type="enumeration">Arabic</PageNumberStyle>'
               "</Properties></Section>"
               % (sections[0][0], len(sections), len(sections), sections[0][1]))
    return (src.replace("@@SPREADS@@", spread_refs)
               .replace("@@STORIES@@", story_refs)
               .replace("@@SEC@@", section))


# ---------------------------------------------------------------------------

def main(limit=None, out=None, seqs=None):
    global OUT
    if out:
        OUT = out
    d = json.load(open(os.path.join(E8, "extract.json")))
    frames = d["ex"]["frames"]
    order = json.load(open(os.path.join(E8, "order.json")))
    if seqs:                      # build only these 1-based pages, for quick iteration
        order = [order[s - 1] for s in seqs]
    hashmeta = json.load(open(os.path.join(E8, "hashmeta.json")))
    shapes = {}
    sp_p = os.path.join(E8, "shapes.json")
    if os.path.exists(sp_p):
        shapes = json.load(open(sp_p))
    textsup = None
    ts_p = os.path.join(E8, "textsup.json")
    if os.path.exists(ts_p):
        textsup = json.load(open(ts_p))
    # node id -> project-relative SVG path (produced by the vector-export pass);
    # absent entries fall back to the flat approximation and are listed as jobs.
    svgmap = {}
    sv_p = os.path.join(E8, "svgmap.json")
    if os.path.exists(sv_p):
        svgmap = json.load(open(sv_p))
    del svg_jobs[:]

    if limit:
        order = order[:limit]
    stats = dict(text=0, image=0, solid=0, shape=0, conn=0, shapetext=0, noimg=0,
                 skip=0, stray=0, offpage=0, exif=0, clipped=0, footerBlack=0,
                 vector=0, vectorPending=0)
    pages = []
    for fid in order:
        F = frames[fid]
        pages.append(dict(items=build_items(F, hashmeta, shapes, textsup, stats, svgmap),
                          name=F["name"]))

    stories, sections, spreads, spread_ids = [], [], [], []
    for i, p in enumerate(pages):
        sid, xml = spread_part(i, p, stories, sections)
        spread_ids.append(sid)
        spreads.append(xml)
    story_ids = [s for s, _ in stories]

    base = {name: open(os.path.join(REF, name), encoding="utf-8").read() for name in (
        "designmap.xml", "META-INF/container.xml", "META-INF/metadata.xml",
        "Resources/Fonts.xml", "Resources/Graphic.xml", "Resources/Styles.xml",
        "Resources/Preferences.xml", "MasterSpreads/MasterSpread_udd.xml",
        "XML/BackingStory.xml", "XML/Tags.xml")}

    # Generate the stories BEFORE the resource parts. Writing a story is what
    # discovers the fonts and colours used inside it, and a font used only in a
    # non-leading run — ExtraLight is only ever the second run of a footer — is
    # otherwise never registered, so Fonts.xml omits it and InDesign silently
    # substitutes a different face on all 410 of them.
    story_xml = [(sid, story_part(sid, item)) for sid, item in stories]

    if os.path.exists(OUT):
        os.remove(OUT)
    zf = zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED, compresslevel=6)
    zi = zipfile.ZipInfo("mimetype")
    zi.compress_type = zipfile.ZIP_STORED
    zf.writestr(zi, "application/vnd.adobe.indesign-idml-package")
    zf.writestr("designmap.xml", patch_designmap(base["designmap.xml"], spread_ids,
                                                 story_ids, sections))
    zf.writestr("META-INF/container.xml", base["META-INF/container.xml"])
    zf.writestr("META-INF/metadata.xml", base["META-INF/metadata.xml"])
    zf.writestr("Resources/Fonts.xml", patch_fonts(base["Resources/Fonts.xml"]))
    zf.writestr("Resources/Graphic.xml", patch_graphic(base["Resources/Graphic.xml"]))
    zf.writestr("Resources/Styles.xml", patch_styles(base["Resources/Styles.xml"]))
    zf.writestr("Resources/Preferences.xml", base["Resources/Preferences.xml"])
    zf.writestr("MasterSpreads/MasterSpread_udd.xml", base["MasterSpreads/MasterSpread_udd.xml"])
    for sid, xml in zip(spread_ids, spreads):
        zf.writestr("Spreads/Spread_%s.xml" % sid, xml)
    for sid, xml in story_xml:
        zf.writestr("Stories/Story_%s.xml" % sid, xml)
    zf.writestr("XML/BackingStory.xml", base["XML/BackingStory.xml"])
    zf.writestr("XML/Tags.xml", base["XML/Tags.xml"])
    zf.close()

    # ExtendScript has no JSON global, so the placement pass reads TSV.
    with open(os.path.join(PROJ, "scripts", "svg-place-jobs.tsv"), "w") as jf:
        for j in svg_jobs:
            jf.write("%s\t%s\t%s\t%s\n" % (j["frame"], j["svg"] or "", j["type"], j["name"]))
    if svg_jobs:
        pending = sum(1 for j in svg_jobs if not j["svg"])
        print("vector nodes routed to SVG: %d  (missing an export yet: %d)"
              % (len(svg_jobs), pending))
    print("wrote %s  (%.2f MB)" % (OUT, os.path.getsize(OUT) / 1e6))
    print("pages: %d  stats: %s" % (len(pages), stats))
    print("styles: %d  colors: %d  font styles: %s"
          % (len(_styles), len(_colors), sorted(_font_styles)))
    return stats


if __name__ == "__main__":
    import sys
    # build8.py [limit|none] [outfile] [seq,seq,...]
    lim = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1] != "none" else None
    o = sys.argv[2] if len(sys.argv) > 2 else None
    sq = [int(s) for s in sys.argv[3].split(",")] if len(sys.argv) > 3 else None
    main(lim, o, sq)
