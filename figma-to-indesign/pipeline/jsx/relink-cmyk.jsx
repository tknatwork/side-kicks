// Point every link at its CMYK conversion, WITHOUT refitting.
//
// The v1 script reset each image to its frame (`graphic.geometricBounds =
// frame.geometricBounds`) because relinking preserves the old scale percentage and
// the replacement files had different pixel dimensions. That must NOT happen here:
// every picture carries a deliberate crop, and refitting would flatten all of them
// to "fill the frame". The CMYK conversion changes no pixel dimensions, so the
// preserved scale is exactly right and the crops survive untouched.
//
// Images with transparency have no CMYK counterpart and keep their RGB link; the
// PDF/X-1a export converts those.
app.scriptPreferences.userInteractionLevel = UserInteractionLevels.NEVER_INTERACT;
var BASE = '/Users/tusharkant/Github Project/Others/Akanksha/';
var d = null;
for (var i = 0; i < app.documents.length; i++) {
    if (String(app.documents[i].name).indexOf('Akanksha-Book-v2') === 0) { d = app.documents[i]; }
}
if (!d) { 'NO DOC'; } else {
    var out = [];

    // record the crops before touching anything, so any drift is visible afterwards
    var before = [];
    var gs = d.allGraphics;
    for (var g = 0; g < gs.length; g++) {
        var b = gs[g].geometricBounds;
        before.push([Math.round(b[1] * 10) / 10, Math.round(b[0] * 10) / 10,
                     Math.round((b[3] - b[1]) * 10) / 10, Math.round((b[2] - b[0]) * 10) / 10]);
    }

    var relinked = 0, noCmyk = 0, failed = 0;
    for (var k = 0; k < d.links.length; k++) {
        var lk = d.links[k];
        var nm = String(lk.name);
        var base = nm.replace(/\.[^.]+$/, '');
        var t = new File(BASE + 'Links_CMYK_v2/' + base + '.jpg');
        if (!t.exists) { noCmyk++; continue; }
        if (String(lk.filePath).indexOf('Links_CMYK_v2') !== -1) { continue; }
        try { lk.relink(t); relinked++; } catch (e) { failed++; }
    }
    out.push('relinked=' + relinked + ' noCmykCounterpart=' + noCmyk + ' failed=' + failed);

    var upd = 0;
    for (var u = 0; u < d.links.length; u++) {
        if (d.links[u].status !== LinkStatus.NORMAL) {
            try { d.links[u].update(); upd++; } catch (e2) {}
        }
    }
    out.push('linksUpdated=' + upd);

    // crops must be byte-for-byte where they were
    gs = d.allGraphics;
    var moved = 0, worst = 0;
    for (var m = 0; m < gs.length && m < before.length; m++) {
        var a = gs[m].geometricBounds;
        var now = [Math.round(a[1] * 10) / 10, Math.round(a[0] * 10) / 10,
                   Math.round((a[3] - a[1]) * 10) / 10, Math.round((a[2] - a[0]) * 10) / 10];
        var dmax = 0;
        for (var q = 0; q < 4; q++) { dmax = Math.max(dmax, Math.abs(now[q] - before[m][q])); }
        if (dmax > 0.5) { moved++; worst = Math.max(worst, dmax); }
    }
    out.push('cropsMoved=' + moved + ' worstShift=' + Math.round(worst * 10) / 10 + 'pt');

    var rgb = 0, below300 = 0, minPpi = 999999;
    for (var p = 0; p < gs.length; p++) {
        try {
            if (String(gs[p].space) === 'RGB') { rgb++; }
            var ppi = gs[p].effectivePpi[0];
            if (ppi < 300) { below300++; }
            if (ppi < minPpi) { minPpi = ppi; }
        } catch (e3) {}
    }
    var bad = 0;
    for (var n2 = 0; n2 < d.links.length; n2++) {
        if (d.links[n2].status !== LinkStatus.NORMAL) { bad++; }
    }
    var ov = 0;
    for (var s = 0; s < d.stories.length; s++) { if (d.stories[s].overflows) { ov++; } }
    out.push('stillRGB=' + rgb + ' below300ppi=' + below300 + ' minPpi=' + Math.round(minPpi) +
             ' linksNotNormal=' + bad + ' overset=' + ov);

    d.save();
    out.push('saved');
    out.join('\n');
}
