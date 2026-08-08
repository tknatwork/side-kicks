// Place exported SVGs into the frames the builder emitted for them.
// Reads scripts/svg-place-jobs.tsv: frameName <TAB> svgRelPath <TAB> type <TAB> nodeName
// (ExtendScript has no JSON global, hence TSV.) Rows with an empty svg path are
// pending exports and are reported, not placed.
app.scriptPreferences.userInteractionLevel = UserInteractionLevels.NEVER_INTERACT;
var BASE = '/Users/tusharkant/Github Project/Others/Akanksha/';
var d = null;
for (var i = 0; i < app.documents.length; i++) {
    if (String(app.documents[i].name).indexOf('Akanksha-Book-v2') === 0) { d = app.documents[i]; }
}
if (!d) { 'NO DOC'; } else {
    var fh = new File(BASE + 'scripts/svg-place-jobs.tsv');
    if (!fh.exists) { 'no svg-place-jobs.tsv — nothing to do'; } else {
        fh.open('r');
        var lines = fh.read().split('\n');
        fh.close();

        var byName = {};
        for (var t = 0; t < d.textFrames.length; t++) { }   // (text frames not needed)
        for (var r = 0; r < d.rectangles.length; r++) {
            byName[String(d.rectangles[r].name)] = d.rectangles[r];
        }

        var placed = 0, pending = 0, missing = [], failed = [];
        for (var k = 0; k < lines.length; k++) {
            var row = lines[k].replace(/\r/g, '');
            if (!row) { continue; }
            var parts = row.split('\t');
            var frameName = parts[0];
            var svgRel = parts[1];
            if (!svgRel) { pending++; continue; }
            var fr = byName[frameName];
            if (!fr) { missing.push(frameName); continue; }
            var svgFile = new File(BASE + svgRel);
            if (!svgFile.exists) { missing.push(frameName + ':nofile'); continue; }
            try {
                fr.place(svgFile);
                // fit the vector to the frame it was measured for
                if (fr.allGraphics.length) {
                    fr.allGraphics[0].geometricBounds = fr.geometricBounds;
                }
                placed++;
            } catch (e) { failed.push(frameName + ':' + String(e).substr(0, 40)); }
        }
        var out = 'svgPlaced=' + placed + ' pendingExports=' + pending +
                  ' framesMissing=' + missing.length +
                  (missing.length ? ' :: ' + missing.slice(0, 5).join(',') : '') +
                  ' failed=' + failed.length +
                  (failed.length ? ' :: ' + failed.slice(0, 3).join(',') : '');
        if (placed) { d.save(); out += ' | saved'; }
        out;
    }
}
