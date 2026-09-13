import AppKit

let size = 1024
let outPath = CommandLine.arguments[1]

let rep = NSBitmapImageRep(
	bitmapDataPlanes: nil,
	pixelsWide: size,
	pixelsHigh: size,
	bitsPerSample: 8,
	samplesPerPixel: 4,
	hasAlpha: true,
	isPlanar: false,
	colorSpaceName: .deviceRGB,
	bytesPerRow: 0,
	bitsPerPixel: 0
)!

let ctx = NSGraphicsContext(bitmapImageRep: rep)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = ctx

let cg = ctx.cgContext
let bounds = CGRect(x: 0, y: 0, width: CGFloat(size), height: CGFloat(size))

// 圆角背景
let radius = CGFloat(size) * 0.22
let path = CGPath(
	roundedRect: bounds,
	cornerWidth: radius,
	cornerHeight: radius,
	transform: nil
)
cg.addPath(path)
cg.clip()

// 暖黄渐变
let colors = [
	CGColor(red: 1.0, green: 0.855, blue: 0.47, alpha: 1.0),
	CGColor(red: 0.98, green: 0.72, blue: 0.16, alpha: 1.0),
] as CFArray
let gradient = CGGradient(
	colorsSpace: CGColorSpaceCreateDeviceRGB(),
	colors: colors,
	locations: [0.0, 1.0]
)!
cg.drawLinearGradient(
	gradient,
	start: CGPoint(x: 0, y: CGFloat(size)),
	end: CGPoint(x: 0, y: 0),
	options: []
)

// 居中绘制 🐶
let font = NSFont.systemFont(ofSize: CGFloat(size) * 0.72)
let attr = NSAttributedString(
	string: "🐶",
	attributes: [.font: font]
)
let textSize = attr.size()
attr.draw(
	at: NSPoint(
		x: (CGFloat(size) - textSize.width) / 2.0,
		y: (CGFloat(size) - textSize.height) / 2.0
	)
)

NSGraphicsContext.restoreGraphicsState()

try! rep.representation(using: .png, properties: [:])!.write(
	to: URL(fileURLWithPath: outPath)
)
