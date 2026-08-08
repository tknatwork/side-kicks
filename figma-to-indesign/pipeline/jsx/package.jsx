// Package the document for hand-off: InDesign copies the .indd, every linked image
// and every font into one folder and repoints the links, so the recipient can open
// and edit it without the original project tree.
//
// Fonts are included — Inter ships under the SIL Open Font License, which permits
// bundling — so the type is right on a machine that does not have it installed.
// The PDF is NOT regenerated here (that is a ~20 minute export and a current one
// already exists); it is copied in afterwards.
app.scriptPreferences.userInteractionLevel = UserInteractionLevels.NEVER_INTERACT;
var BASE = '/Users/tusharkant/Github Project/Others/Akanksha/';
var d = null;
for (var i = 0; i < app.documents.length; i++) {
    if (String(app.documents[i].name).indexOf('Akanksha-Book-v2') === 0) { d = app.documents[i]; }
}
if (!d) { 'NO DOC'; } else {
    var target = new Folder(BASE + 'Akanksha-Book-v2-Package');
    if (!target.exists) { target.create(); }
    var out = ['packaging to: ' + target.fsName];
    var ok = d.packageForPrint(
        target,      // to
        true,        // copyingFonts
        true,        // copyingLinkedGraphics
        true,        // copyingProfiles
        true,        // updatingGraphics
        false,       // includingHiddenLayers
        true,        // ignorePreflightErrors (preflight is clean)
        true,        // creatingReport
        true,        // includeIdml
        false,       // includePDF - copied in separately, already exported
        '',          // pdfStyle
        false,       // useDocumentHyphenationExceptionsOnly
        '',          // versionComments
        true);       // forceSave
    out.push('packageForPrint returned: ' + ok);
    out.join('\n');
}
