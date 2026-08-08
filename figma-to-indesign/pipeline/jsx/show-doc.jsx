// Bring the v2 document to the front, ready to page through: first spread, fit in
// window, normal (non-preview) view so frames and guides are visible.
app.scriptPreferences.userInteractionLevel = UserInteractionLevels.INTERACT_WITH_ALL;
var BASE = '/Users/tusharkant/Github Project/Others/Akanksha/';
var d = null;
for (var i = 0; i < app.documents.length; i++) {
    if (String(app.documents[i].name).indexOf('Akanksha-Book-v2') === 0) { d = app.documents[i]; }
}
if (!d) {
    d = app.open(new File(BASE + 'Akanksha-Book-v2.indd'));
}
var w = (d.windows.length ? d.windows[0] : d.windows.add());
app.activeDocument = d;
try { app.activeWindow = w; } catch (e0) {}
try { w.activePage = d.pages[0]; } catch (e) {}
try { w.zoom(ZoomOptions.FIT_SPREAD); } catch (e2) {}
try { w.screenMode = ScreenModeOptions.PREVIEW_OFF; } catch (e3) {}
'open: ' + d.name + '  pages=' + d.pages.length + ' spreads=' + d.spreads.length +
  '  firstPage=' + d.pages[0].name + ' (' + d.pages[0].side + ')';
