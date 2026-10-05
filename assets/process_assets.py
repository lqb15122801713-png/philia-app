from pathlib import Path
from PIL import Image

ASSETS = Path(r"D:\KimiData\kimi\tasks\2026-09-04\09-18-08-3ce29f8a\philia\assets")

# 1. Logo -> 512x512
logo = Image.open(ASSETS / "raw_logo.webp").convert("RGB")
logo.resize((512, 512), Image.LANCZOS).save(ASSETS / "philia-logo-512.png")

# 2. Tab icon: white silhouette on black -> transparent PNG (luminance as alpha)
icon = Image.open(ASSETS / "raw_icon.webp").convert("L")
icon = icon.resize((256, 256), Image.LANCZOS)
rgba = Image.new("RGBA", icon.size, (255, 252, 248, 0))  # cream-white
rgba.putalpha(icon)
rgba.save(ASSETS / "philia-tab-icon-color-256.png")

# 3. Empty-state illustration -> 800x600
empty = Image.open(ASSETS / "raw_empty.webp").convert("RGB")
empty.resize((800, 600), Image.LANCZOS).save(ASSETS / "philia-empty-appointments-800.png")

# 4. Banner -> 1200x500 (resize then center-crop)
banner = Image.open(ASSETS / "raw_banner.webp").convert("RGB")
w, h = banner.size
nh = round(1200 * h / w)  # ~514
banner = banner.resize((1200, nh), Image.LANCZOS)
top = (nh - 500) // 2
banner.crop((0, top, 1200, top + 500)).save(ASSETS / "philia-banner-home-1200.png")

for p in sorted(ASSETS.glob("philia-*.png")):
    im = Image.open(p)
    print(p.name, im.size, im.mode, p.stat().st_size, "bytes")
