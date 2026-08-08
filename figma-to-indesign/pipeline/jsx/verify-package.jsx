// Open the PACKAGED copy (not the working document) and confirm it stands on its
// own: links resolving inside the package folder, no missing fonts, no overset,
// preflight clean. A package that silently still points at the original project
// tree looks fine here and breaks on the recipient's machine.
app.scriptPreferences.userInteractionLevel = UserInteractionLevels.NEVER_INTERACT;
var PKG = '/Users/tusharkant/Github Project/Others/Akanksha/Akanksha-Book-v2-Package/';
var out = [];
var d = app.open(new File(PKG + 'Akanksha-Book-v2.indd'), false);
out.push('opened pages=' + d.pages.length + ' spreads=' + d.spreads.length +
         ' links=' + d.links.length);

var outside = 0, bad = 0, sample = '';
for (var k = 0; k < d.links.length; k++) {
    var lk = d.links[k];
    var p = String(lk.filePath);
    if (p.indexOf('Akanksha-Book-v2-Package') === -1) {
        outside++;
        if (!sample) { sample = p; }
    }
    if (lk.status !== LinkStatus.NORMAL) { bad++; }
}
out.push('linksOutsidePackage=' + outside + (sample ? ' e.g. ' + sample : '') +
         '  linksNotNormal=' + bad);

var missingFonts = [];
for (var f = 0; f < d.fonts.length; f++) {
    if (d.fonts[f].status !== FontStatus.INSTALLED) {
        missingFonts.push(String(d.fonts[f].name).replace(/\t/g, ' '));
    }
}
out.push('fonts=' + d.fonts.length + ' notInstalled=' + missingFonts.length +
         (missingFonts.length ? ' :: ' + missingFonts.join(',') : ''));

var ov = 0;
for (var s = 0; s < d.stories.length; s++) { if (d.stories[s].overflows) { ov++; } }
out.push('overset=' + ov);

var prof = app.preflightProfiles[0];
for (var p2 = 0; p2 < app.preflightProfiles.length; p2++) {
    if (String(app.preflightProfiles[p2].name) === '[Basic]') { prof = app.preflightProfiles[p2]; }
}
var pr = app.preflightProcesses.add(d, prof);
pr.waitForProcess();
out.push('PREFLIGHT: ' + String(pr.processResults).split('\n')[0]);
try { pr.remove(); } catch (e) {}

d.close(SaveOptions.NO);
out.join('\n');
