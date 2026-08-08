// Export every page as a small PNG for bulk comparison against the Figma renders.
// 36 dpi (421x298) is plenty to catch a wrong picture, a wrong crop or a missing
// element, and keeps 408 files manageable.
app.scriptPreferences.userInteractionLevel = UserInteractionLevels.NEVER_INTERACT;
var BASE = '/Users/tusharkant/Github Project/Others/Akanksha/';
var d = null;
for (var i = 0; i < app.documents.length; i++) {
    if (String(app.documents[i].name).indexOf('Akanksha-Book-v2') === 0) { d = app.documents[i]; }
}
if (!d) { 'NO DOC'; } else {
    var folder = new Folder(BASE + 'proofs/all');
    if (!folder.exists) { folder.create(); }
    app.pngExportPreferences.exportResolution = 36;
    app.pngExportPreferences.pngQuality = PNGQualityEnum.MEDIUM;
    app.pngExportPreferences.pngExportRange = PNGExportRangeEnum.EXPORT_RANGE;
    app.pngExportPreferences.exportingSpread = false;
    var done = 0, failed = 0;
    for (var p = 0; p < d.pages.length; p++) {
        try {
            app.pngExportPreferences.pageString = String(d.pages[p].name);
            // file name is the sequence number, so it lines up with the Figma renders
            d.exportFile(ExportFormat.PNG_FORMAT,
                         new File(folder.fsName + '/s' + (p + 1) + '.png'), false);
            done++;
        } catch (e) { failed++; }
    }
    'exported=' + done + ' failed=' + failed;
}
