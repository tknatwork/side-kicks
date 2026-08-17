// swift-tools-version: 5.9
import PackageDescription

// Two products from one package:
//   natural-scroll-switch  — the CLI + launchd daemon. Foundation + IOKit only, no AppKit, so the
//                            background agent stays lean.
//   NaturalScrollSwitchApp — the double-clickable installer/status front end. AppKit; it shells out to
//                            the CLI so both paths share exactly one implementation.
let package = Package(
    name: "NaturalScrollSwitch",
    platforms: [.macOS(.v12)],
    products: [
        .executable(name: "natural-scroll-switch", targets: ["NaturalScrollSwitch"]),
        .executable(name: "NaturalScrollSwitchApp", targets: ["NaturalScrollSwitchApp"]),
    ],
    targets: [
        .executableTarget(name: "NaturalScrollSwitch", path: "Sources/NaturalScrollSwitch"),
        .executableTarget(name: "NaturalScrollSwitchApp", path: "Sources/NaturalScrollSwitchApp"),
    ]
)
