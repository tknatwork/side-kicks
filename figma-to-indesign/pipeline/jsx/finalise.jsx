// Open the v2 IDML, turn it into the facing-page booklet, clear overset, save .indd.
// Long-running (408 pages / 848 links) — run via osascript in the background and
// poll the redirected output file.
//
// Booklet parity: every Figma canvas row is a full L|R pair, so InDesign page 1 must
// be a VERSO. Numbering starts at 2 (even == left in default binding), which parks
// page 1 on the left without shuffling any content.
//
// Overset policy: Figma does not clip overflowing text, so growing a frame downward
// is faithful to the source. Try a small leading reduction first (invisible), then
// auto-size height.
app.scriptPreferences.userInteractionLevel = UserInteractionLevels.NEVER_INTERACT;
var BASE = '/Users/tusharkant/Github Project/Others/Akanksha/';
var out = [];

for (var q = app.documents.length - 1; q >= 0; q--) {
    if (String(app.documents[q].name).indexOf('Akanksha-Book-v2') === 0) {
        app.documents[q].close(SaveOptions.NO);
    }
}

var d = app.open(new File(BASE + 'Akanksha-Book-v2.idml'), true);
out.push('opened pages=' + d.pages.length + ' spreads=' + d.spreads.length +
         ' links=' + d.links.length);

// --- booklet ---------------------------------------------------------------
d.documentPreferences.facingPages = true;
try {
    var sec = d.sections[0];
    sec.continueNumbering = false;
    sec.pageNumberStart = 2;
} catch (e) { out.push('section err: ' + e); }

var two = 0, one = 0, other = 0;
for (var s = 0; s < d.spreads.length; s++) {
    var pc = d.spreads[s].pages.length;
    if (pc === 2) { two++; } else if (pc === 1) { one++; } else { other++; }
}
out.push('afterFacing spreads=' + d.spreads.length + ' 2p=' + two + ' 1p=' + one +
         ' other=' + other + ' pages=' + d.pages.length);
out.push('page1side=' + d.pages[0].side + ' page2side=' + d.pages[1].side);

// --- overset ---------------------------------------------------------------
// Grow the frame downward from its top edge. A blanket leading reduction is NOT
// used: many of these stories mix type sizes (title + body in one frame), and
// setting one leading across the story would flatten the typography.
var fixedGrow = 0, stillOver = [], grownPages = [];
for (var t = 0; t < d.stories.length; t++) {
    var st = d.stories[t];
    if (!st.overflows) { continue; }
    var tf = null;
    try { tf = st.textContainers[0]; } catch (e1) { continue; }
    var pageName = '?';
    try { pageName = String(tf.parentPage.name); } catch (e2) {}
    try {
        var before = tf.geometricBounds;
        tf.textFramePreferences.autoSizingReferencePoint =
            AutoSizingReferenceEnum.TOP_LEFT_POINT;
        tf.textFramePreferences.autoSizingType = AutoSizingTypeEnum.HEIGHT_ONLY;
        var after = tf.geometricBounds;
        if (!st.overflows) {
            fixedGrow++;
            if (grownPages.length < 40) {
                grownPages.push(pageName + '+' + Math.round(after[2] - before[2]));
            }
        } else { stillOver.push(pageName); }
    } catch (e5) { stillOver.push(pageName + ':' + e5); }
}
out.push('oversetFixedByGrow=' + fixedGrow + ' stillOverset=' + stillOver.length +
         (stillOver.length ? ' :: ' + stillOver.slice(0, 10).join(',') : ''));
out.push('grown(page+pt): ' + grownPages.join(' '));

var ovFinal = 0;
for (var v = 0; v < d.stories.length; v++) { if (d.stories[v].overflows) { ovFinal++; } }
out.push('finalOverset=' + ovFinal);

var badLinks = 0;
for (var k = 0; k < d.links.length; k++) {
    if (d.links[k].status !== LinkStatus.NORMAL) { badLinks++; }
}
out.push('linksNotNormal=' + badLinks);

d.save(new File(BASE + 'Akanksha-Book-v2.indd'));
out.push('saved indd');
out.join('\n');
