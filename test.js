const E = require('./engine');
const C = E.COLORS;
let over = 0, stuck = 0, maxTurns = 0;
for (let n = 0; n < 400; n++) {
  const np = 2 + (n % 3);
  const g = E.newGame(Array.from({ length: np }, (_, i) => ({ id: 'p' + i, name: 'P' + i })));
  let t = 0;
  while (g.phase !== 'over' && t++ < 3000) {
    const p = g.players[g.turn];
    const tryA = [];
    if (g.phase === 'discard') {
      const need = Object.values(p.tokens).reduce((a, b) => a + b, 0) - 10, d = {};
      let left = need; for (const c of [...C, 'gold']) { const k = Math.min(left, p.tokens[c]); if (k) { d[c] = k; left -= k; } }
      tryA.push({ type: 'discard', tokens: d });
    } else if (g.phase === 'noble') {
      const v = E.viewFor(g, p.id); tryA.push({ type: 'noble', id: v.eligible[0] });
    } else {
      for (const l of [3, 2, 1]) g.board[l].forEach((id, i) => id != null && E.payment(p, E.CARDS[id]) && tryA.push({ type: 'buy', from: 'board', level: l, index: i }));
      p.reserved.forEach((r) => E.payment(p, E.CARDS[r.id]) && tryA.push({ type: 'buy', from: 'reserved', id: r.id }));
      const av = C.filter((c) => g.bank[c] > 0).sort(() => Math.random() - .5);
      tryA.push({ type: 'take', colors: av.slice(0, 3) });
      const big = C.find((c) => g.bank[c] >= 4); if (big) tryA.push({ type: 'take', colors: [big, big] });
      tryA.push({ type: 'reserve', level: 1 + Math.floor(Math.random() * 3), index: Math.random() < .5 ? -1 : 0 });
      tryA.push({ type: 'pass' });
    }
    // ưu tiên mua, rồi ngẫu nhiên
    let done = false;
    const first = tryA.filter((a) => a.type === 'buy');
    const order = [...first, ...tryA.filter((a) => a.type !== 'buy').sort(() => Math.random() - .5)];
    for (const a of order) { try { E.apply(g, p.id, a); done = true; break; } catch (e) {} }
    if (!done) { stuck++; break; }
    // bất biến
    for (const c of [...C, 'gold']) {
      const tot = g.bank[c] + g.players.reduce((s, q) => s + q.tokens[c], 0);
      const exp = c === 'gold' ? 5 : (np === 2 ? 4 : np === 3 ? 5 : 7);
      if (tot !== exp) throw new Error('token leak ' + c + ' ' + tot);
    }
  }
  maxTurns = Math.max(maxTurns, t);
  if (g.phase === 'over') over++;
  if (g.phase === 'over' && g.turn !== 0) throw new Error('kết thúc sai vòng');
}
console.log({ over, stuck, maxTurns });
// kiểm tra view ẩn thẻ úp
const g = E.newGame([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]);
const f = g.players[g.turn]; E.apply(g, f.id, { type: 'reserve', level: 2, index: -1 });
const other = g.players.find((p) => p.id !== f.id).id;
console.log(JSON.stringify(E.viewFor(g, other).players.find((p) => p.id === f.id).reserved), JSON.stringify(E.viewFor(g, f.id).players.find((p) => p.id === f.id).reserved), f.tokens.gold);
