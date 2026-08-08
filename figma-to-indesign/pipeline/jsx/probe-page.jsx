// List every item on a given page (by page NAME) with its bounds, so a suspect
// page can be checked against the Figma data without guessing.
// Page name is read from scripts/probe-page.txt.
app.scriptPreferences.userInteractionLevel = UserInteractionLevels.NEVER_INTERACT;
var BASE = '/Users/tusharkant/Github Project/Others/Akanksha/';
var fh = new File(BASE + 'scripts/probe-page.txt');
fh.open('r');
var want = fh.read().replace(/[\r\n\s]/g, '');
fh.close();

var d = null;
for (var i = 0; i < app.documents.length; i++) {
    if (String(app.documents[i].name).indexOf('Akanksha-Book-v2') === 0) { d = app.documents[i]; }
}
if (!d) { 'NO DOC'; } else {
    var pg = null;
    for (var p = 0; p < d.pages.length; p++) {
        if (String(d.pages[p].name) === want) { pg = d.pages[p]; break; }
    }
    if (!pg) { 'page ' + want + ' not found'; } else {
        var out = ['page ' + want + ' side=' + pg.side + ' bounds=' + pg.bounds.join(',')];
        var items = pg.allPageItems;
        out.push('items=' + items.length);
        for (var k = 0; k < items.length; k++) {
            var it = items[k];
            var gb = it.geometricBounds;
            var kind = String(it.constructor.name);
            var extra = '';
            try {
                if (kind === 'TextFrame') { extra = ' "' + String(it.parentStory.contents).substr(0, 22) + '"'; }
                else if (it.graphics.length) { extra = ' img=' + String(it.graphics[0].itemLink.name).substr(0, 14); }
            } catch (e) {}
            out.push('  ' + kind + ' ' + String(it.name) +
                     ' [x' + Math.round(gb[1]) + ' y' + Math.round(gb[0]) +
                     ' w' + Math.round(gb[3] - gb[1]) + ' h' + Math.round(gb[2] - gb[0]) + ']' + extra);
        }
        out.join('\n');
    }
}
