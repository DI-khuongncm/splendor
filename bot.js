'use strict';
// Máy chơi Splendor: chấm điểm từng nước đi theo "phong cách" (giống bản Steam: AI khác nhau theo hành vi, không theo độ khó).
// Các hệ số nằm trong W để có thể tự tối ưu bằng cách cho máy đấu với nhau (tools/tune-bot.js).
const E = require('./engine');
const { CARDS, NOBLES, COLORS, MAX_TOKENS, MAX_RESERVED, WIN_POINTS } = E;

// Hệ số đã tối ưu bằng tự đấu (2 đợt (1+1)-ES, khoảng nửa triệu ván máy-máy).
const W = {
  ptsMul: 2.099, base: 1.478, wantCap: 3.621, wantDiv: 6, nobleStep: 1.2, winBonus: 40, // giá trị 1 thẻ
  buyMul: 1.426, buyBase: 3, goldPen: 0.8, zeroPen: 0.5, // mua
  takeBase: 0.3, overPen: 1.4, take2Mul: 1.5, take2Base: 0.1, // lấy đá
  resGold: 1.468, resMul: 0.35, resBase: -0.6, resOverPen: 1.202, // giữ thẻ
  block: 0.6, blockNear: 0.4, blockWin: 8, blockBuy: 0.5, blockMulti: 0.6, // chặn đối thủ
};

const STYLES = {
  balanced: { name: 'Thương gia', pts: 1, noble: 0.7, jitter: 0.25 },
  noble: { name: 'Quý tộc', pts: 0.8, noble: 1.8, jitter: 0.25 },
  rush: { name: 'Tham lam', pts: 1.6, noble: 0.3, jitter: 0.25 },
  master: { name: 'Cao thủ', pts: 1, noble: 0.7, jitter: 0.25, mcts: true }, // nghĩ bằng mcts.js (worker), đây chỉ là dự phòng
};
const styleOf = (k) => STYLES[k] || STYLES.balanced;

const sum = (t) => Object.values(t).reduce((a, b) => a + b, 0);
function vis(g) { const out = []; for (let l = 1; l <= 3; l++) { const row = g.board[l]; for (let i = 0; i < row.length; i++) if (row[i] != null) out.push({ id: row[i], level: l, index: i }); } return out; }

// Mảng số tính sẵn (nhanh hơn tra theo tên màu trong vòng lặp giả lập). Thứ tự màu như COLORS.
const CI = Object.fromEntries(COLORS.map((c, i) => [c, i]));
const CC = CARDS.map((c) => COLORS.map((k) => c.cost[k] || 0));
const CB = CARDS.map((c) => CI[c.bonus]);
const NR = NOBLES.map((n) => COLORS.map((k) => n.req[k] || 0));

// Trạng thái 1 người, tính 1 lần mỗi lượt: bonus, đá, điểm, và quý tộc sẽ đến nếu có thêm 1 bonus màu i.
function seat(g, p) {
  const b = [0, 0, 0, 0, 0], tk = COLORS.map((c) => p.tokens[c]), trig = [0, 0, 0, 0, 0];
  let pts = 0;
  for (const id of p.cards) { b[CB[id]]++; pts += CARDS[id].points; }
  for (const id of p.nobles) pts += NOBLES[id].points;
  for (let i = 0; i < 5; i++) for (const nid of g.nobles) {
    const r = NR[nid]; let ok = true, was = true;
    for (let j = 0; j < 5; j++) { if (b[j] + (j === i ? 1 : 0) < r[j]) ok = false; if (b[j] < r[j]) was = false; }
    if (ok && !was) { trig[i] = NOBLES[nid].points; break; }
  }
  return { p, b, tk, gold: p.tokens.gold, pts, trig };
}
function missing(S, id) { // số đá còn thiếu để mua (đã tính vàng)
  const c = CC[id]; let n = 0;
  for (let j = 0; j < 5; j++) { const d = c[j] - S.b[j] - S.tk[j]; if (d > 0) n += d; }
  return n > S.gold ? n - S.gold : 0;
}
function goldNeed(S, id) { // số vàng phải dùng để mua, -1 nếu không đủ
  const c = CC[id]; let n = 0;
  for (let j = 0; j < 5; j++) { const d = c[j] - S.b[j] - S.tk[j]; if (d > 0) n += d; }
  return n > S.gold ? -1 : n;
}
// Điểm nhận ngay khi mua thẻ: điểm thẻ + quý tộc vừa đủ điều kiện.
const gainFor = (S, id) => CARDS[id].points + S.trig[CB[id]];
// Tổng nhu cầu từng màu của các thẻ đang hiện trên bàn.
function wantOf(cards) {
  const w = [0, 0, 0, 0, 0];
  for (const x of cards) { const c = CC[x.id]; for (let j = 0; j < 5; j++) w[j] += c[j]; }
  return w;
}
function cardValue(g, S, id, st, want, w) {
  const bi = CB[id];
  let v = CARDS[id].points * w.ptsMul * st.pts + w.base;
  // bonus có ích cho các thẻ đang hiện trên bàn
  v += Math.min(w.wantCap, want[bi] / w.wantDiv);
  // tiến gần quý tộc
  for (const nid of g.nobles) {
    const req = NR[nid][bi];
    if (req && S.b[bi] < req) v += st.noble * (w.nobleStep / (1 + req - S.b[bi]));
  }
  if (S.pts + gainFor(S, id) >= WIN_POINTS) v += w.winBonus;
  return v;
}
// Mức nguy hiểm nếu để đối thủ lấy thẻ này: đối thủ mua được ngay (hoặc chỉ thiếu 1 viên) thì được bao nhiêu điểm, có thắng luôn không.
function threatOf(id, opp, w) {
  let t = 0;
  for (const o of opp) {
    const m = missing(o, id); if (m > 1) continue;
    const gain = gainFor(o, id); if (!gain) continue;
    let v = gain + (o.pts + gain >= WIN_POINTS ? w.blockWin : 0);
    if (m === 1) v *= w.blockNear;
    if (v > t) t = v;
  }
  return opp.length > 1 ? t * w.blockMulti : t;
}

function targets(g, p, st, w) {
  const S = seat(g, p), list = [], v = vis(g), want = wantOf(v);
  for (const x of v) list.push({ card: CARDS[x.id], id: x.id, level: x.level, index: x.index });
  for (const r of p.reserved) list.push({ card: CARDS[r.id], id: r.id, reserved: true });
  for (const t of list) { t.miss = missing(S, t.id); t.value = cardValue(g, S, t.id, st, want, w); t.w = t.value / (t.miss + 1.5); }
  list.sort((a, c) => c.w - a.w);
  const nd = [0, 0, 0, 0, 0];
  for (let i = 0; i < 3 && i < list.length; i++) { const t = list[i], c = CC[t.id]; for (let j = 0; j < 5; j++) nd[j] += (t.w / (i + 1)) * Math.max(0, c[j] - S.b[j] - S.tk[j]); }
  const need = { white: nd[0], blue: nd[1], green: nd[2], red: nd[3], black: nd[4] };
  return { list, need, S };
}

function discardAction(g, p, st, w = W) {
  const { need } = targets(g, p, st, w);
  const t = { ...p.tokens }, d = {};
  let k = sum(t) - MAX_TOKENS;
  while (k-- > 0) {
    let best = null, bv = Infinity;
    for (const c of [...COLORS, 'gold']) if (t[c] > 0) { const v = (c === 'gold' ? 4 : need[c]) - 0.05 * t[c]; if (v < bv) { bv = v; best = c; } }
    t[best]--; d[best] = (d[best] || 0) + 1;
  }
  return { type: 'discard', tokens: d };
}

function candidates(g, p, st, w = W) {
  const { list, need, S } = targets(g, p, st, w), out = [];
  const total = sum(p.tokens);
  const opp = w.block ? g.players.filter((o) => o !== p).map((o) => seat(g, o)) : [];
  for (const t of list) t.threat = !t.reserved && opp.length ? threatOf(t.id, opp, w) : 0;
  // mua
  for (const t of list) {
    const gold = goldNeed(S, t.id); if (gold < 0) continue;
    const s = t.value * w.buyMul + w.buyBase - gold * w.goldPen - (t.card.points ? 0 : w.zeroPen) + t.threat * w.block * w.blockBuy;
    out.push({ s, a: t.reserved ? { type: 'buy', from: 'reserved', id: t.id } : { type: 'buy', from: 'board', level: t.level, index: t.index } });
  }
  // lấy 3 viên khác màu (hoặc ít hơn nếu hết màu)
  const av = E.availableColors(g), n = Math.min(3, av.length);
  const combos = [];
  const pick = (start, cur) => { if (cur.length === n) { combos.push(cur.slice()); return; } for (let i = start; i < av.length; i++) { cur.push(av[i]); pick(i + 1, cur); cur.pop(); } };
  if (n > 0) pick(0, []);
  for (const cs of combos) {
    const over = Math.max(0, total + cs.length - MAX_TOKENS);
    out.push({ s: cs.reduce((x, c) => x + need[c], 0) + w.takeBase - over * w.overPen, a: { type: 'take', colors: cs } });
  }
  for (const c of COLORS) if (g.bank[c] >= 4) {
    const over = Math.max(0, total + 2 - MAX_TOKENS);
    out.push({ s: need[c] * w.take2Mul - over * w.overPen + w.take2Base, a: { type: 'take', colors: [c, c] } });
  }
  // giữ thẻ (để dành cho mình, hoặc để chặn thẻ đối thủ sắp mua)
  if (p.reserved.length < MAX_RESERVED) {
    const over = g.bank.gold > 0 ? Math.max(0, total + 1 - MAX_TOKENS) : 0;
    for (const t of list) if (!t.reserved) {
      out.push({ s: (g.bank.gold > 0 ? w.resGold : 0) + (t.value * w.resMul) / (t.miss + 1) - over * w.resOverPen + w.resBase + t.threat * w.block, a: { type: 'reserve', level: t.level, index: t.index } });
    }
  }
  return out;
}

function choose(g, playerId, styleKey, w = W) {
  const st = styleOf(styleKey), p = g.players.find((x) => x.id === playerId);
  if (g.phase === 'discard') return discardAction(g, p, st, w);
  if (g.phase === 'noble') { const el = E.eligibleNobles(g, p); return { type: 'noble', id: el[0] }; }
  const cs = candidates(g, p, st, w);
  for (const c of cs) c.s += (Math.random() - 0.5) * st.jitter * 2;
  cs.sort((x, y) => y.s - x.s);
  return (cs[0] && cs[0].a) || { type: 'pass' };
}

// Thử lần lượt các nước đi tốt nhất cho tới khi có nước hợp lệ (luật nằm ở engine).
function play(g, playerId, styleKey, w = W) {
  const st = styleOf(styleKey), p = g.players.find((x) => x.id === playerId);
  let list;
  if (g.phase === 'main') {
    const cs = candidates(g, p, st, w);
    let bi = -1; for (let i = 0; i < cs.length; i++) { cs[i].s += (Math.random() - 0.5) * st.jitter * 2; if (bi < 0 || cs[i].s > cs[bi].s) bi = i; }
    if (bi >= 0) { try { E.apply(g, playerId, cs[bi].a); return cs[bi].a; } catch (e) {} } // thường nước tốt nhất đã hợp lệ: khỏi sắp xếp cả danh sách
    cs.sort((x, y) => y.s - x.s); list = cs.map((c) => c.a); list.push({ type: 'pass' });
  } else list = [choose(g, playerId, styleKey, w)];
  let err;
  for (const a of list) { try { E.apply(g, playerId, a); return a; } catch (e) { err = e; } }
  throw err || new Error('Máy không có nước đi');
}

module.exports = { choose, play, candidates, STYLES, W };
