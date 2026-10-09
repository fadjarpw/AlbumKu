"""Buat foto sintetis untuk pengujian lokal; tidak memakai foto milik pengguna."""
from pathlib import Path
from PIL import Image, ImageDraw

out = Path(__file__).resolve().parents[1] / "work" / "qa-fixtures"
out.mkdir(parents=True, exist_ok=True)
colors = ["#e13b3b", "#24a174", "#368ce6", "#e1a838", "#964ccd", "#d15299", "#22a6a6", "#bb783b", "#78813c", "#595fd0"]
for index, color in enumerate(colors, 1):
    image = Image.new("RGB", (800, 600), color)
    draw = ImageDraw.Draw(image)
    draw.rectangle((80, 60, 720, 540), outline="white", width=12)
    draw.line((0, 0, 800, 600), fill="white", width=6)
    draw.text((350, 290), f"FOTO {index:02}", fill="black", stroke_width=1)
    image.save(out / f"IMG_202401{index:02}_120000.jpg", quality=92)
print(out)
