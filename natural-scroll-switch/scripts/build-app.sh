#!/bin/bash
# build-app.sh — build the universal binaries, assemble "Natural Scroll Switch.app", sign it, and package
# a .zip and a .dmg into dist/. This is what the release workflow runs; it works locally too.
#
#   ./scripts/build-app.sh              # build + package
#   ./scripts/build-app.sh --no-package # just the .app
#
# Signing: if a Developer ID is available it is used and the result can be notarized. Otherwise the bundle is
# ad-hoc signed (codesign -s -), which is the minimum an arm64 binary needs in order to run at all.
# Set SIGN_IDENTITY="Developer ID Application: …" to force a specific identity.
set -euo pipefail

APP_NAME="Natural Scroll Switch"
BUNDLE_ID="io.github.tknatwork.natural-scroll-switch"
CLI_NAME="natural-scroll-switch"
APP_EXECUTABLE="NaturalScrollSwitchApp"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="$(tr -d ' \n' < "$ROOT/VERSION")"
BUILD_DIR="$ROOT/.build/universal"
DEPLOYMENT_TARGET="12.0"
DIST="$ROOT/dist"
APP="$DIST/$APP_NAME.app"
PACKAGE=1
case "${1:-}" in
  "")            ;;
  --no-package)  PACKAGE=0 ;;
  *)             echo "unknown option: $1 (expected --no-package)" >&2; exit 2 ;;
esac

step() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

command -v swiftc >/dev/null 2>&1 || {
  echo "swiftc not found. Install Xcode or the Command Line Tools (xcode-select --install)." >&2; exit 1; }

# The Command-Line-Tools swiftc does NOT infer an SDK: without -sdk it fails with
#   "unable to load standard library for target 'arm64-apple-macos12.0'"
# Full Xcode does infer one, which is why this is easy to miss. Always pass it explicitly.
SDK="$(xcrun --sdk macosx --show-sdk-path 2>/dev/null || true)"
[ -n "$SDK" ] || { echo "could not locate the macOS SDK (try: xcode-select --install)" >&2; exit 1; }

step "Building universal binaries (arm64 + x86_64), version $VERSION"
echo "    SDK: $SDK"
rm -rf "$DIST" "$BUILD_DIR"
mkdir -p "$DIST" "$BUILD_DIR"

# swiftc + lipo rather than `swift build --arch arm64 --arch x86_64`: the SwiftPM multi-arch path needs
# XCBuild, i.e. full Xcode, and fails on a Command-Line-Tools-only Mac with
#   "xcbuild executable at ... does not exist".
# Package.swift is still the canonical layout for `swift build` and IDEs; this script does not use it.
build_universal() {   # <output name> <source glob dir> [extra swiftc args…]
  local name="$1" srcdir="$2"; shift 2
  for arch in arm64 x86_64; do
    swiftc -O -swift-version 5 -target "$arch-apple-macos$DEPLOYMENT_TARGET" -sdk "$SDK" \
           -Xlinker -dead_strip "$@" \
           -o "$BUILD_DIR/$name-$arch" "$ROOT/$srcdir"/*.swift
    strip -x "$BUILD_DIR/$name-$arch"
  done
  lipo -create -output "$BUILD_DIR/$name" "$BUILD_DIR/$name-arm64" "$BUILD_DIR/$name-x86_64"
  # lipo does NOT carry the per-slice signatures over; without this the fat file reads as unsigned and
  # will not run on Apple Silicon. Re-signed properly further down, this is just to keep it launchable.
  codesign --force --sign - --timestamp=none "$BUILD_DIR/$name"
}

build_universal "$CLI_NAME" "Sources/NaturalScrollSwitch"
build_universal "$APP_EXECUTABLE" "Sources/NaturalScrollSwitchApp"

for f in "$CLI_NAME" "$APP_EXECUTABLE"; do
  lipo -info "$BUILD_DIR/$f" | sed 's/^/    /'
done

step "Assembling $APP_NAME.app"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BUILD_DIR/$APP_EXECUTABLE" "$APP/Contents/MacOS/$APP_EXECUTABLE"
cp "$BUILD_DIR/$CLI_NAME" "$APP/Contents/Resources/$CLI_NAME"   # copied out to ~/Library on install
chmod +x "$APP/Contents/MacOS/$APP_EXECUTABLE" "$APP/Contents/Resources/$CLI_NAME"
swift "$ROOT/scripts/make-icon.swift" "$APP/Contents/Resources/AppIcon.icns" >/dev/null
printf 'APPL????' > "$APP/Contents/PkgInfo"

cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleName</key><string>$APP_NAME</string>
	<key>CFBundleDisplayName</key><string>$APP_NAME</string>
	<key>CFBundleIdentifier</key><string>$BUNDLE_ID</string>
	<key>CFBundleVersion</key><string>$VERSION</string>
	<key>CFBundleShortVersionString</key><string>$VERSION</string>
	<key>CFBundlePackageType</key><string>APPL</string>
	<key>CFBundleExecutable</key><string>$APP_EXECUTABLE</string>
	<key>CFBundleIconFile</key><string>AppIcon</string>
	<key>LSMinimumSystemVersion</key><string>$DEPLOYMENT_TARGET</string>
	<key>LSUIElement</key><true/>
	<key>NSHighResolutionCapable</key><true/>
	<key>NSHumanReadableCopyright</key><string>MIT licensed. Copyright (c) 2026 Tushar Kant Naik</string>
</dict>
</plist>
PLIST
plutil -lint "$APP/Contents/Info.plist" >/dev/null

step "Signing"
IDENTITY="${SIGN_IDENTITY:-}"
if [ -z "$IDENTITY" ]; then
  IDENTITY="$(security find-identity -v -p codesigning 2>/dev/null \
    | awk -F'"' '/Developer ID Application/{print $2; exit}')"
fi
if [ -n "$IDENTITY" ]; then
  echo "    identity: $IDENTITY (notarizable)"
  EXTRA=(--options runtime --timestamp)
else
  echo "    no Developer ID found — ad-hoc signing (users will see one Gatekeeper prompt; see README)"
  IDENTITY="-"
  EXTRA=()
fi
# Inner binaries first, then the bundle: --deep is deprecated and signs nested code in the wrong order.
codesign --force --sign "$IDENTITY" "${EXTRA[@]+"${EXTRA[@]}"}" "$APP/Contents/Resources/$CLI_NAME"
codesign --force --sign "$IDENTITY" "${EXTRA[@]+"${EXTRA[@]}"}" "$APP/Contents/MacOS/$APP_EXECUTABLE"
codesign --force --sign "$IDENTITY" "${EXTRA[@]+"${EXTRA[@]}"}" "$APP"
codesign --verify --strict --verbose=2 "$APP" 2>&1 | sed 's/^/    /'

if [ "$PACKAGE" = "1" ]; then
  step "Packaging"
  ZIP="$DIST/NaturalScrollSwitch-$VERSION.zip"
  DMG="$DIST/NaturalScrollSwitch-$VERSION.dmg"
  # ditto preserves the bundle's symlinks, permissions and extended attributes; `zip` does not.
  ditto -c -k --sequesterRsrc --keepParent "$APP" "$ZIP"

  STAGE="$(mktemp -d)"
  trap 'rm -rf "$STAGE"' EXIT   # a failed cp/ln/hdiutil would otherwise leave a full copy of the .app behind
  cp -R "$APP" "$STAGE/"
  ln -s /Applications "$STAGE/Applications"
  hdiutil create -quiet -volname "$APP_NAME" -srcfolder "$STAGE" -ov -format UDZO "$DMG"

  ( cd "$DIST" && shasum -a 256 ./*.zip ./*.dmg > SHA256SUMS.txt )
  echo
  ls -lh "$DIST" | sed 's/^/    /'
  echo
  cat "$DIST/SHA256SUMS.txt" | sed 's/^/    /'
fi

step "Done"
echo "app: $APP"
echo "try it with:  open \"$APP\""
