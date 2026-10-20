"""Cắt các trang PnP (lưới 3x3 thẻ, 3x2/2x2 quý tộc) trong art-src/ thành từng ảnh trong art-src/cut/."""
import sys, os
from PIL import Image
src = sys.argv[1]; out = os.path.join(src, 'cut'); os.makedirs(out, exist_ok=True)
GRIDS = {**{f'{i}.webp': (3, 3) for i in range(4, 14)}, '2.png': (2, 3), '3.png': (2, 2)}
for name, (cols, rows) in GRIDS.items():
    im = Image.open(os.path.join(src, name)).convert('RGB'); W, H = im.size
    for r in range(rows):
        for c in range(cols):
            x0, x1 = round(W * c / cols), round(W * (c + 1) / cols)
            y0, y1 = round(H * r / rows), round(H * (r + 1) / rows)
            cell = im.crop((x0 + 1, y0 + 1, x1 - 1, y1 - 1))
            cell.save(os.path.join(out, f'{name.split(".")[0]}_{r}{c}.png'))
print('ok')
