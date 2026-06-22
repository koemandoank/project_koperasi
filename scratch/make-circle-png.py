"""
Potong gambar maskot menjadi lingkaran dengan background transparan.
Simpan sebagai PNG yang benar (bukan copy dari JPG).
"""
from PIL import Image, ImageDraw
import os

src  = r"C:\Users\IT-Merak\.gemini\antigravity-ide\brain\fec380e8-90c9-4f98-bcc7-966bf0379e71\media__1780022203520.jpg"
dest = r"D:\laragon\www\koperasi-sulfindo\public\login-mascot.png"

img = Image.open(src).convert("RGBA")
w, h = img.size

# Buat mask lingkaran sempurna (anti-aliased dengan 4x size)
scale = 4
big_size = (w * scale, h * scale)
mask = Image.new("L", big_size, 0)
draw = ImageDraw.Draw(mask)
draw.ellipse((0, 0, big_size[0] - 1, big_size[1] - 1), fill=255)
mask = mask.resize((w, h), Image.LANCZOS)

# Terapkan mask ke gambar
output = Image.new("RGBA", (w, h), (0, 0, 0, 0))
output.paste(img, (0, 0))
output.putalpha(mask)

# Simpan sebagai PNG dengan transparansi
output.save(dest, "PNG", optimize=True)
print(f"Saved: {dest} ({w}x{h}px)")
