import AppKit
import CoreText
import Foundation

// The icon is the deck's own cover slide, shrunk: paper ground, the short
// clinical rule, then the display letter in Instrument Serif. Same motif as
// `capa` in SlideView.tsx, so the icon and the first slide read as one thing.
// The rule stays left-aligned to the letter's stem rather than centred under
// it — that asymmetry is what makes it the cover slide and not a monogram.
let size = 1024.0

let paper = NSColor(srgbRed: 0xF7/255.0, green: 0xF6/255.0, blue: 0xF2/255.0, alpha: 1)
let ink = NSColor(srgbRed: 0x0E/255.0, green: 0x1B/255.0, blue: 0x2A/255.0, alpha: 1)
let clinical = NSColor(srgbRed: 0x0D/255.0, green: 0x7A/255.0, blue: 0x6F/255.0, alpha: 1)

let fontURL = URL(fileURLWithPath: CommandLine.arguments[1])
guard let dataProvider = CGDataProvider(url: fontURL as CFURL),
      let cgFont = CGFont(dataProvider) else { fatalError("font unreadable") }

// No alpha channel at all: iOS rejects an icon with one, and a flattened RGB
// bitmap is the only way to be sure none survives the PNG encoder.
guard let ctx = CGContext(data: nil, width: Int(size), height: Int(size),
                          bitsPerComponent: 8, bytesPerRow: 0,
                          space: CGColorSpace(name: CGColorSpace.sRGB)!,
                          bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)
else { fatalError("no context") }

ctx.setFillColor(paper.cgColor)
ctx.fill(CGRect(x: 0, y: 0, width: size, height: size))

let font = CTFontCreateWithGraphicsFont(cgFont, 620, nil, nil)
let line = CTLineCreateWithAttributedString(NSAttributedString(
  string: "M", attributes: [.font: font, .foregroundColor: ink.cgColor]))

// Measured ink bounds, not typographic metrics: Instrument Serif's line box
// carries far more leading than the capital fills, so centring on the box
// leaves the M visibly high and the rule sitting on its shoulders.
let glyph = CTLineGetBoundsWithOptions(line, .useGlyphPathBounds)

let ruleHeight = 26.0
let ruleGap = 84.0
let ruleWidth = glyph.width * 0.62

// Centre the rule-plus-letter group as one object, so the optical weight sits
// in the middle of the rounded-corner mask rather than the raw square.
let groupHeight = ruleHeight + ruleGap + glyph.height
let groupBottom = (size - groupHeight) / 2
let groupLeft = (size - glyph.width) / 2

ctx.setFillColor(clinical.cgColor)
ctx.fill(CGRect(x: groupLeft, y: groupBottom + glyph.height + ruleGap,
                width: ruleWidth, height: ruleHeight))

ctx.textPosition = CGPoint(x: groupLeft - glyph.origin.x,
                           y: groupBottom - glyph.origin.y)
CTLineDraw(line, ctx)

guard let image = ctx.makeImage() else { fatalError("no image") }
let rep = NSBitmapImageRep(cgImage: image)
guard let png = rep.representation(using: .png, properties: [:]) else {
  fatalError("no png")
}
try png.write(to: URL(fileURLWithPath: CommandLine.arguments[2]))
print("wrote \(CommandLine.arguments[2])")

// Regenerate:
//   swift scripts/app-icon.swift assets/fonts/InstrumentSerif-Regular.ttf \
//     assets/app-icon.png
//   dart run flutter_launcher_icons
