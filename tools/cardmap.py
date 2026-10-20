"""Bảng đọc tay từng ô ảnh (trang_hàngcột) -> 'màu điểm chi_phí', dùng w b g r k. Chạy để khớp với public/data.js."""
import json, re, sys, os
T = {
 '4_00': 'b 0 k3', '4_01': 'b 1 r4', '4_02': 'b 0 w1 k2', '4_10': 'b 0 g2 k2', '4_11': 'b 0 w1 g2 r2', '4_12': 'b 0 b1 g3 r1',
 '4_20': 'b 0 w1 g1 r2 k1', '4_21': 'b 0 w1 g1 r1 k1', '4_22': 'r 0 w2 g1 k2',
 '5_00': 'r 0 w3', '5_01': 'r 0 w1 r1 k3', '5_02': 'r 0 b2 g1', '5_10': 'r 0 w2 r2', '5_11': 'r 0 w1 r1 k3', '5_12': 'r 0 w1 b1 g1 k1',
 '5_20': 'r 0 w2 b1 g1 k1', '5_21': 'k 1 b4', '5_22': 'k 0 g3',
 '6_00': 'k 0 g2 r1', '6_01': 'k 0 w2 g2', '6_02': 'k 0 w2 b2 r1', '6_10': 'k 0 g1 r3 k1', '6_11': 'k 0 w1 b1 g1 r1', '6_12': 'k 0 w1 b2 g1 r1',
 '6_20': 'g 1 k4', '6_21': 'g 0 r3', '6_22': 'g 0 w2 b1',
 '7_00': 'g 0 w1 b3 g1', '7_01': 'g 0 b1 r2 k2', '7_02': 'g 0 b2 r2', '7_10': 'g 0 w1 b1 r1 k1', '7_11': 'g 0 w1 b1 r1 k2', '7_12': 'w 0 b2 k2',
 '7_20': 'w 0 r2 k1', '7_21': 'w 1 g4', '7_22': 'w 0 b3',
 '8_00': 'w 0 b1 g1 r1 k1', '8_01': 'w 0 b1 g2 r1 k1', '8_02': 'w 0 b2 g2 k1', '8_10': 'w 1 g3 r2 k2', '8_11': 'b 4 w7', '8_12': 'w 0 w3 b1 k1',
 '8_20': 'w 2 g1 r4 k2', '8_21': 'w 1 w2 b3 r3', '8_22': 'b 3 w3 g3 r3 k5',
 '9_00': 'b 1 b2 g2 r3', '9_01': 'b 1 b2 g3 k3', '9_02': 'b 2 w5 b3', '9_10': 'b 2 w2 r1 k4', '9_11': 'b 3 b6', '9_12': 'b 2 b5',
 '9_20': 'r 3 r6', '9_21': 'r 2 k5', '9_22': 'r 2 w3 k5',
 '10_00': 'r 2 w1 b4 g2', '10_01': 'r 1 b3 r2 k3', '10_02': 'r 1 w2 r2 k3', '10_10': 'k 3 k6', '10_11': 'k 2 w5', '10_12': 'k 2 g5 r3',
 '10_20': 'k 2 b1 g4 r2', '10_21': 'k 1 w3 g3 k2', '10_22': 'k 1 w3 b2 g2',
 '11_00': 'k 5 r7 k3', '11_01': 'k 3 w3 b3 g5 r3', '11_02': 'r 4 g7', '11_10': 'r 5 g7 r3', '11_11': 'r 4 b3 g6 r3', '11_12': 'r 3 w3 b5 g3 k3',
 '11_20': 'b 5 w7 b3', '11_21': 'b 4 w6 b3 k3', '11_22': 'k 4 g3 r6 k3',
 '12_00': 'w 5 w3 k7', '12_01': 'w 4 k7', '12_02': 'w 3 b3 g3 r5 k3', '12_10': 'w 4 w3 r3 k6', '12_11': 'g 4 w3 b6 g3', '12_12': 'g 4 b7',
 '12_20': 'g 3 w5 b3 r3 k3', '12_21': 'k 4 r7', '12_22': 'g 5 b7 g3',
 '13_00': 'g 2 w4 b2 k1', '13_01': 'g 1 w3 g2 r3', '13_02': 'g 1 w2 b3 k2', '13_10': 'g 3 g6', '13_11': 'g 2 b5 g3', '13_12': 'g 2 g5',
 '13_20': 'w 3 w6', '13_21': 'w 2 r5', '13_22': 'w 2 r5 k3',
}
# quý tộc: 2.png lưới 2 cột x 3 hàng, 3.png 2x2
N = {'2_00': 'b4 g4', '2_01': 'k4 r4', '2_10': 'g3 b3 r3', '2_11': 'k3 r3 w3', '2_20': 'k3 r3 g3', '2_21': 'b4 w4',
     '3_00': 'r4 g4', '3_01': 'g3 b3 w3', '3_10': 'k3 b3 w3', '3_11': 'k4 w4'}
C = dict(w='white', b='blue', g='green', r='red', k='black')
def cost(tokens): return {C[t[0]]: int(t[1:]) for t in tokens}
src = open(os.path.join(os.path.dirname(__file__), '..', 'public', 'data.js'), encoding='utf-8').read()
D = json.loads(re.search(r'var D=(\{.*\});', src).group(1))
key = lambda bonus, pts, c: (bonus, pts, tuple(sorted((k, v) for k, v in c.items() if v)))
idx = {key(c['bonus'], c['points'], c['cost']): c['id'] for c in D['cards']}
cards, bad, used = {}, [], {}
for cell, s in T.items():
    p = s.split(); k = key(C[p[0]], int(p[1]), cost(p[2:]))
    if k not in idx: bad.append((cell, s)); continue
    i = idx[k]
    if i in used: print('TRÙNG', cell, 'với', used[i], '->', s); continue
    used[i] = cell; cards[i] = cell
print('không khớp data:', bad)
print('thẻ thiếu ảnh:', [(c['id'], c['level'], c['bonus'], c['points'], {k: v for k, v in c['cost'].items() if v}) for c in D['cards'] if c['id'] not in cards])
nidx = {tuple(sorted((k, v) for k, v in n['req'].items() if v)): n['id'] for n in D['nobles']}
nob, nbad = {}, []
for cell, s in N.items():
    k = tuple(sorted(cost(s.split()).items()))
    (nob.__setitem__(nidx[k], cell) if k in nidx else nbad.append((cell, s)))
print('quý tộc khớp:', nob, 'không khớp:', nbad)
if '--json' in sys.argv: print(json.dumps({'cards': cards, 'nobles': nob, 'T': T, 'N': N}))
