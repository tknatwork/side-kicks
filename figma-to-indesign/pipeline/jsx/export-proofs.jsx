// Export a set of pages as PNG proofs for visual verification against Figma.
// Page numbers are passed via scripts/proof-pages.txt (one InDesign page NAME per
// line — note names start at "2" because the booklet section starts numbering at 2).
// Output: proofs/p<name>.png
app.scriptPreferences.userInteractionLevel = UserInteractionLevels.NEVER_INTERACT;
var BASE = '/Users/tusharkant/Github Project/Others/Akanksha/';

var d = null;
for (var i = 0; i < app.documents.length; i++) {
    if (String(app.documents[i].name).indexOf('Akanksha-Book-v2') === 0) { d = app.documents[i]; }
}
if (!d) { 'NO DOC OPEN'; } else {
    var fh = new File(BASE + 'scripts/proof-pages.txt');
    fh.open('r');
    var wanted = fh.read().split('\n');
    fh.close();

    var folder = new Folder(BASE + 'proofs');
    if (!folder.exists) { folder.create(); }

    app.pngExportPreferences.exportResolution = 96;
    app.pngExportPreferences.pngQuality = PNGQualityEnum.HIGH;
    app.pngExportPreferences.pngExportRange = PNGExportRangeEnum.EXPORT_RANGE;
    app.pngExportPreferences.exportingSpread = false;

    var done = 0, failed = [];
    for (var w = 0; w < wanted.length; w++) {
        var nm = wanted[w].replace(/[\r\s]/g, '');
        if (!nm) { continue; }
        try {
            app.pngExportPreferences.pageString = nm;
            d.exportFile(ExportFormat.PNG_FORMAT, new File(folder.fsName + '/p' + nm + '.png'), false);
            done++;
        } catch (e) { failed.push(nm); }
    }
    'exported=' + done + ' failed=' + failed.length + (failed.length ? ' :: ' + failed.join(',') : '');
}
