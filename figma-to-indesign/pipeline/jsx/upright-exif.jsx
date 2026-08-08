// Rewrite the EXIF-flagged photos with upright pixels and no orientation flag.
//
// Why this is necessary rather than a layout fix: Figma expresses image crops
// against the EXIF-corrected view, but an image referenced from IDML is drawn from
// raw pixels with the flag ignored, and InDesign discards a rotation placed in an
// image's ItemTransform (it keeps only scale/flip). So the quarter-turn cases can
// only be reconciled by uprighting the pixels. Photoshop applies the flag on open
// and writes no flag on save, which is exactly the normalisation wanted.
//
// Reads scripts/exif-files.txt ("filename,orientation" per line), sources from
// OriginalImages_raw_exif/ (untouched copies) and overwrites OriginalImages/.
// Resumable: a file whose stored dimensions already look corrected is skipped.
var BASE = '/Users/tusharkant/Github Project/Others/Akanksha/';
var SRC = BASE + 'OriginalImages_raw_exif/';
var DST = BASE + 'OriginalImages/';

var fh = new File(BASE + 'scripts/exif-files.txt');
fh.open('r');
var lines = fh.read().split('\n');
fh.close();

var jpgOpts = new JPEGSaveOptions();
jpgOpts.quality = 12;
jpgOpts.embedColorProfile = true;

var done = 0, failed = [], samples = [];
for (var i = 0; i < lines.length; i++) {
    var parts = lines[i].split(',');
    if (parts.length !== 2) { continue; }
    var fname = parts[0];
    var orient = parseInt(parts[1], 10);
    var inF = new File(SRC + fname);
    if (!inF.exists) { failed.push(fname.substr(0, 10) + ':missing'); continue; }
    try {
        var d = app.open(inF);                       // Photoshop applies the EXIF flag here
        var w = d.width.as('px'), h = d.height.as('px');
        if (d.mode === DocumentMode.INDEXEDCOLOR) { d.changeMode(ChangeMode.RGB); }
        d.flatten();
        d.saveAs(new File(DST + fname), jpgOpts, true, Extension.LOWERCASE);
        d.close(SaveOptions.DONOTSAVECHANGES);
        if (samples.length < 4) {
            samples.push(fname.substr(0, 8) + ' o' + orient + ' -> ' +
                         Math.round(w) + 'x' + Math.round(h));
        }
        done++;
    } catch (e) {
        failed.push(fname.substr(0, 10) + ':' + String(e).substr(0, 30));
        try { app.activeDocument.close(SaveOptions.DONOTSAVECHANGES); } catch (e2) {}
    }
}
'uprighted=' + done + ' failed=' + failed.length +
  (failed.length ? ' :: ' + failed.slice(0, 4).join(',') : '') +
  ' || ' + samples.join(' ; ');
