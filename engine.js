'use strict';
// Luật Splendor (bản gốc Space Cowboys). Server giữ trạng thái chuẩn, client chỉ nhận "view".
const DATA = require('./public/data.js');
const COLORS = ['white', 'blue', 'green', 'red', 'black'];
const ALL = [...COLORS, 'gold'];
const CARDS = DATA.cards;
const NOBLES = DATA.nobles;
const WIN_POINTS = 15;
const MAX_TOKENS = 10;
const MAX_RESERVED = 3;

function shuffle(a, rnd = Math.random) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const zero = () => ({ white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 });
const sum = (t) => ALL.reduce((s, c) => s + (t[c] || 0), 0);

function newGame(players, rnd = Math.random) {
  const n = players.length;
  if (n < 2 || n > 4) throw new Error('Cần 2-4 người chơi');
  const per = n === 2 ? 4 : n === 3 ? 5 : 7;
  const bank = zero();
  COLORS.forEach((c) => (bank[c] = per));
  bank.gold = 5;
  const decks = {}, board = {};
  [1, 2, 3].forEach((l) => {
    decks[l] = shuffle(CARDS.filter((c) => c.level === l).map((c) => c.id), rnd);
    board[l] = [];
    for (let i = 0; i < 4; i++) board[l].push(decks[l].pop());
  });
  const order = shuffle(players, rnd); // người đi đầu ngẫu nhiên
  const g = {
    players: order.map((p) => ({
      id: p.id, name: p.name, tokens: zero(), cards: [], reserved: [], nobles: [],
    })),
    bank, decks, board,
    nobles: shuffle(NOBLES.map((x) => x.id), rnd).slice(0, n + 1),
    turn: 0, phase: 'main', // main | discard | noble | over
    finalRound: false, winners: null, log: [], round: 1,
  };
  addLog(g, `Ván bắt đầu. ${g.players[0].name} đi trước.`);
  return g;
}

function addLog(g, text) {
  g.log.push({ r: g.round, t: text });
  if (g.log.length > 120) g.log.shift();
}

function bonuses(p) {
  const b = { white: 0, blue: 0, green: 0, red: 0, black: 0 };
  p.cards.forEach((id) => b[CARDS[id].bonus]++);
  return b;
}
function points(p) {
  return p.cards.reduce((s, id) => s + CARDS[id].points, 0) +
    p.nobles.reduce((s, id) => s + NOBLES[id].points, 0);
}

// Chi phí thực tế sau khi trừ bonus; trả về null nếu không đủ tiền.
function payment(p, card) {
  const b = bonuses(p);
  const pay = zero();
  let goldNeeded = 0;
  COLORS.forEach((c) => {
    const need = Math.max(0, (card.cost[c] || 0) - b[c]);
    const use = Math.min(need, p.tokens[c]);
    pay[c] = use;
    goldNeeded += need - use;
  });
  if (goldNeeded > p.tokens.gold) return null;
  pay.gold = goldNeeded;
  return pay;
}

function takeFromBoard(g, level, index) {
  const id = g.board[level][index];
  if (id == null) throw new Error('Ô thẻ trống');
  g.board[level][index] = g.decks[level].length ? g.decks[level].pop() : null;
  return id;
}

function availableColors(g) {
  return COLORS.filter((c) => g.bank[c] > 0);
}

function canAct(g, p) {
  if (availableColors(g).length) return true;
  if (p.reserved.length < MAX_RESERVED) {
    for (const l of [1, 2, 3]) if (g.decks[l].length || g.board[l].some((x) => x != null)) return true;
  }
  const buyable = [...[1, 2, 3].flatMap((l) => g.board[l].filter((x) => x != null)), ...p.reserved.map((r) => r.id)];
  return buyable.some((id) => payment(p, CARDS[id]));
}

function apply(g, playerId, a) {
  if (g.phase === 'over') throw new Error('Ván đã kết thúc');
  const p = g.players[g.turn];
  if (p.id !== playerId) throw new Error('Chưa đến lượt bạn');
  switch (g.phase) {
    case 'main': return doMain(g, p, a);
    case 'discard': return doDiscard(g, p, a);
    case 'noble': return doNoble(g, p, a);
  }
}

function doMain(g, p, a) {
  switch (a.type) {
    case 'take': {
      const cs = a.colors;
      if (!Array.isArray(cs) || !cs.length || cs.some((c) => !COLORS.includes(c))) throw new Error('Lựa chọn không hợp lệ');
      if (cs.length === 2 && cs[0] === cs[1]) {
        if (g.bank[cs[0]] < 4) throw new Error('Lấy 2 viên cùng màu chỉ khi còn ít nhất 4 viên');
      } else {
        if (new Set(cs).size !== cs.length) throw new Error('Lựa chọn không hợp lệ');
        if (cs.length > 3) throw new Error('Tối đa 3 viên khác màu');
        if (cs.length !== Math.min(3, availableColors(g).length)) throw new Error('Phải lấy đủ 3 viên khác màu (hoặc tối đa có thể)');
        if (cs.some((c) => g.bank[c] < 1)) throw new Error('Hết viên màu này');
      }
      cs.forEach((c) => { g.bank[c]--; p.tokens[c]++; });
      addLog(g, `${p.name} lấy ${cs.map(viName).join(', ')}.`);
      break;
    }
    case 'reserve': {
      if (p.reserved.length >= MAX_RESERVED) throw new Error('Chỉ giữ tối đa 3 thẻ');
      const { level, index } = a;
      if (![1, 2, 3].includes(level)) throw new Error('Cấp không hợp lệ');
      let id, fromDeck = false;
      if (index === -1) {
        if (!g.decks[level].length) throw new Error('Hết bài trong chồng');
        id = g.decks[level].pop(); fromDeck = true;
      } else id = takeFromBoard(g, level, index);
      p.reserved.push({ id, fromDeck });
      if (g.bank.gold > 0) { g.bank.gold--; p.tokens.gold++; }
      addLog(g, `${p.name} giữ ${fromDeck ? `1 thẻ úp cấp ${level}` : `thẻ cấp ${level}`}.`);
      break;
    }
    case 'buy': {
      let id, take;
      if (a.from === 'reserved') {
        const i = p.reserved.findIndex((r) => r.id === a.id);
        if (i < 0) throw new Error('Không có thẻ này');
        id = a.id; take = () => p.reserved.splice(i, 1);
      } else {
        id = g.board[a.level] && g.board[a.level][a.index];
        if (id == null) throw new Error('Ô thẻ trống');
        take = () => takeFromBoard(g, a.level, a.index);
      }
      const pay = payment(p, CARDS[id]);
      if (!pay) throw new Error('Không đủ đá quý');
      take();
      ALL.forEach((c) => { p.tokens[c] -= pay[c]; g.bank[c] += pay[c]; });
      p.cards.push(id);
      addLog(g, `${p.name} mua thẻ cấp ${CARDS[id].level} (${viName(CARDS[id].bonus)}${CARDS[id].points ? ', ' + CARDS[id].points + ' điểm' : ''}).`);
      break;
    }
    case 'pass': {
      if (canAct(g, p)) throw new Error('Bạn vẫn còn nước đi, không được bỏ lượt');
      addLog(g, `${p.name} bỏ lượt (không còn nước đi).`);
      break;
    }
    default: throw new Error('Hành động không hợp lệ');
  }
  afterAction(g, p);
}

function afterAction(g, p) {
  if (sum(p.tokens) > MAX_TOKENS) { g.phase = 'discard'; return; }
  checkNobles(g, p);
}

function doDiscard(g, p, a) {
  if (a.type !== 'discard') throw new Error('Bạn phải bỏ bớt đá quý');
  const need = sum(p.tokens) - MAX_TOKENS;
  const d = a.tokens || {};
  let tot = 0;
  ALL.forEach((c) => {
    const n = d[c] || 0;
    if (!Number.isInteger(n) || n < 0 || n > p.tokens[c]) throw new Error('Số lượng không hợp lệ');
    tot += n;
  });
  if (tot !== need) throw new Error(`Phải bỏ đúng ${need} viên`);
  ALL.forEach((c) => { const n = d[c] || 0; p.tokens[c] -= n; g.bank[c] += n; });
  addLog(g, `${p.name} bỏ bớt ${tot} viên (tối đa 10).`);
  g.phase = 'main';
  checkNobles(g, p);
}

function eligibleNobles(g, p) {
  const b = bonuses(p);
  return g.nobles.filter((id) => Object.entries(NOBLES[id].req).every(([c, n]) => b[c] >= n));
}
function checkNobles(g, p) {
  const el = eligibleNobles(g, p);
  if (el.length === 0) return endTurn(g, p);
  if (el.length === 1) return grantNoble(g, p, el[0]);
  g.phase = 'noble';
}
function doNoble(g, p, a) {
  if (a.type !== 'noble' || !eligibleNobles(g, p).includes(a.id)) throw new Error('Chọn một quý tộc hợp lệ');
  grantNoble(g, p, a.id);
}
function grantNoble(g, p, id) {
  g.nobles = g.nobles.filter((x) => x !== id);
  p.nobles.push(id);
  addLog(g, `Quý tộc đến thăm ${p.name}! (+${NOBLES[id].points} điểm)`);
  g.phase = 'main';
  endTurn(g, p);
}

function endTurn(g, p) {
  if (!g.finalRound && points(p) >= WIN_POINTS) {
    g.finalRound = true;
    addLog(g, `${p.name} đạt ${points(p)} điểm! Hết vòng này là kết thúc ván.`);
  }
  g.turn = (g.turn + 1) % g.players.length;
  g.phase = 'main';
  if (g.turn === 0) {
    g.round++;
    if (g.finalRound) return finish(g);
  }
}

function finish(g) {
  g.phase = 'over';
  const score = (p) => [points(p), -p.cards.length]; // hòa điểm: ít thẻ hơn thắng
  let best = null, winners = [];
  g.players.forEach((p) => {
    const s = score(p);
    if (!best || s[0] > best[0] || (s[0] === best[0] && s[1] > best[1])) { best = s; winners = [p.id]; }
    else if (s[0] === best[0] && s[1] === best[1]) winners.push(p.id);
  });
  g.winners = winners;
  addLog(g, `Kết thúc! Thắng: ${g.players.filter((p) => winners.includes(p.id)).map((p) => p.name).join(', ')}.`);
}

const VI = { white: 'Kim cương', blue: 'Lam ngọc', green: 'Lục bảo', red: 'Hồng ngọc', black: 'Mã não', gold: 'Vàng' };
function viName(c) { return VI[c] || c; }

// Góc nhìn của 1 người chơi: ẩn thẻ úp của người khác, ẩn thứ tự chồng bài.
function viewFor(g, playerId) {
  return {
    players: g.players.map((p) => ({
      id: p.id, name: p.name, tokens: p.tokens, cards: p.cards, nobles: p.nobles,
      points: points(p), bonuses: bonuses(p),
      reserved: p.reserved.map((r) =>
        (p.id === playerId || !r.fromDeck) ? { id: r.id, fromDeck: r.fromDeck } : { hidden: true, level: CARDS[r.id].level }),
    })),
    bank: g.bank,
    deckCounts: { 1: g.decks[1].length, 2: g.decks[2].length, 3: g.decks[3].length },
    board: g.board, nobles: g.nobles,
    turn: g.turn, phase: g.phase, finalRound: g.finalRound, winners: g.winners,
    log: g.log.slice(-120), round: g.round,
    eligible: g.phase === 'noble' && g.players[g.turn].id === playerId ? eligibleNobles(g, g.players[g.turn]) : [],
    canPass: g.phase === 'main' && g.players[g.turn].id === playerId && !canAct(g, g.players[g.turn]),
  };
}

module.exports = { newGame, apply, viewFor, payment, points, bonuses, canAct, eligibleNobles, addLog, availableColors, sum, CARDS, NOBLES, COLORS, MAX_TOKENS, MAX_RESERVED, WIN_POINTS };
