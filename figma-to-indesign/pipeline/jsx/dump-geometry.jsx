// Dump placed geometry for every graphic so it can be checked numerically against
// the Figma extract. One CSV row per image:
//   node, page, frameX, frameY, frameW, frameH, imgX, imgY, imgW, imgH, ppi, link
// Bounds are spread-relative: a recto page's items are offset by +842pt in x.
app.scriptPreferences.userInteractionLevel = UserInteractionLevels.NEVER_INTERACT;
var BASE = '/Users/tusharkant/Github Project/Others/Akanksha/';
var d = null;
for (var i = 0; i < app.documents.length; i++) {
    if (String(app.documents[i].name).indexOf('Akanksha-Book-v2') === 0) { d = app.documents[i]; }
}
if (!d) { 'NO DOC'; } else {
    var rows = ['node,page,side,fx,fy,fw,fh,ix,iy,iw,ih,ppi,link'];
    var gs = d.allGraphics;
    for (var g = 0; g < gs.length; g++) {
        var gr = gs[g];
        try {
            var fr = gr.parent;
            var fb = fr.geometricBounds;      // [y1,x1,y2,x2]
            var ib = gr.geometricBounds;
            var pg = '?', side = '?';
            try { pg = String(fr.parentPage.name); side = String(fr.parentPage.side); } catch (e) {}
            var ppi = 0;
            try { ppi = Math.round(gr.effectivePpi[0]); } catch (e2) {}
            var ln = '';
            try { ln = String(gr.itemLink.name); } catch (e3) {}
            rows.push([String(fr.name), pg, side,
                       Math.round(fb[1] * 10) / 10, Math.round(fb[0] * 10) / 10,
                       Math.round((fb[3] - fb[1]) * 10) / 10, Math.round((fb[2] - fb[0]) * 10) / 10,
                       Math.round(ib[1] * 10) / 10, Math.round(ib[0] * 10) / 10,
                       Math.round((ib[3] - ib[1]) * 10) / 10, Math.round((ib[2] - ib[0]) * 10) / 10,
                       ppi, ln].join(','));
        } catch (e4) {}
    }
    var fh = new File(BASE + 'scripts/geometry-dump.csv');
    fh.open('w');
    fh.write(rows.join('\n'));
    fh.close();
    'rows=' + (rows.length - 1);
}
