"""Xuất ảnh thẻ/quý tộc đã cắt (art-src/cut) thành public/art/c{id}.jpg, n{id}.jpg theo tools/cardmap.py."""
import json, os, subprocess, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
here = os.path.dirname(os.path.abspath(__file__)); root = os.path.dirname(here)
cut = os.path.join(root, 'art-src', 'cut'); out = os.path.join(root, 'public', 'art'); os.makedirs(out, exist_ok=True)
m = json.loads(subprocess.run([sys.executable, '-I', os.path.join(here, 'cardmap.py'), '--json'], capture_output=True, text=True, encoding='utf-8').stdout.strip().splitlines()[-1])
SIZE = (170, 238)  # mọi thẻ cùng kích thước
def load(cell): return Image.open(os.path.join(cut, cell + '.png')).convert('RGB')
def save(im, name): im.resize(SIZE, Image.LANCZOS).save(os.path.join(out, name), quality=90)
for cid, cell in m['cards'].items(): save(load(cell), f'c{cid}.jpg')

# Thẻ 39 (đỏ cấp 1, 1 điểm, 4 trắng) bị trùng trên bản in: ghép từ thẻ đỏ {3 trắng} + vòng "4 trắng" + số điểm "1".
if '39' not in m['cards']:
    base, donor = load('5_00'), load('13_00')
    r = 17; mask = Image.new('L', (2 * r, 2 * r), 0); ImageDraw.Draw(mask).ellipse((1, 1, 2 * r - 2, 2 * r - 2), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(.8))
    dx, dy = 24, 147; bx, by = 22, 223
    base.paste(donor.crop((dx - r, dy - r, dx + r, dy + r)), (bx - r, by - r), mask)
    d = ImageDraw.Draw(base); f = ImageFont.truetype('C:/Windows/Fonts/georgiai.ttf', 40)
    d.text((14, 3), '1', font=f, fill='white', stroke_width=2, stroke_fill='#3a3a3a')
    save(base, 'c39.jpg')

# Quý tộc: thay yêu cầu trong data.js bằng bộ quý tộc thật in trên ảnh, giữ thứ tự ô -> id 0..9
C = dict(w='white', b='blue', g='green', r='red', k='black')
nobles = []
for i, (cell, s) in enumerate(m['N'].items()):
    im = load(cell); w, h = im.size; s0 = min(w, h); im = im.crop(((w - s0) // 2, (h - s0) // 2, (w + s0) // 2, (h + s0) // 2))
    im.resize((180, 180), Image.LANCZOS).save(os.path.join(out, f'n{i}.jpg'), quality=90)
    nobles.append({'id': i, 'points': 3, 'req': {C[t[0]]: int(t[1:]) for t in s.split()}})
print(json.dumps(nobles))
