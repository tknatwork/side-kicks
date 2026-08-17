#!/usr/bin/env swift
// Generates AppIcon.icns — a gradient squircle carrying a two-way scroll glyph.
// Run via scripts/build-app.sh; needs no assets and no design tool.
//
//   swift scripts/make-icon.swift <output.icns>

import AppKit
import Foundation

let outputPath = CommandLine.arguments.count > 1
    ? CommandLine.arguments[1]
    : FileManager.default.currentDirectoryPath + "/AppIcon.icns"

/// Draw the icon at an arbitrary size. Everything is expressed as a fraction of `s` so every slice is sharp.
func drawIcon(size s: CGFloat, into ctx: CGContext) {
    ctx.saveGState()

    // --- squircle plate, inset like the macOS icon grid ---
    let inset = s * 0.055
    let rect = CGRect(x: inset, y: inset, width: s - inset * 2, height: s - inset * 2)
    let plate = CGPath(roundedRect: rect, cornerWidth: rect.width * 0.2237,
                       cornerHeight: rect.height * 0.2237, transform: nil)
    ctx.addPath(plate)
    ctx.clip()

    let colors = [
        CGColor(red: 0.267, green: 0.318, blue: 0.706, alpha: 1),   // indigo
        CGColor(red: 0.180, green: 0.514, blue: 0.898, alpha: 1),   // blue
    ] as CFArray
    if let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors,
                                 locations: [0, 1]) {
        ctx.drawLinearGradient(gradient, start: CGPoint(x: rect.minX, y: rect.maxY),
                               end: CGPoint(x: rect.maxX, y: rect.minY), options: [])
    }

    // subtle top sheen so the plate does not read as flat colour
    ctx.setFillColor(CGColor(gray: 1, alpha: 0.10))
    ctx.fillEllipse(in: CGRect(x: rect.minX - rect.width * 0.2, y: rect.midY,
                               width: rect.width * 1.4, height: rect.height * 0.9))
    ctx.resetClip()

    // --- glyph: two arrows pointing opposite ways (scroll direction, switched) ---
    let cx = s / 2, cy = s / 2
    let gap = s * 0.105          // horizontal distance of each shaft from centre
    let half = s * 0.185         // half the shaft length
    let lw = max(1, s * 0.062)   // stroke weight
    let head = s * 0.085         // arrowhead half-width

    ctx.setStrokeColor(CGColor(gray: 1, alpha: 1))
    ctx.setFillColor(CGColor(gray: 1, alpha: 1))
    ctx.setLineWidth(lw)
    ctx.setLineCap(.round)
    ctx.setLineJoin(.round)
    ctx.setShadow(offset: CGSize(width: 0, height: -s * 0.012), blur: s * 0.03,
                  color: CGColor(red: 0, green: 0, blue: 0, alpha: 0.22))

    /// One arrow: vertical shaft with a chevron head at the pointing end.
    func arrow(x: CGFloat, up: Bool) {
        let tipY = up ? cy + half : cy - half
        let tailY = up ? cy - half : cy + half
        ctx.move(to: CGPoint(x: x, y: tailY))
        ctx.addLine(to: CGPoint(x: x, y: tipY))
        ctx.strokePath()

        let backY = up ? tipY - head * 1.05 : tipY + head * 1.05
        ctx.move(to: CGPoint(x: x - head, y: backY))
        ctx.addLine(to: CGPoint(x: x, y: tipY))
        ctx.addLine(to: CGPoint(x: x + head, y: backY))
        ctx.strokePath()
    }

    arrow(x: cx - gap, up: true)
    arrow(x: cx + gap, up: false)
    ctx.restoreGState()
}

func png(size: Int) -> Data {
    guard let ctx = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0,
                              space: CGColorSpaceCreateDeviceRGB(),
                              bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else {
        FileHandle.standardError.write(Data("make-icon: could not create a bitmap context\n".utf8))
        exit(1)
    }
    ctx.setAllowsAntialiasing(true)
    drawIcon(size: CGFloat(size), into: ctx)
    guard let image = ctx.makeImage() else { exit(1) }
    let rep = NSBitmapImageRep(cgImage: image)
    rep.size = NSSize(width: size, height: size)
    guard let data = rep.representation(using: .png, properties: [:]) else { exit(1) }
    return data
}

// Standard iconset slices: (points, scale)
let slices: [(Int, Int)] = [(16, 1), (16, 2), (32, 1), (32, 2), (128, 1), (128, 2), (256, 1), (256, 2),
                            (512, 1), (512, 2)]

let tmp = URL(fileURLWithPath: NSTemporaryDirectory())
    .appendingPathComponent("NaturalScrollSwitch-\(getpid()).iconset")
try? FileManager.default.removeItem(at: tmp)
try FileManager.default.createDirectory(at: tmp, withIntermediateDirectories: true)

for (points, scale) in slices {
    let name = scale == 1 ? "icon_\(points)x\(points).png" : "icon_\(points)x\(points)@2x.png"
    try png(size: points * scale).write(to: tmp.appendingPathComponent(name))
}

let convert = Process()
convert.executableURL = URL(fileURLWithPath: "/usr/bin/iconutil")
convert.arguments = ["-c", "icns", tmp.path, "-o", outputPath]
try convert.run()
convert.waitUntilExit()
try? FileManager.default.removeItem(at: tmp)

guard convert.terminationStatus == 0 else {
    FileHandle.standardError.write(Data("make-icon: iconutil failed\n".utf8))
    exit(convert.terminationStatus)
}
print("icon written: \(outputPath)")
