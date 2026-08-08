"""Resolve a document's fonts into bundleable files — or an honest refusal.

Policy (Tushar, 2026-08-09): Adobe Fonts activation locks packaging even for fonts
that are free to the public — InDesign marks every Adobe-Fonts face "protected"
regardless of the typeface's own licence. So:

  * If a family is published under a free licence (OFL / Apache / UFL), source the
    authentic free build from the internet and bundle THAT, sidestepping the
    Adobe-Fonts lock. The bundled file is the open build, never Adobe's copy.
  * If a family is a paid / restricted licence, do NOT bundle it. Report it plainly
    so the recipient knows to license it themselves.
  * Never bundle a face whose internal PostScript name was not verified against
    what the document actually binds to — a near-miss substitutes silently.

Usage:
  python3 resolve_fonts.py <document.idml> <output-dir> [--report report.json]

Reads the required faces from the IDML's Resources/Fonts.xml, classifies each
family, downloads open builds, verifies name tables, and writes only verified
matches into <output-dir> (typically the package's "Document fonts" folder, which
InDesign auto-activates). Everything else lands in the report with a reason.
"""

import json
import os
import re
import struct
import sys
import urllib.parse
import urllib.request
import zipfile

UA = {"User-Agent": "figma-to-indesign-font-resolver"}

# Every URL this tool touches must be HTTPS on one of these hosts. Some URLs come
# back from GitHub's API responses (asset/download links), so they are validated
# rather than trusted — this also forecloses urllib's file:// scheme handling.
ALLOWED_HOSTS = ("api.github.com", "github.com", "objects.githubusercontent.com",
                 "raw.githubusercontent.com", "codeload.github.com",
                 "release-assets.githubusercontent.com")

# Families with a known authoritative static-build source. Checked before the
# google/fonts fallback because some Google Fonts families ship variable-only,
# whose named instances may not match the static PostScript names a document
# binds to.
REGISTRY = {
    "inter": {
        "source": "github:rsms/inter",
        "kind": "github-release-zip",
        "repo": "rsms/inter",
        "zip_member_dir": "extras/ttf/",
        "license": "OFL",
    },
}

GF_LICENSE_DIRS = ("ofl", "apache", "ufl")     # all three permit redistribution


def _check_url(url):
    parts = urllib.parse.urlsplit(url)
    if parts.scheme != "https" or parts.hostname not in ALLOWED_HOSTS:
        raise ValueError("refusing to fetch %r: only https on %s"
                         % (url, ", ".join(ALLOWED_HOSTS)))
    return url


class _PinnedRedirects(urllib.request.HTTPRedirectHandler):
    """Re-validate every redirect hop — a pre-check on the first URL alone would
    let a redirect escape the allowlist (GitHub release assets redirect to
    objects.githubusercontent.com, which is why it is on the list)."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        _check_url(newurl)
        return urllib.request.HTTPRedirectHandler.redirect_request(
            self, req, fp, code, msg, headers, newurl)


_opener = urllib.request.build_opener(_PinnedRedirects())


def fetch(url, binary=False):
    req = urllib.request.Request(_check_url(url), headers=UA)
    with _opener.open(req, timeout=60) as r:   # nosemgrep: https+host pinned on every hop
        data = r.read()
    return data if binary else data.decode("utf-8", "replace")


# --- what the document needs ------------------------------------------------

def required_faces(idml_path):
    """Faces the document's CONTENT actually uses.

    Two traps, both hit on the reference document:
      * InDesign's own IDML export writes <Font …> as an OPEN tag (with children),
        while hand-built packages use self-closing <Font …/> — match both, or the
        real fonts are invisible and only noise remains.
      * The base template declares fonts nothing uses (Minion Pro, Myriad Pro,
        Kozuka Mincho ride along in Adobe's converter output). Demanding those
        would send the resolver hunting licences for fonts with zero characters.
        Filter to families referenced by the stories/styles.
    """
    z = zipfile.ZipFile(idml_path)
    src = z.read("Resources/Fonts.xml").decode("utf-8")
    faces = []
    for m in re.finditer(r'<Font\s[^>]*?/?>', src):
        tag = m.group(0)
        fam = re.search(r'FontFamily="([^"]+)"', tag)
        ps = re.search(r'PostScriptName="([^"]+)"', tag)
        style = re.search(r'FontStyleName="([^"]+)"', tag)
        if fam and ps:
            faces.append({"family": fam.group(1), "postscript": ps.group(1),
                          "style": style.group(1) if style else ""})

    # Filter to faces the content uses. Families and styles are collected
    # SEPARATELY and a face qualifies when both its family and its style are used
    # anywhere. Pairing them precisely is tempting but unsafe: a run may inherit
    # its font from the paragraph style and carry only FontStyle (the footers'
    # ExtraLight runs do exactly this), so pair-matching silently drops real
    # faces. The cross-product over-includes in multi-family documents, and that
    # is the right direction to be wrong in — an extra bundled face is dead
    # weight, a missing one substitutes silently.
    used_families, used_styles = set(), set()
    for name in z.namelist():
        if name.startswith("Stories/") or name == "Resources/Styles.xml":
            body = z.read(name).decode("utf-8")
            used_families.update(
                re.findall(r'<AppliedFont type="string">([^<]+)</AppliedFont>', body))
            used_styles.update(re.findall(r'FontStyle="([^"]+)"', body))
    if used_families and used_styles:
        faces = [f for f in faces
                 if f["family"] in used_families and f["style"] in used_styles]
    return faces


# --- font-file name table ---------------------------------------------------

def font_names(data):
    """PostScript name (id 6) from a TTF/OTF name table."""
    if data[:4] == b"ttcf":
        return None                         # collections: skip, too ambiguous
    num = struct.unpack(">H", data[4:6])[0]
    off = None
    for i in range(num):
        e = 12 + i * 16
        if data[e:e + 4] == b"name":
            off = struct.unpack(">I", data[e + 8:e + 12])[0]
            break
    if off is None:
        return None
    _fmt, count, so = struct.unpack(">HHH", data[off:off + 6])
    for i in range(count):
        r = off + 6 + i * 12
        pid, _eid, _lid, nid, ln, o = struct.unpack(">HHHHHH", data[r:r + 12])
        if nid != 6:
            continue
        raw = data[off + so + o:off + so + o + ln]
        try:
            return raw.decode("utf-16-be") if pid == 3 else raw.decode("latin-1")
        except UnicodeDecodeError:
            continue
    return None


# --- sources -----------------------------------------------------------------

def acquire_registry(entry, tmpdir):
    """-> list of (filename, bytes) candidate font files."""
    rel = json.loads(fetch("https://api.github.com/repos/%s/releases/latest" % entry["repo"]))
    asset = next(a for a in rel["assets"] if a["name"].endswith(".zip"))
    zpath = os.path.join(tmpdir, asset["name"])
    if not os.path.exists(zpath):
        open(zpath, "wb").write(fetch(asset["browser_download_url"], binary=True))
    out = []
    z = zipfile.ZipFile(zpath)
    for nme in z.namelist():
        if nme.startswith(entry["zip_member_dir"]) and nme.lower().endswith((".ttf", ".otf")):
            out.append((os.path.basename(nme), z.read(nme)))
    return out, rel.get("tag_name", "")


def gf_family_dir(family):
    """-> (license_dir, slug) if the family exists in google/fonts, else None."""
    slug = family.lower().replace(" ", "")
    for lic in GF_LICENSE_DIRS:
        url = "https://api.github.com/repos/google/fonts/contents/%s/%s" % (lic, slug)
        try:
            listing = json.loads(fetch(url))
            if isinstance(listing, list):
                return lic, slug, listing
        except Exception:
            continue
    return None


def acquire_google_fonts(listing):
    out = []
    for entry in listing:
        if entry["name"].lower().endswith((".ttf", ".otf")):
            out.append((entry["name"], fetch(entry["download_url"], binary=True)))
    return out


# --- main --------------------------------------------------------------------

def main():
    if len(sys.argv) < 3:
        print(__doc__)
        return 2
    idml, outdir = sys.argv[1], sys.argv[2]
    report_path = sys.argv[sys.argv.index("--report") + 1] if "--report" in sys.argv else None
    os.makedirs(outdir, exist_ok=True)
    tmpdir = os.path.join(outdir, ".font-cache")
    os.makedirs(tmpdir, exist_ok=True)

    faces = required_faces(idml)
    families = {}
    for f in faces:
        families.setdefault(f["family"], []).append(f)

    report = {"families": {}, "policy":
              "open-licensed families bundled from their public source; "
              "restricted families reported, never bundled"}
    for fam, needs in families.items():
        needed_ps = {f["postscript"] for f in needs}
        rec = {"needed": sorted(needed_ps), "bundled": [], "unresolved": [],
               "license": None, "source": None}
        candidates, version = [], ""

        entry = REGISTRY.get(fam.lower().replace(" ", ""))
        if entry:
            try:
                candidates, version = acquire_registry(entry, tmpdir)
                rec["license"], rec["source"] = entry["license"], \
                    entry["source"] + ("@" + version if version else "")
            except Exception as e:
                rec["unresolved"].append("registry fetch failed: %s" % e)
        if not candidates:
            gf = gf_family_dir(fam)
            if gf:
                lic, slug, listing = gf
                try:
                    candidates = acquire_google_fonts(listing)
                    rec["license"] = lic.upper()
                    rec["source"] = "github:google/fonts/%s/%s" % (lic, slug)
                except Exception as e:
                    rec["unresolved"].append("google/fonts fetch failed: %s" % e)

        if not candidates:
            rec["license"] = rec["license"] or "unknown/restricted"
            rec["verdict"] = ("NOT BUNDLED — no open-licensed source found. If this "
                              "is a paid/restricted font the recipient must license "
                              "it themselves; Adobe-Fonts copies cannot be packaged.")
            report["families"][fam] = rec
            continue

        # bundle only exact PostScript-name matches — near-misses substitute silently
        for fname, data in candidates:
            ps = font_names(data)
            if ps in needed_ps:
                open(os.path.join(outdir, fname), "wb").write(data)
                rec["bundled"].append({"file": fname, "postscript": ps})
                needed_ps.discard(ps)
        rec["unresolved"] += sorted(needed_ps)
        rec["verdict"] = ("BUNDLED (open licence: %s)" % rec["license"]
                          if not needed_ps else
                          "PARTIAL — faces listed in 'unresolved' had no exact "
                          "PostScript match in the open build; do not guess, "
                          "resolve manually")
        report["families"][fam] = rec

    if report_path:
        json.dump(report, open(report_path, "w"), indent=2)
    for fam, rec in report["families"].items():
        print("%s: %s" % (fam, rec["verdict"]))
        for b in rec["bundled"]:
            print("   + %s (%s)" % (b["file"], b["postscript"]))
        for u in rec["unresolved"]:
            print("   ! %s" % u)
    return 0 if all(not r["unresolved"] for r in report["families"].values()) else 1


if __name__ == "__main__":
    raise SystemExit(main())
