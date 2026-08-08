// Final deliverables: save the .indd, export the interchange .idml, and export the
// print file as PDF/X-1a:2001 (CMYK, fonts embedded, transparency flattened).
app.scriptPreferences.userInteractionLevel = UserInteractionLevels.NEVER_INTERACT;
var BASE = '/Users/tusharkant/Github Project/Others/Akanksha/';
var d = null;
for (var i = 0; i < app.documents.length; i++) {
    if (String(app.documents[i].name).indexOf('Akanksha-Book-v2') === 0) { d = app.documents[i]; }
}
if (!d) { 'NO DOC'; } else {
    var out = [];
    d.save();
    out.push('saved indd: pages=' + d.pages.length + ' spreads=' + d.spreads.length);

    d.exportFile(ExportFormat.INDESIGN_MARKUP,
                 new File(BASE + 'Akanksha-Book-v2-export.idml'), false);
    out.push('exported idml');

    var preset = null;
    for (var p = 0; p < app.pdfExportPresets.length; p++) {
        if (String(app.pdfExportPresets[p].name).indexOf('PDF/X-1a:2001') !== -1) {
            preset = app.pdfExportPresets[p];
        }
    }
    if (preset) {
        d.exportFile(ExportFormat.PDF_TYPE,
                     new File(BASE + 'Akanksha-Book-v2_PRINT_X1a.pdf'), false, preset);
        out.push('exported PDF/X-1a');
    } else {
        out.push('PDF/X-1a preset NOT FOUND — no print pdf written');
    }
    out.join('\n');
}
