// Reading and setting macOS "natural scrolling".
//
// How the setting really works (established by disassembling PreferencePanesSupport, SkyLight and
// activateSettings on macOS 26.5, and confirmed on real hardware):
//
//   * ~/Library/Preferences/.GlobalPreferences.plist is only READ at login, by loginwindow →
//     activateSettings, which pushes the value into WindowServer. So `defaults write` alone changes nothing
//     until you log out and back in.
//   * The LIVE state is a single global flag inside WindowServer, set through the SkyLight SPI
//     SLSSetSwipeScrollDirection(cid, 0|1) (a.k.a. CGSSetSwipeScrollDirection).
//   * "SwipeScrollDirectionDidChangeNotification" does NOT flip scrolling; it only tells System Settings,
//     Control Center and Accessibility Zoom to re-read the preference.
//
// System Settings' own toggle calls PreferencePanesSupport `setSwipeScrollDirection(BOOL)`, which performs
// all three steps. We call that same function, and fall back to doing the three steps by hand.

import Foundation

let prefKey = "com.apple.swipescrolldirection" as CFString
let prefChangedNotification = "SwipeScrollDirectionDidChangeNotification"

private typealias SLSMainConnectionIDFn = @convention(c) () -> Int32
private typealias SLSSetSwipeScrollDirectionFn = @convention(c) (Int32, Int32) -> Int32
/// The BOOL arrives in x0 and is compared against 1, so pass a full Int 0/1.
private typealias PPSSetSwipeScrollDirectionFn = @convention(c) (Int) -> Void

private func loadSymbol<T>(_ handle: UnsafeMutableRawPointer?, _ name: String, _: T.Type) -> T? {
    guard let handle = handle, let p = dlsym(handle, name) else { return nil }
    return unsafeBitCast(p, to: T.self)
}

private let skyLightHandle = dlopen("/System/Library/PrivateFrameworks/SkyLight.framework/SkyLight", RTLD_NOW)
private let ppsHandle = dlopen(
    "/System/Library/PrivateFrameworks/PreferencePanesSupport.framework/PreferencePanesSupport", RTLD_NOW)
private let slsMainConnectionID = loadSymbol(skyLightHandle, "SLSMainConnectionID", SLSMainConnectionIDFn.self)
private let slsSetSwipeScrollDirection = loadSymbol(
    skyLightHandle, "SLSSetSwipeScrollDirection", SLSSetSwipeScrollDirectionFn.self)
private let ppsSetSwipeScrollDirection = loadSymbol(
    ppsHandle, "setSwipeScrollDirection", PPSSetSwipeScrollDirectionFn.self)

/// Which apply path is available on this macOS version (shown by `status`, logged at startup).
var applyMechanism: String {
    if ppsSetSwipeScrollDirection != nil {
        return "PreferencePanesSupport.setSwipeScrollDirection (same as System Settings)"
    }
    if slsMainConnectionID != nil && slsSetSwipeScrollDirection != nil {
        return "SkyLight SLSSetSwipeScrollDirection + CFPreferences + notification"
    }
    return "PREFERENCE ONLY — no WindowServer SPI on this macOS; changes apply at next login"
}

var hasLiveApplyMechanism: Bool {
    ppsSetSwipeScrollDirection != nil || (slsMainConnectionID != nil && slsSetSwipeScrollDirection != nil)
}

/// Current preference value, interpreted exactly as macOS does: missing or non-boolean means natural (true).
/// nil is returned only when the key is absent, so `status` can say "unset".
func readNaturalScrolling() -> Bool? {
    CFPreferencesAppSynchronize(kCFPreferencesAnyApplication)  // drop any stale in-process cache
    guard let v = CFPreferencesCopyAppValue(prefKey, kCFPreferencesAnyApplication) else { return nil }
    guard CFGetTypeID(v) == CFBooleanGetTypeID() else { return true }  // e.g. `-int 0` still reads as natural
    return CFBooleanGetValue((v as! CFBoolean))
}

/// Set natural scrolling live AND persist it — the three steps the Trackpad/Mouse settings pane performs.
func writeNaturalScrolling(_ on: Bool) {
    if let f = ppsSetSwipeScrollDirection {
        f(on ? 1 : 0)   // WindowServer flag + CFPreferences + synchronize + distributed notification
        return
    }
    if let cid = slsMainConnectionID, let setLive = slsSetSwipeScrollDirection {
        _ = setLive(cid(), on ? 1 : 0)          // (1) live WindowServer flag
    }
    CFPreferencesSetValue(prefKey, on ? kCFBooleanTrue : kCFBooleanFalse,   // (2) persist for next login
                          kCFPreferencesAnyApplication, kCFPreferencesCurrentUser, kCFPreferencesAnyHost)
    if !CFPreferencesSynchronize(kCFPreferencesAnyApplication, kCFPreferencesCurrentUser, kCFPreferencesAnyHost) {
        log("WARN CFPreferencesSynchronize returned false — the preference may not have been saved")
    }
    DistributedNotificationCenter.default().postNotificationName(   // (3) refresh System Settings et al
        Notification.Name(prefChangedNotification), object: nil, userInfo: nil, deliverImmediately: true)
}
