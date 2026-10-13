"""Render platform icons from the project's simple SVG rectangle source (Pillow).

Run from any directory: python3 packages/ui-tokens/assets/render-icons.py
No input bitmap is edited, and no remote asset or font is required.
"""
from pathlib import Path
import xml.etree.ElementTree as ET
from PIL import Image, ImageDraw

ASSETS = Path(__file__).resolve().parent
ROOT = ASSETS.parents[2]


def render(source, size, inset=0, monochrome=False):
    svg = ET.parse(ASSETS / source).getroot()
    image = Image.new("RGBA", (size * 4, size * 4), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    scale = size * 4 * (1 - 2 * inset) / 512
    offset = size * 4 * inset
    for rect in svg.findall("{http://www.w3.org/2000/svg}rect"):
        attrs = rect.attrib
        x, y = float(attrs.get("x", 0)), float(attrs.get("y", 0))
        width, height = float(attrs["width"]), float(attrs["height"])
        box = (offset + x * scale, offset + y * scale,
               offset + (x + width) * scale, offset + (y + height) * scale)
        fill = "#ffffff" if monochrome else attrs["fill"]
        draw.rounded_rectangle(box, radius=float(attrs.get("rx", 0)) * scale, fill=fill)
    return image.resize((size, size), Image.Resampling.LANCZOS)


def save(relative, size, source="app-icon.svg", **options):
    target = ROOT / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    render(source, size, **options).save(target)


for name, size in (("icon.png", 1024), ("splash-icon.png", 288), ("favicon.png", 48)):
    save(f"apps/mobile/assets/{name}", size, "market-mark.svg" if name == "splash-icon.png" else "app-icon.svg")
for name in ("adaptive-icon.png", "monochrome-icon.png"):
    save(f"apps/mobile/assets/{name}", 1024, "market-mark.svg", inset=0.12, monochrome=name.startswith("monochrome"))
save("apps/mobile/assets/notification-icon.png", 96, "market-mark.svg", monochrome=True)
Image.new("RGB", (1024, 1024), "#0b0c0e").save(ROOT / "apps/mobile/assets/icon-background.png")
for name in ("icon.png", "icon-macos.png"):
    save(f"apps/desktop/assets/{name}", 1024, inset=0.08 if name == "icon-macos.png" else 0)
render("app-icon.svg", 256).save(ROOT / "apps/desktop/assets/icon.ico", sizes=[(16,16), (32,32), (48,48), (64,64), (128,128), (256,256)])
for name, size in (("favicon-16x16.png",16), ("favicon-32x32.png",32), ("apple-touch-icon.png",180), ("icon-192.png",192), ("icon-512.png",512)):
    save(f"apps/web/public/{name}", size)
render("app-icon.svg", 64).save(ROOT / "apps/web/public/favicon.ico", sizes=[(16,16), (32,32), (48,48), (64,64)])
(ROOT / "apps/web/public/favicon.svg").write_text((ASSETS / "app-icon.svg").read_text(), encoding="utf-8")
save("packages/ui-tokens/assets/MarketBot.icon/Assets/market-mark.png", 1024, "market-mark.svg")
print("Rendered owned project icons from SVG sources.")
