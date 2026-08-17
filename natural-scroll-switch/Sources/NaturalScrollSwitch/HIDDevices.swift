// Reading and classifying HID pointing devices from the IOKit registry.
//
// Everything here is a read-only registry walk — no IOHIDDevice is ever opened, which is why the tool needs
// no Input Monitoring (TCC) permission. `ioreg -c IOHIDDevice` and `hidutil list` show the same data.

import Foundation
import IOKit

// USB HID Usage Tables
let usagePageGenericDesktop = 1
let usageMouse = 2
let usagePageDigitizer = 13

struct UsagePair: Equatable, CustomStringConvertible {
    let page: Int
    let usage: Int
    var description: String { "(\(page),\(usage))" }
}

struct HIDDevice {
    let registryID: UInt64
    let product: String
    let manufacturer: String
    let vendorID: Int
    let productID: Int
    let transport: String
    let builtIn: Bool
    let usagePairs: [UsagePair]

    var hasMouseUsage: Bool { usagePairs.contains(UsagePair(page: usagePageGenericDesktop, usage: usageMouse)) }
    var hasDigitizerUsage: Bool { usagePairs.contains { $0.page == usagePageDigitizer } }
    var displayName: String { product.isEmpty ? "(unnamed vid=\(hex(vendorID)) pid=\(hex(productID)))" : product }

    /// Subject string for the config regexes: name, maker and IDs, so patterns can target any of them.
    var searchName: String { "\(manufacturer) \(product) vid=\(hex(vendorID)) pid=\(hex(productID))" }

    /// Built-in per the "Built-In" key, or the internal transports / naming Apple uses when that key is absent
    /// (Apple Silicon built-ins report FIFO, Intel/T2 report SPI).
    var isInternal: Bool {
        builtIn || transport == "FIFO" || transport == "SPI" || product.hasPrefix("Apple Internal ")
    }

    /// Apple Magic Trackpad 1 / 2 / USB-C over USB (vendor 0x05AC) or Bluetooth (vendor 0x004C). A hard
    /// exclusion because the Bluetooth report map's Digitizer collection cannot be relied on and the
    /// first-generation trackpad has none at all.
    var isAppleTrackpadByID: Bool {
        [0x05AC, 0x004C].contains(vendorID) && [0x030E, 0x0265, 0x0324].contains(productID)
    }

    /// Any Apple-made external pointing device: Apple's USB or Bluetooth-SIG vendor ID, an "Apple…"
    /// manufacturer, or a "Magic Mouse"/"Magic Trackpad" product string. (A Magic Mouse enumerates under a
    /// different vendor ID on cable vs Bluetooth, hence all three tests.)
    var isApplePointingDevice: Bool {
        [0x05AC, 0x004C].contains(vendorID)
            || manufacturer.lowercased().hasPrefix("apple")
            || product.range(of: "magic (mouse|trackpad)", options: [.regularExpression, .caseInsensitive]) != nil
    }
}

enum Verdict {
    case mouse(String)
    case ignored(String)

    var isMouse: Bool { if case .mouse = self { return true } else { return false } }
    var reason: String {
        switch self {
        case .mouse(let r), .ignored(let r): return r
        }
    }
}

/// Result of one registry walk. `failed` distinguishes "no mice attached" from "we could not look",
/// so a lookup failure never silently reads as "trackpad only".
struct DeviceScan {
    let devices: [HIDDevice]
    let failed: Bool
}

/// All IOHIDDevice registry entries that advertise the Mouse usage (page 1, usage 2).
func scanPointingDevices() -> DeviceScan {
    var iterator: io_iterator_t = 0
    let kr = IOServiceGetMatchingServices(kIOMainPortDefault, IOServiceMatching("IOHIDDevice"), &iterator)
    guard kr == KERN_SUCCESS else {
        log("WARN IOServiceGetMatchingServices failed (\(kr)) — keeping the current setting")
        return DeviceScan(devices: [], failed: true)
    }
    defer { IOObjectRelease(iterator) }

    var devices: [HIDDevice] = []
    var entry = IOIteratorNext(iterator)
    while entry != 0 {
        if let dev = readDevice(entry), dev.hasMouseUsage { devices.append(dev) }
        IOObjectRelease(entry)
        entry = IOIteratorNext(iterator)
    }
    return DeviceScan(devices: devices.sorted { $0.displayName < $1.displayName }, failed: false)
}

func readDevice(_ entry: io_registry_entry_t) -> HIDDevice? {
    var propsRef: Unmanaged<CFMutableDictionary>?
    guard IORegistryEntryCreateCFProperties(entry, &propsRef, kCFAllocatorDefault, 0) == KERN_SUCCESS,
          let props = propsRef?.takeRetainedValue() as? [String: Any] else { return nil }

    var registryID: UInt64 = 0
    IORegistryEntryGetRegistryEntryID(entry, &registryID)

    var pairs: [UsagePair] = []
    if let raw = props["DeviceUsagePairs"] as? [[String: Any]] {
        for p in raw {
            if let page = (p["DeviceUsagePage"] as? NSNumber)?.intValue,
               let usage = (p["DeviceUsage"] as? NSNumber)?.intValue {
                pairs.append(UsagePair(page: page, usage: usage))
            }
        }
    }
    // Some devices only publish PrimaryUsagePage/PrimaryUsage; treat that as a pair too.
    if let page = (props["PrimaryUsagePage"] as? NSNumber)?.intValue,
       let usage = (props["PrimaryUsage"] as? NSNumber)?.intValue {
        let primary = UsagePair(page: page, usage: usage)
        if !pairs.contains(primary) { pairs.append(primary) }
    }

    return HIDDevice(
        registryID: registryID,
        product: (props["Product"] as? String ?? "").trimmingCharacters(in: .whitespaces),
        manufacturer: (props["Manufacturer"] as? String ?? "").trimmingCharacters(in: .whitespaces),
        vendorID: (props["VendorID"] as? NSNumber)?.intValue ?? 0,
        productID: (props["ProductID"] as? NSNumber)?.intValue ?? 0,
        transport: props["Transport"] as? String ?? "?",
        builtIn: (props["Built-In"] as? NSNumber)?.boolValue ?? false,
        usagePairs: pairs
    )
}

// MARK: - Classification policy

func matches(_ patterns: [String], _ text: String) -> String? {
    for p in patterns where !p.isEmpty {
        if text.range(of: p, options: [.regularExpression, .caseInsensitive]) != nil { return p }
    }
    return nil
}

/// Decide whether a Mouse-usage HID device is a third-party mouse we should react to.
func classify(_ d: HIDDevice, _ cfg: Config) -> Verdict {
    if let p = matches(cfg.forceMousePatterns, d.searchName) { return .mouse("forced by config pattern /\(p)/") }
    if d.isInternal { return .ignored(d.builtIn ? "built-in" : "internal transport/name (\(d.transport))") }
    if d.isAppleTrackpadByID { return .ignored("Apple Magic Trackpad by vendor/product ID") }
    if cfg.appleDevicesUseNatural && d.isApplePointingDevice {
        return .ignored("Apple pointing device (Magic Mouse/Trackpad) → keeps natural scrolling")
    }
    if d.hasDigitizerUsage { return .ignored("has Digitizer usage page 13 → trackpad/touch surface") }
    if let p = matches(cfg.ignorePatterns, d.searchName) { return .ignored("matches ignore pattern /\(p)/") }
    return .mouse("external HID mouse")
}
