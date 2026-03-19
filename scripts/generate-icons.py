#!/usr/bin/env python3
"""Generate all app icons from a source image for Tauri + web favicon."""

import sys
import os
from pathlib import Path
from PIL import Image

def make_square(img):
    """Center image on a square transparent canvas."""
    size = max(img.width, img.height)
    square = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    x = (size - img.width) // 2
    y = (size - img.height) // 2
    square.paste(img, (x, y))
    return square

def main():
    root = Path(__file__).resolve().parent.parent
    src = root / "rv_icon.png"

    if not src.exists():
        print(f"Source icon not found: {src}")
        sys.exit(1)

    img = Image.open(src).convert("RGBA")
    square = make_square(img)

    # Tauri icons
    tauri_icons = root / "src-tauri" / "icons"
    tauri_icons.mkdir(parents=True, exist_ok=True)

    sizes = {
        "32x32.png": 32,
        "128x128.png": 128,
        "128x128@2x.png": 256,
    }

    for name, size in sizes.items():
        resized = square.resize((size, size), Image.LANCZOS)
        resized.save(tauri_icons / name, "PNG")
        print(f"  Created {name} ({size}x{size})")

    # ICO file (contains 16, 32, 48, 256)
    ico_sizes = [(16, 16), (32, 32), (48, 48), (256, 256)]
    ico_images = [square.resize(s, Image.LANCZOS) for s in ico_sizes]
    ico_images[0].save(
        tauri_icons / "icon.ico",
        format="ICO",
        sizes=ico_sizes,
        append_images=ico_images[1:],
    )
    print("  Created icon.ico")

    # ICNS via iconutil (macOS)
    iconset = root / "icon.iconset"
    iconset.mkdir(exist_ok=True)

    icns_sizes = {
        "icon_16x16.png": 16,
        "icon_16x16@2x.png": 32,
        "icon_32x32.png": 32,
        "icon_32x32@2x.png": 64,
        "icon_128x128.png": 128,
        "icon_128x128@2x.png": 256,
        "icon_256x256.png": 256,
        "icon_256x256@2x.png": 512,
        "icon_512x512.png": 512,
        "icon_512x512@2x.png": 1024,
    }

    for name, size in icns_sizes.items():
        resized = square.resize((size, size), Image.LANCZOS)
        resized.save(iconset / name, "PNG")

    os.system(f"iconutil -c icns -o '{tauri_icons / 'icon.icns'}' '{iconset}'")
    print("  Created icon.icns")

    # Cleanup iconset
    import shutil
    shutil.rmtree(iconset)

    # Web favicon
    static = root / "static"
    static.mkdir(exist_ok=True)

    favicon = square.resize((32, 32), Image.LANCZOS)
    favicon.save(static / "favicon.png", "PNG")
    print("  Created static/favicon.png")

    # Also save a 180x180 apple-touch-icon and 192x192 for PWA
    apple = square.resize((180, 180), Image.LANCZOS)
    apple.save(static / "apple-touch-icon.png", "PNG")
    print("  Created static/apple-touch-icon.png")

    icon192 = square.resize((192, 192), Image.LANCZOS)
    icon192.save(static / "icon-192.png", "PNG")
    print("  Created static/icon-192.png")

    icon512 = square.resize((512, 512), Image.LANCZOS)
    icon512.save(static / "icon-512.png", "PNG")
    print("  Created static/icon-512.png")

    print("\nDone! All icons generated.")

if __name__ == "__main__":
    main()
