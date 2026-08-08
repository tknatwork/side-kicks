// v2 CMYK pass: convert every ORIGINAL image (OriginalImages/) to CMYK without
// resampling — straight profile conversion, pixel dimensions untouched.
// Output: Links_CMYK_v2/<same basename>.jpg (quality 12, embedded profile).
// Resumable: skips files that already exist. Run in Photoshop via osascript.
//
// This pass also NORMALISES EXIF ORIENTATION, which the layout depends on: 106 of
// the photos carry an orientation flag, and while Figma (and a hand-placed image in
// InDesign) honour it, an image referenced from IDML is drawn from raw pixels with
// the flag ignored — and InDesign will not accept a rotation in an image's
// transform, so the 90-degree cases cannot be corrected in the layout. Photoshop
// applies the flag on open and writes upright pixels with no flag, which removes the
// discrepancy at source. Dimensions of those files therefore change (w/h transpose
// for the quarter turns) and the build reads them back afterwards.
//
// v1 traps that still apply: do NOT set app.displayDialogs (breaks PDF opens,
// not used here, but keep habits); `name` is a live ExtendScript global — use
// baseName; scripts must live in the project folder (Photoshop can't read
// /private/tmp).
var BASE = '/Users/tusharkant/Github Project/Others/Akanksha/';
var PROFILE = 'U.S. Web Coated (SWOP) v2';
var BUDGET = 2000;

var src = new Folder(BASE + 'OriginalImages');
var dst = new Folder(BASE + 'Links_CMYK_v2');
if (!dst.exists) { dst.create(); }

var jpgOpts = new JPEGSaveOptions();
jpgOpts.quality = 12;
jpgOpts.embedColorProfile = true;

// Images carrying transparency are listed by the caller (read from the PNG header —
// Photoshop's own isBackgroundLayer test is useless here, because EVERY png opens as
// a layer rather than a background). They stay RGB: JPEG cannot hold an alpha
// channel, and flattening them onto white would bake a background under artwork
// meant to sit on the page. PDF/X-1a converts them to CMYK on export, so the print
// file is CMYK throughout either way.
var alphaSet = {};
var af = new File(BASE + 'scripts/alpha-files.txt');
if (af.exists) {
    af.open('r');
    var al = af.read().split('\n');
    af.close();
    for (var a = 0; a < al.length; a++) {
        var t = al[a].replace(/[\r\s]/g, '');
        if (t) { alphaSet[t] = true; }
    }
}

var done = 0, skipped = 0, keptAlpha = 0, failed = [];
var files = src.getFiles(function (f2) { return f2 instanceof File && /\.(png|jpg|jpeg|gif|webp)$/i.test(f2.name); });
for (var i = 0; i < files.length && done < BUDGET; i++) {
    var fileName = decodeURI(files[i].name);
    var baseName = fileName.replace(/\.[^.]+$/, '');
    if (alphaSet[fileName]) { keptAlpha++; continue; }
    var outF = new File(dst.fsName + '/' + baseName + '.jpg');
    if (outF.exists) { skipped++; continue; }
    try {
        var d = app.open(files[i]);
        if (d.mode === DocumentMode.INDEXEDCOLOR || d.mode === DocumentMode.GRAYSCALE) {
            d.changeMode(ChangeMode.RGB);
        }
        if (d.mode !== DocumentMode.CMYK) {
            d.convertProfile(PROFILE, Intent.RELATIVECOLORIMETRIC, true, true);
        }
        d.flatten();
        d.bitsPerChannel = BitsPerChannelType.EIGHT;
        d.saveAs(outF, jpgOpts, true, Extension.LOWERCASE);
        d.close(SaveOptions.DONOTSAVECHANGES);
        done++;
    } catch (e) {
        failed.push(baseName.substr(0, 12));
        try { app.activeDocument.close(SaveOptions.DONOTSAVECHANGES); } catch (e2) {}
    }
}
'converted=' + done + ' skipped=' + skipped + ' keptAlphaAsPng=' + keptAlpha +
  ' inFolder=' + dst.getFiles('*.jpg').length +
  ' failed=' + failed.length + (failed.length ? ' :: ' + failed.slice(0, 5).join(',') : '');
