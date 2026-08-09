#!/usr/bin/env python3
"""figma-to-indesign — MCP server (stdio).

Dependency-free implementation of the MCP stdio transport (newline-delimited
JSON-RPC 2.0). Register with any MCP client as:

    claude mcp add figma-to-indesign -- python3 /path/to/server/server.py

Honesty about maturity (v0.1):
  * `check_readiness`  — fully implemented. Run it first; everything else assumes green.
  * `resolve_fonts`    — fully implemented (wraps pipeline/resolve_fonts.py).
  * `audit_geometry`, `compare_pages`, `build_idml` — thin wrappers over the pipeline
    scripts, which still carry per-project constants at the top (extraction paths,
    document names). They error with a pointer instead of guessing. See docs/SPEC.md
    §9: the intended first milestone is running the pipeline against a SECOND real
    document and generalising from what breaks — not pretending this is generic yet.

macOS only. Windows is unsupported and untested — docs/WINDOWS.md is the porting guide.
"""

import json
import os
import shutil
import socket
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
# Pipeline scripts live in ../pipeline in this repo; a project that vendors the
# server next to its own scripts (the reference Akanksha project does) keeps
# them beside this file instead. Support both layouts.
_repo_pipeline = os.path.join(os.path.dirname(HERE), "pipeline")
PIPELINE = _repo_pipeline if os.path.isdir(_repo_pipeline) else HERE
PROTOCOL_VERSION = "2024-11-05"
SERVER_INFO = {"name": "figma-to-indesign", "version": "0.1.0"}
LIMITLESS_WS_PORT = 1994          # the figma-limitless plugin's local bridge


# --------------------------------------------------------------------------- #
# readiness checks — each returns (ok, detail, fix)
# --------------------------------------------------------------------------- #

def _run(cmd, timeout=20):
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)


def _find_app(prefix):
    """Adobe installs into versioned SUBFOLDERS ('/Applications/Adobe InDesign 2026/
    Adobe InDesign 2026.app'), so a single-level scan reports 'not installed' on a
    machine that has it — found the hard way by this check's own first run."""
    hits = []
    for base in ("/Applications", os.path.expanduser("~/Applications")):
        if not os.path.isdir(base):
            continue
        for name in sorted(os.listdir(base)):
            p = os.path.join(base, name)
            if name.startswith(prefix) and name.endswith(".app"):
                hits.append(p)
            elif name.startswith(prefix) and os.path.isdir(p):
                for inner in sorted(os.listdir(p)):
                    if inner.startswith(prefix) and inner.endswith(".app"):
                        hits.append(os.path.join(p, inner))
    return hits


def _app_version(app_path):
    try:
        r = _run(["defaults", "read", os.path.join(app_path, "Contents", "Info"),
                  "CFBundleShortVersionString"])
        return r.stdout.strip() or "unknown"
    except Exception:
        return "unknown"


def _running(pattern):
    try:
        return _run(["pgrep", "-f", pattern]).returncode == 0
    except Exception:
        return False


def check_readiness(params):
    checks = []

    def add(name, ok, detail, fix=""):
        checks.append({"check": name, "ok": bool(ok), "detail": detail, "fix": fix})

    if sys.platform != "darwin":
        add("platform", False, "platform is %s" % sys.platform,
            "macOS is the only tested platform; see docs/WINDOWS.md before attempting a port")
        return {"ready": False, "checks": checks}
    add("platform", True, "macOS")

    # InDesign
    indds = _find_app("Adobe InDesign")
    if not indds:
        add("indesign.installed", False, "no Adobe InDesign app found",
            "install InDesign (the generated IDML pins a DOM version per release)")
    else:
        app = indds[-1]
        ver = _app_version(app)
        add("indesign.installed", True, "%s (v%s)" % (os.path.basename(app), ver))
        if _running("MacOS/Adobe InDesign"):
            # bridge round-trip only when already running: launching takes minutes
            try:
                name = os.path.basename(app)[:-4]
                r = _run(["osascript", "-e",
                          'tell application "%s" to do script "1+1" language javascript' % name],
                         timeout=30)
                add("indesign.bridge", r.returncode == 0 and "2" in r.stdout,
                    r.stdout.strip() or r.stderr.strip()[:120],
                    "" if r.returncode == 0 else
                    "grant Automation permission: System Settings > Privacy > Automation")
            except Exception as e:
                add("indesign.bridge", False, str(e)[:120],
                    "bridge did not respond; is a modal dialog open in InDesign?")
        else:
            add("indesign.bridge", True, "not running (bridge untested — will test on first use)",
                "")

    # Photoshop — NOT optional: CMYK conversion and EXIF uprighting run in it
    pss = _find_app("Adobe Photoshop")
    add("photoshop.installed", bool(pss),
        "%s (v%s)" % (os.path.basename(pss[-1]), _app_version(pss[-1])) if pss
        else "no Adobe Photoshop app found",
        "" if pss else "install Photoshop — the pipeline needs it for CMYK + EXIF passes")

    # figma-limitless bridge
    try:
        with socket.create_connection(("127.0.0.1", LIMITLESS_WS_PORT), timeout=2):
            add("limitless.server", True, "port %d listening" % LIMITLESS_WS_PORT)
    except OSError:
        add("limitless.server", False, "nothing on port %d" % LIMITLESS_WS_PORT,
            "start the figma-limitless-mcp server, then run the plugin: "
            "Figma > Plugins > Development > Limitless MCP for Figma")
    add("limitless.filekey", True,
        "REMINDER: the plugin fileKey CHANGES when the file is reopened — "
        "confirm via get_workspace_status, never reuse a cached key", "")

    # occlusion throttling
    if _running("/Applications/Figma.app/Contents/MacOS/Figma"):
        add("figma.throttling", True,
            "Figma is running. If plugin calls time out, its window is likely occluded "
            "(Electron throttles hidden windows) — bring Figma to the front", "")

    # disk
    try:
        free_gb = shutil.disk_usage(os.path.expanduser("~")).free / 1e9
        add("disk.free", free_gb > 20, "%.0f GB free" % free_gb,
            "" if free_gb > 20 else
            "free space — the 408-page reference project peaked around 14 GB")
    except Exception as e:
        add("disk.free", False, str(e), "")

    # fonts (only when a document is given)
    idml = (params or {}).get("idml")
    if idml:
        if not os.path.exists(idml):
            add("fonts.required", False, "idml not found: %s" % idml, "")
        else:
            sys.path.insert(0, PIPELINE)
            try:
                from resolve_fonts import required_faces
                faces = required_faces(idml)
                add("fonts.required", True,
                    "%d faces used: %s" % (len(faces),
                    ", ".join(sorted({f["postscript"] for f in faces}))),
                    "run resolve_fonts to classify + bundle them; note Adobe-Fonts "
                    "activation blocks packaging even for free fonts")
            except Exception as e:
                add("fonts.required", False, str(e)[:200], "")

    return {"ready": all(c["ok"] for c in checks), "checks": checks}


# --------------------------------------------------------------------------- #
# wrapped pipeline tools
# --------------------------------------------------------------------------- #

def _wrap_script(script, args):
    r = _run([sys.executable, os.path.join(PIPELINE, script)] + args, timeout=600)
    return {"exit": r.returncode, "stdout": r.stdout[-8000:], "stderr": r.stderr[-4000:]}


def resolve_fonts(params):
    idml, outdir = params.get("idml"), params.get("outdir")
    if not idml or not outdir:
        return {"error": "required: idml (document to read), outdir (where verified fonts land)"}
    args = [idml, outdir]
    if params.get("report"):
        args += ["--report", params["report"]]
    return _wrap_script("resolve_fonts.py", args)


def _needs_project(name):
    return {"error": ("%s wraps a pipeline script that still carries per-project "
                      "constants (extraction paths, document names) at the top of the "
                      "file. Edit pipeline/%s for your project first — and read "
                      "docs/SPEC.md §9: generalising these against a second real "
                      "document is the intended next milestone, not something this "
                      "server pretends is already done." % (name, name))}


def build_idml(params):
    if not params.get("configured"):
        return _needs_project("build_idml.py")
    args = [params.get("limit", "none"), params.get("out", "")]
    if params.get("seqs"):
        args.append(params["seqs"])
    return _wrap_script("build_idml.py", [a for a in args if a])


def audit_geometry(params):
    if not params.get("configured"):
        return _needs_project("audit_geometry.py")
    return _wrap_script("audit_geometry.py", [])


def compare_pages(params):
    if not params.get("configured"):
        return _needs_project("compare_pages.py")
    return _wrap_script("compare_pages.py", [str(params.get("top", 25))])


TOOLS = {
    "check_readiness": {
        "fn": check_readiness,
        "description": ("Verify the machine can run the Figma→InDesign pipeline: "
                        "InDesign + Photoshop presence and versions, scripting-bridge "
                        "round-trip, figma-limitless bridge port, disk space, and (given "
                        "an IDML) the fonts the document actually uses. Run FIRST; "
                        "refuse to start work until ready=true."),
        "schema": {"type": "object", "properties": {
            "idml": {"type": "string",
                     "description": "optional path to an IDML whose fonts to enumerate"}}},
    },
    "resolve_fonts": {
        "fn": resolve_fonts,
        "description": ("Classify and bundle a document's fonts. Open-licensed families "
                        "(OFL/Apache/UFL) are fetched from their authentic public source "
                        "and bundled only after their internal PostScript names verify "
                        "against what the document binds to; paid/restricted families are "
                        "reported, never bundled. Sidesteps the Adobe-Fonts packaging "
                        "lock legitimately: the bundled file is the open build."),
        "schema": {"type": "object", "required": ["idml", "outdir"], "properties": {
            "idml": {"type": "string"}, "outdir": {"type": "string"},
            "report": {"type": "string", "description": "optional JSON report path"}}},
    },
    "build_idml": {
        "fn": build_idml,
        "description": "Build the IDML from an extraction. Requires per-project configuration (see error).",
        "schema": {"type": "object", "properties": {
            "configured": {"type": "boolean",
                           "description": "set true after editing pipeline constants for your project"},
            "limit": {"type": "string"}, "out": {"type": "string"}, "seqs": {"type": "string"}}},
    },
    "audit_geometry": {
        "fn": audit_geometry,
        "description": ("Verification gate 8: every placed image's frame + crop vs the "
                        "Figma data. Requires per-project configuration (see error)."),
        "schema": {"type": "object", "properties": {"configured": {"type": "boolean"}}},
    },
    "compare_pages": {
        "fn": compare_pages,
        "description": ("Verification gate 9: render-level comparison of every page "
                        "against its Figma frame. Requires per-project configuration."),
        "schema": {"type": "object", "properties": {
            "configured": {"type": "boolean"}, "top": {"type": "integer"}}},
    },
}


# --------------------------------------------------------------------------- #
# MCP stdio plumbing (newline-delimited JSON-RPC 2.0)
# --------------------------------------------------------------------------- #

def _reply(mid, result=None, error=None):
    msg = {"jsonrpc": "2.0", "id": mid}
    if error is not None:
        msg["error"] = error
    else:
        msg["result"] = result
    sys.stdout.write(json.dumps(msg) + "\n")
    sys.stdout.flush()


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except ValueError:
            continue
        method, mid = req.get("method"), req.get("id")
        if method == "initialize":
            _reply(mid, {"protocolVersion": PROTOCOL_VERSION,
                         "capabilities": {"tools": {}},
                         "serverInfo": SERVER_INFO})
        elif method == "notifications/initialized":
            pass
        elif method == "tools/list":
            _reply(mid, {"tools": [
                {"name": name, "description": t["description"], "inputSchema": t["schema"]}
                for name, t in TOOLS.items()]})
        elif method == "tools/call":
            name = req.get("params", {}).get("name")
            args = req.get("params", {}).get("arguments") or {}
            tool = TOOLS.get(name)
            if not tool:
                _reply(mid, error={"code": -32602, "message": "unknown tool %r" % name})
                continue
            try:
                out = tool["fn"](args)
                _reply(mid, {"content": [{"type": "text",
                                          "text": json.dumps(out, indent=2)}],
                             "isError": bool(isinstance(out, dict) and out.get("error"))})
            except Exception as e:
                _reply(mid, {"content": [{"type": "text", "text": "tool failed: %s" % e}],
                             "isError": True})
        elif mid is not None:
            _reply(mid, error={"code": -32601, "message": "method %r not supported" % method})


if __name__ == "__main__":
    main()
