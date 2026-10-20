'use strict';
// Máy chơi Splendor: chấm điểm từng nước đi theo "phong cách" (giống bản Steam: AI khác nhau theo hành vi, không theo độ khó).
const E = require('./engine');
const { CARDS, NOBLES, COLORS, MAX_TOKENS, MAX_RESERVED, WIN_POINTS } = E;

const STYLES = {
  balanced: { name: 'Thương gia', pts: 1, noble: 0.7, jitter: 0.25 },
  noble: { name: 'Quý tộc', pts: 0.8, noble: 1.8, jitter: 0.25 },
  rush: { name: 'Tham lam', pts: 1.6, noble: 0.3, jitter: 0.25 },
};
const styleOf = (k) => STYLES[k] || STYLES.balanced;

const sum = (t) => Object.values(t).reduce((a, b) => a + b, 0);
const vis = (g) => [1, 2, 3].flatMap((l) => g.board[l].map((id, index) => (id == null ? null : { id, level: l, index }))).filter(Boolean);

function missing(p, b, card) { // số đá còn thiếu để mua (đã tính vàng)
  let need = 0;
  for (const c of COLORS) need += Math.max(0, (card.cost[c] || 0) - b[c] - p.tokens[c]);
  return Math.max(0, need - p.tokens.gold);
}
function cardValue(g, p, b, card, st) {
  let v = card.points * 3 * st.pts + 1;
  // bonus có ích cho các thẻ đang hiện trên bàn
  let want = 0; for (const x of vis(g)) want += (CARDS[x.id].cost[card.bonus] || 0);
  v += Math.min(2.5, want / 6);
  // tiến gần quý tộc
  for (const nid of g.nobles) {
    const req = NOBLES[nid].req[card.bonus];
    if (req && b[card.bonus] < req) v += st.noble * (1.2 / (1 + req - b[card.bonus]));
  }
  if (E.points(p) + card.points >= WIN_POINTS) v += 40;
  return v;
}

function targets(g, p, st) {
  const b = E.bonuses(p), list = [];
  for (const x of vis(g)) list.push({ card: CARDS[x.id], ...x });
  for (const r of p.reserved) list.push({ card: CARDS[r.id], id: r.id, reserved: true });
  for (const t of list) { t.miss = missing(p, b, t.card); t.value = cardValue(g, p, b, t.card, st); t.w = t.value / (t.miss + 1.5); }
  list.sort((a, c) => c.w - a.w);
  const need = Object.fromEntries(COLORS.map((c) => [c, 0]));
  list.slice(0, 3).forEach((t, i) => { for (const c of COLORS) need[c] += (t.w / (i + 1)) * Math.max(0, (t.card.cost[c] || 0) - b[c] - p.tokens[c]); });
  return { list, need, b };
}

function discardAction(g, p, st) {
  const { need } = targets(g, p, st);
  const t = { ...p.tokens }, d = {};
  let k = sum(t) - MAX_TOKENS;
  while (k-- > 0) {
    let best = null, bv = Infinity;
    for (const c of [...COLORS, 'gold']) if (t[c] > 0) { const v = (c === 'gold' ? 4 : need[c]) - 0.05 * t[c]; if (v < bv) { bv = v; best = c; } }
    t[best]--; d[best] = (d[best] || 0) + 1;
  }
  return { type: 'discard', tokens: d };
}

function candidates(g, p, st) {
  const { list, need, b } = targets(g, p, st), out = [];
  const total = sum(p.tokens);
  // mua
  for (const t of list) {
    const pay = E.payment(p, t.card); if (!pay) continue;
    const s = t.value * 2 + 3 - pay.gold * 0.8 - (t.card.points ? 0 : 0.5);
    out.push({ s, a: t.reserved ? { type: 'buy', from: 'reserved', id: t.id } : { type: 'buy', from: 'board', level: t.level, index: t.index } });
  }
  // lấy 3 viên khác màu (hoặc ít hơn nếu hết màu)
  const av = E.availableColors(g), n = Math.min(3, av.length);
  const combos = [];
  const pick = (start, cur) => { if (cur.length === n) { combos.push(cur.slice()); return; } for (let i = start; i < av.length; i++) { cur.push(av[i]); pick(i + 1, cur); cur.pop(); } };
  if (n > 0) pick(0, []);
  for (const cs of combos) {
    const over = Math.max(0, total + cs.length - MAX_TOKENS);
    out.push({ s: cs.reduce((x, c) => x + need[c], 0) + 0.3 - over * 1.4, a: { type: 'take', colors: cs } });
  }
  for (const c of COLORS) if (g.bank[c] >= 4) {
    const over = Math.max(0, total + 2 - MAX_TOKENS);
    out.push({ s: need[c] * 1.5 - over * 1.4 + 0.1, a: { type: 'take', colors: [c, c] } });
  }
  // giữ thẻ
  if (p.reserved.length < MAX_RESERVED) {
    const over = g.bank.gold > 0 ? Math.max(0, total + 1 - MAX_TOKENS) : 0;
    for (const t of list.filter((x) => !x.reserved)) {
      out.push({ s: (g.bank.gold > 0 ? 1.0 : 0) + (t.value * 0.35) / (t.miss + 1) - over * 1.2 - 0.6, a: { type: 'reserve', level: t.level, index: t.index } });
    }
  }
  return out;
}

function choose(g, playerId, styleKey) {
  const st = styleOf(styleKey), p = g.players.find((x) => x.id === playerId);
  if (g.phase === 'discard') return discardAction(g, p, st);
  if (g.phase === 'noble') { const el = E.eligibleNobles(g, p); return { type: 'noble', id: el[0] }; }
  const cs = candidates(g, p, st);
  for (const c of cs) c.s += (Math.random() - 0.5) * st.jitter * 2;
  cs.sort((x, y) => y.s - x.s);
  return (cs[0] && cs[0].a) || { type: 'pass' };
}

// Thử lần lượt các nước đi tốt nhất cho tới khi có nước hợp lệ (luật nằm ở engine).
function play(g, playerId, styleKey) {
  const st = styleOf(styleKey), p = g.players.find((x) => x.id === playerId);
  let list;
  if (g.phase === 'main') { list = candidates(g, p, st); for (const c of list) c.s += (Math.random() - 0.5) * st.jitter * 2; list.sort((x, y) => y.s - x.s); list = list.map((c) => c.a); list.push({ type: 'pass' }); }
  else list = [choose(g, playerId, styleKey)];
  let err;
  for (const a of list) { try { E.apply(g, playerId, a); return a; } catch (e) { err = e; } }
  throw err || new Error('Máy không có nước đi');
}

module.exports = { choose, play, STYLES };
