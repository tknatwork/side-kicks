// Standalone preflight on the working document. The profile has to be resolved by
// iterating app.preflightProfiles — passing itemByName(...) straight into
// preflightProcesses.add() yields "Expected PreflightProfile, but received nothing".
app.scriptPreferences.userInteractionLevel = UserInteractionLevels.NEVER_INTERACT;
var d = null;
for (var i = 0; i < app.documents.length; i++) {
    if (String(app.documents[i].name).indexOf('Akanksha-Book-v2') === 0) { d = app.documents[i]; }
}
if (!d) { 'NO DOC'; } else {
    var prof = app.preflightProfiles[0];
    for (var p = 0; p < app.preflightProfiles.length; p++) {
        if (String(app.preflightProfiles[p].name) === '[Basic]') { prof = app.preflightProfiles[p]; }
    }
    var pr = app.preflightProcesses.add(d, prof);
    pr.waitForProcess();
    var res = String(pr.processResults).split('\n')[0];
    try { pr.remove(); } catch (e) {}
    var ov = 0;
    for (var s = 0; s < d.stories.length; s++) { if (d.stories[s].overflows) { ov++; } }
    var bad = 0;
    for (var k = 0; k < d.links.length; k++) {
        if (d.links[k].status !== LinkStatus.NORMAL) { bad++; }
    }
    var mf = 0;
    for (var f = 0; f < d.fonts.length; f++) {
        if (d.fonts[f].status !== FontStatus.INSTALLED) { mf++; }
    }
    'PREFLIGHT: ' + res + '\npages=' + d.pages.length + ' spreads=' + d.spreads.length +
      ' overset=' + ov + ' linksNotNormal=' + bad + ' fontsNotInstalled=' + mf;
}
