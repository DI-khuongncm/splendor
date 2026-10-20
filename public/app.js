'use strict';
const D = SPLENDOR_DATA, CARDS = D.cards, NOBLES = D.nobles;
const COLORS = ['white', 'blue', 'green', 'red', 'black'];
const VI = { white: 'Kim cương', blue: 'Lam ngọc', green: 'Lục bảo', red: 'Hồng ngọc', black: 'Mã não', gold: 'Vàng' };
const $app = document.getElementById('app');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let sess = null;
try { sess = JSON.parse(localStorage.getItem('splendor') || 'null'); } catch (e) {}
let S = null;      // { lobby, game }
let sel = [];      // đá đang chọn để lấy
let modal = null;  // { kind:'card', from, level, index, id } | { kind:'deck', level } | { kind:'over' }
let disc = {};     // đá định bỏ
let toastMsg = '', toastTimer = 0, lobbyErr = '';
let lastTurnKey = '', fails = 0;
let offline = false, lastSig = '', skew = 0, seenChat = null, seenNudge = null, notifyOn = false;
const vib = (p) => { try { if (navigator.vibrate && navigator.userActivation && navigator.userActivation.hasBeenActive) navigator.vibrate(p); } catch (e) {} };
const PCOL = ['#e8b923', '#4f8be9', '#e24a44', '#3dbd71'];
const TABLES = [
  { id: 'felt', name: 'Nỉ xanh', c1: '#22573f', c2: '#123526' }, { id: 'velvet', name: 'Nhung đỏ', c1: '#8a2436', c2: '#4a0f1b' },
  { id: 'oak', name: 'Gỗ sồi', c1: '#946037', c2: '#5e3b1f' }, { id: 'navy', name: 'Xanh hải quân', c1: '#2a4f8a', c2: '#12274a' },
  { id: 'marble', name: 'Cẩm thạch', c1: '#7a8190', c2: '#3f4450' },
];
const DECKS = [
  { id: 'classic', name: 'Cổ điển', k: [['#2f8a55', '#103d24'], ['#c9952a', '#5e3c08'], ['#2f63c4', '#0f2350']] },
  { id: 'royal', name: 'Hoàng gia', k: [['#7b4bb5', '#2b1650'], ['#d2a13a', '#6a4408'], ['#b3274a', '#4a0d1f']] },
  { id: 'noir', name: 'Dạ vàng', k: [['#3d3d48', '#0d0d12'], ['#5a4a26', '#14100a'], ['#2e3a5c', '#0b0e18']] },
  { id: 'ocean', name: 'Đại dương', k: [['#2bb3a5', '#0a3d38'], ['#3a8fd6', '#0f2f5e'], ['#6a6fe0', '#1d1f5e']] },
];
let prefs = { table: 'felt', deck: 'classic', art: 'photo' };
try { Object.assign(prefs, JSON.parse(localStorage.getItem('splendor_prefs') || '{}')); } catch (e) {}
function applyPrefs() { document.body.dataset.table = prefs.table; document.body.dataset.deck = prefs.deck; }
applyPrefs();
try { notifyOn = localStorage.getItem('splendor_notify') === '1' && 'Notification' in window && Notification.permission === 'granted'; } catch (e) {}
const EMO = ['😀', '😂', '😮', '😡', '👏', '🔥'], PHRASES = ['Nhanh lên!', 'GG', 'Khá lắm!', 'Hừm…'];
const isBotId = (id) => { const m = S && S.lobby.members.find((x) => x.id === id); return !!(m && m.bot); };

// ---------- hình gem (giác cắt nhiều mặt) ----------
const P = (pts) => pts.map((p) => p.map((v) => +v.toFixed(2)).join(',')).join(' ');
function cutGem(n, R, r, rot, hue, sat, L, edge) {
  // giác cắt kiểu brilliant nhìn từ trên: n mặt quanh mặt bàn ở giữa, sáng theo hướng trên-trái
  const pt = (rad, a) => [12 + rad * Math.cos(a), 12 + rad * Math.sin(a)];
  const step = (2 * Math.PI) / n, o = (rot * Math.PI) / 180;
  let s = '', table = [];
  for (let k = 0; k < n; k++) {
    const a0 = o + k * step, a1 = a0 + step, mid = (a0 + a1) / 2;
    const lum = L + 20 * Math.cos(mid + (3 * Math.PI) / 4);
    s += `<polygon points="${P([pt(r, a0), pt(R, a0), pt(R, a1), pt(r, a1)])}" fill="hsl(${hue},${sat}%,${lum.toFixed(1)}%)"/>`;
    table.push(pt(r, a0));
  }
  s += `<polygon points="${P(table)}" fill="hsl(${hue},${sat}%,${L + 12}%)"/>`;
  const out = []; for (let k = 0; k < n; k++) out.push(pt(R, o + k * step));
  return s + `<polygon points="${P(out)}" fill="none" stroke="${edge}" stroke-width="1" stroke-linejoin="round"/>`;
}
const GEM = {
  white: `<polygon points="1,9 7,9 12,22" fill="#c4d2df"/><polygon points="17,9 23,9 12,22" fill="#9fb3c6"/><polygon points="7,9 17,9 12,22" fill="#e1ebf3"/>
    <polygon points="6,3 18,3 23,9 1,9" fill="#f7fbfe"/><polygon points="9,3 15,3 17,9 7,9" fill="#d7e4ee"/><polygon points="1,9 6,3 9,3 7,9" fill="#ffffff"/>
    <polygon points="6,3 18,3 23,9 12,22 1,9" fill="none" stroke="#4d5f72" stroke-width="1" stroke-linejoin="round"/>`,
  blue: `<polygon points="12,1.5 18,4.5 20.5,12 18,19.5 12,22.5 6,19.5 3.5,12 6,4.5" fill="#2c66c9"/>
    <polygon points="12,1.5 6,4.5 3.5,12 8,9 12,6" fill="#8dbaff"/><polygon points="12,1.5 18,4.5 16,9 12,6" fill="#4f8be9"/>
    <polygon points="20.5,12 18,19.5 16,15 16,9 18,4.5" fill="#1e4fa6"/><polygon points="18,19.5 12,22.5 6,19.5 8,15 12,18 16,15" fill="#163f88"/>
    <polygon points="12,6 16,9 16,15 12,18 8,15 8,9" fill="#5c97f0"/><polygon points="9,8.5 11,7.4 10,11" fill="#fff" opacity=".6"/>
    <polygon points="12,1.5 18,4.5 20.5,12 18,19.5 12,22.5 6,19.5 3.5,12 6,4.5" fill="none" stroke="#0d2a5c" stroke-width="1" stroke-linejoin="round"/>`,
  green: `<polygon points="7,2 17,2 15,6 9,6" fill="#86e8ae"/><polygon points="17,2 21,6 17,8 15,6" fill="#4fcf85"/><polygon points="21,6 21,18 17,16 17,8" fill="#178445"/>
    <polygon points="21,18 17,22 15,18 17,16" fill="#0f6a36"/><polygon points="17,22 7,22 9,18 15,18" fill="#126f39"/><polygon points="7,22 3,18 7,16 9,18" fill="#1a8a49"/>
    <polygon points="3,18 3,6 7,8 7,16" fill="#3dbd71"/><polygon points="3,6 7,2 9,6 7,8" fill="#74e0a0"/>
    <polygon points="9,6 15,6 17,8 17,16 15,18 9,18 7,16 7,8" fill="#2cb066"/><polygon points="9,8 15,8 15,9.5 9,9.5" fill="#fff" opacity=".35"/>
    <polygon points="7,2 17,2 21,6 21,18 17,22 7,22 3,18 3,6" fill="none" stroke="#0a4423" stroke-width="1" stroke-linejoin="round"/>`,
  red: cutGem(8, 10.5, 5.2, -112.5, 2, 78, 44, '#5c0e0b'),
  black: cutGem(6, 10.5, 5, -90, 255, 9, 30, '#08080b'),
  gold: `<circle cx="12" cy="12" r="10.5" fill="#d9a40f" stroke="#7a5600" stroke-width="1"/><circle cx="12" cy="12" r="8" fill="#f6cf3d" stroke="#b5860a" stroke-width=".8"/>
    <polygon points="12,5.2 13.9,9.6 18.6,10 15,13.1 16.1,17.7 12,15.2 7.9,17.7 9,13.1 5.4,10 10.1,9.6" fill="#fff4bf" stroke="#9c7000" stroke-width=".7" stroke-linejoin="round"/>`,
};
function gemSvg(c, size = 22) {
  return `<svg class="gem" width="${size}" height="${size}" viewBox="0 0 24 24" style="flex:none">${GEM[c]}</svg>`;
}

// ---------- tranh minh hoạ thẻ (tự vẽ SVG, sinh 1 lần thành class CSS) ----------
const PAL = {
  white: { s1: '#f2f5f8', s2: '#a9b6c3', g: '#7b8691', d: '#353c44', a: '#ffffff', w: '#8fa3b6' },
  blue: { s1: '#b4d0f3', s2: '#2c5ca6', g: '#23467d', d: '#0e1d3a', a: '#9ccbff', w: '#2f62ad' },
  green: { s1: '#d5ebbd', s2: '#3e894e', g: '#2b5e37', d: '#11301b', a: '#86f5aa', w: '#3f8f63' },
  red: { s1: '#f8cfae', s2: '#b0402f', g: '#782a21', d: '#340f0b', a: '#ff9177', w: '#b3523f' },
  black: { s1: '#c3bccd', s2: '#4a4656', g: '#34313d', d: '#111015', a: '#e2d9f5', w: '#56516a' },
};
const defs = (p) => `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.s1}"/><stop offset="1" stop-color="${p.s2}"/></linearGradient>
  <radialGradient id="v" cx=".5" cy=".55" r=".75"><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".6"/></radialGradient>
  <radialGradient id="glow"><stop offset="0" stop-color="#ffe7a0" stop-opacity=".9"/><stop offset="1" stop-color="#ffe7a0" stop-opacity="0"/></radialGradient></defs>`;
const shard = (x, y, s, f) => `<polygon points="${P([[x, y - 3 * s], [x + 2 * s, y], [x, y + 2 * s], [x - 2 * s, y]])}" fill="${f}" stroke="#0006" stroke-width=".4"/><polygon points="${P([[x, y - 3 * s], [x + 2 * s, y], [x, y]])}" fill="#fff" opacity=".45"/>`;
function sceneMine(p) { // cấp 1: hầm mỏ
  let s = `<rect width="100" height="138" fill="url(#s)"/>
    <path d="M0 66 L18 44 L30 54 L52 24 L70 48 L84 37 L100 52 V138 H0Z" fill="${p.g}" opacity=".55"/>
    <path d="M52 24 L59 34 L55 33 L51 38 L47 33Z" fill="#fff" opacity=".55"/>
    <path d="M0 86 Q30 62 60 70 T100 66 V138 H0Z" fill="${p.g}"/>
    <path d="M0 110 Q50 94 100 106 V138 H0Z" fill="${p.d}"/>
    <path d="M36 102 V77 Q50 61 64 77 V102Z" fill="#0b0806"/>
    <rect x="33" y="70" width="5" height="34" fill="#6b4a2b"/><rect x="62" y="70" width="5" height="34" fill="#6b4a2b"/>
    <rect x="29" y="65" width="42" height="6.5" rx="1" fill="#7d5733"/><rect x="29" y="65" width="42" height="2" fill="#a77b4c"/>
    <circle cx="71" cy="78" r="8" fill="url(#glow)"/><rect x="69.6" y="75.5" width="2.8" height="4" rx=".6" fill="#ffd36b" stroke="#3b2a14" stroke-width=".5"/>
    <path d="M45 102 L35 138 M55 102 L65 138" stroke="#9a9a9a" stroke-width="1.3"/>`;
  for (let i = 0; i < 5; i++) { const t = i / 4, y = 106 + t * 30, hw = 6 + t * 10; s += `<line x1="${50 - hw - 2}" y1="${y}" x2="${50 + hw + 2}" y2="${y}" stroke="#5a3f27" stroke-width="${1.2 + t}"/>`; }
  s += `<g transform="translate(14 108)"><path d="M0 0 H20 L18 10 H2Z" fill="#5b4131" stroke="#2a1d14" stroke-width=".6"/>${shard(5, -1, 1.3, p.a)}${shard(10, -2, 1.6, p.a)}${shard(15, -1, 1.2, p.a)}
    <circle cx="5" cy="11" r="2.4" fill="#222"/><circle cx="15" cy="11" r="2.4" fill="#222"/></g>
    ${shard(84, 120, 1.4, p.a)}${shard(90, 126, 1, p.a)}${shard(79, 128, .9, p.a)}`;
  return s;
}
function sceneShip(p) { // cấp 2: thương thuyền
  let s = `<rect width="100" height="138" fill="url(#s)"/>
    <circle cx="72" cy="42" r="22" fill="url(#glow)" opacity=".7"/><circle cx="72" cy="42" r="10" fill="#fff6d8" opacity=".85"/>
    <ellipse cx="22" cy="40" rx="14" ry="3.5" fill="#fff" opacity=".35"/><ellipse cx="38" cy="34" rx="10" ry="2.5" fill="#fff" opacity=".3"/>
    <path d="M0 76 Q14 64 30 70 Q38 66 44 74 L44 78 H0Z" fill="${p.g}" opacity=".7"/>
    <rect y="76" width="100" height="62" fill="${p.w}"/><rect y="76" width="100" height="62" fill="${p.d}" opacity=".35"/>
    <path d="M60 78 Q72 76 84 78" stroke="#fff6d8" stroke-width="1" opacity=".6" fill="none"/>
    <line x1="42" y1="44" x2="42" y2="94" stroke="#3a2414" stroke-width="1.6"/><line x1="58" y1="50" x2="58" y2="94" stroke="#3a2414" stroke-width="1.4"/>
    <path d="M31 50 Q42 53 53 50 L52 63 Q42 66 32 63Z" fill="#f4ecdb" stroke="#8a7a62" stroke-width=".5"/>
    <path d="M32 66 Q42 69 52 66 L51 80 Q42 83 33 80Z" fill="#efe5d1" stroke="#8a7a62" stroke-width=".5"/>
    <path d="M50 56 Q58 58 66 56 L65 67 Q58 69 51 67Z" fill="#f4ecdb" stroke="#8a7a62" stroke-width=".5"/>
    <path d="M51 70 Q58 72 65 70 L64 82 Q58 84 52 82Z" fill="#efe5d1" stroke="#8a7a62" stroke-width=".5"/>
    <path d="M42 44 L50 46.5 L42 49Z" fill="${p.a}"/><path d="M58 50 L64 52 L58 54Z" fill="${p.a}"/>
    <path d="M58 86 L74 86 L78 82" stroke="#3a2414" stroke-width="1" fill="none"/>
    <path d="M22 90 L80 90 L72 104 L30 104Z" fill="#4a2e1c" stroke="#24150c" stroke-width=".6"/>
    <rect x="25" y="93" width="51" height="2.2" fill="#c99a3a"/>
    <circle cx="36" cy="98.5" r="1.2" fill="#1b100a"/><circle cx="46" cy="98.5" r="1.2" fill="#1b100a"/><circle cx="56" cy="98.5" r="1.2" fill="#1b100a"/><circle cx="66" cy="98.5" r="1.2" fill="#1b100a"/>
    <ellipse cx="51" cy="107" rx="26" ry="3" fill="#000" opacity=".25"/>`;
  for (let i = 0; i < 6; i++) { const y = 112 + i * 5; s += `<path d="M${(i % 2) * 8 - 6} ${y} q6 -2.5 12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0" stroke="#fff" stroke-width=".7" opacity="${.28 - i * .02}" fill="none"/>`; }
  return s;
}
function sceneCity(p) { // cấp 3: cung điện
  let s = `<rect width="100" height="138" fill="url(#s)"/>
    <circle cx="28" cy="36" r="20" fill="url(#glow)" opacity=".55"/><circle cx="28" cy="36" r="11" fill="#fff" opacity=".6"/>
    <g fill="${p.g}" opacity=".6"><rect x="2" y="70" width="12" height="40"/><rect x="12" y="62" width="9" height="48"/><path d="M60 72 Q68 58 76 72Z"/><rect x="58" y="72" width="20" height="38"/><rect x="80" y="60" width="10" height="50"/><path d="M79 60 L85 48 L91 60Z"/></g>
    <g fill="${p.d}"><path d="M35 82 Q35 60 50 55 Q65 60 65 82Z"/><rect x="25" y="82" width="50" height="32"/>
    <rect x="16" y="64" width="9" height="50"/><path d="M15 64 L20.5 50 L26 64Z"/><rect x="75" y="64" width="9" height="50"/><path d="M74 64 L79.5 50 L85 64Z"/>
    <rect x="42" y="72" width="16" height="10"/></g>
    <line x1="50" y1="55" x2="50" y2="44" stroke="${p.d}" stroke-width="1.2"/><circle cx="50" cy="44" r="1.6" fill="#e8b923"/>
    <circle cx="20.5" cy="50" r="1" fill="#e8b923"/><circle cx="79.5" cy="50" r="1" fill="#e8b923"/>
    <path d="M37 81 Q37 63 50 58" stroke="#e8b923" stroke-width=".6" fill="none" opacity=".7"/>
    <path d="M44 114 V102 Q50 95 56 102 V114Z" fill="#080608"/>`;
  for (const [x, y] of [[30, 88], [36, 88], [62, 88], [68, 88], [30, 98], [68, 98], [19, 72], [78, 72], [19, 84], [78, 84], [46, 76], [53, 76]]) s += `<rect x="${x}" y="${y}" width="2.6" height="4" rx="1.3" fill="${p.a}" opacity=".9"/>`;
  s += `<rect x="10" y="114" width="80" height="4" fill="${p.g}"/><rect x="5" y="118" width="90" height="4" fill="${p.g}" opacity=".85"/><rect x="0" y="122" width="100" height="16" fill="${p.d}" opacity=".9"/>
    <path d="M20.5 50 V45 L25 46.5 L20.5 48" fill="${p.a}" stroke="${p.d}" stroke-width=".3"/>`;
  return s;
}
const svgUrl = (inner, w, h) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice">${inner}</svg>`)}")`;
function portrait(n) { // quý tộc: chân dung bóng đổ theo màu yêu cầu
  const cs = COLORS.filter((c) => n.req[c]), p = PAL[cs[0]], q = PAL[cs[cs.length - 1]], v = n.id % 5, x = 62;
  const hats = [
    `<path d="M50 39 L51.5 26 L56 33 L62 23 L68 33 L72.5 26 L74 39Z" fill="#e8b923" stroke="#7a5600" stroke-width=".8"/><rect x="50" y="36" width="24" height="4" fill="#c99a1a"/><circle cx="62" cy="31" r="1.6" fill="${q.a}"/>`,
    `<ellipse cx="59" cy="37" rx="17" ry="6" fill="#141016"/><path d="M70 34 Q84 22 80 12 Q78 24 68 32Z" fill="${q.a}" opacity=".9"/>`,
    `<rect x="51" y="18" width="22" height="20" rx="2" fill="#141016"/><ellipse cx="62" cy="38" rx="18" ry="3.2" fill="#141016"/><rect x="51" y="32" width="22" height="3" fill="#c99a1a"/>`,
    `<path d="M53 36 Q62 29 71 36 L69 38 Q62 33 55 38Z" fill="#e8b923"/><circle cx="62" cy="33" r="1.5" fill="${q.a}"/>`,
    `<ellipse cx="62" cy="37" rx="15" ry="10" fill="#efe6d4"/><path d="M48 37 Q62 30 76 37" stroke="#bfb29a" stroke-width="1" fill="none"/><path d="M49 41 Q62 34 75 41" stroke="#bfb29a" stroke-width="1" fill="none"/><circle cx="62" cy="31" r="2.2" fill="${q.a}" stroke="#7a5600" stroke-width=".6"/>`,
  ];
  const body = `<path d="M26 100 C28 80 44 74 ${x} 73 C80 74 96 80 98 100Z" fill="${q.d}"/>
    <path d="M${x} 74 L56 100 M${x} 74 L68 100" stroke="#e8b923" stroke-width="1" opacity=".7"/>
    <rect x="${x - 5}" y="58" width="10" height="17" fill="#2a1f1a"/>
    <ellipse cx="${x}" cy="73.5" rx="15" ry="4.5" fill="#efe6d4" opacity=".9"/>
    <ellipse cx="${x}" cy="49" rx="10.5" ry="13.5" fill="#2a1f1a"/>`;
  return `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.s1}"/><stop offset="1" stop-color="${p.s2}"/></linearGradient>
    <radialGradient id="v" cx=".6" cy=".45" r=".7"><stop offset=".45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".6"/></radialGradient></defs>
    <rect width="100" height="100" fill="url(#s)"/><path d="M40 100 V40 Q62 6 84 40 V100Z" fill="#fff" opacity=".18"/>
    ${v === 3 ? '<path d="M47 52 Q46 30 62 31 Q78 30 77 52 L80 76 L44 76Z" fill="#1d1418"/>' : ''}${body}${hats[v]}<rect width="100" height="100" fill="url(#v)"/>`;
}
(function buildArt() {
  const scenes = { 1: sceneMine, 2: sceneShip, 3: sceneCity };
  let css = '';
  for (const l of [1, 2, 3]) for (const c of COLORS) for (const v of [0, 1]) {
    const p = PAL[c], inner = scenes[l](p);
    const body = v ? `<g transform="translate(100 0) scale(-1 1)">${inner}</g>` : inner;
    css += `.art-${l}-${c}-${v}{background-image:${svgUrl(defs(p) + body + '<rect width="100" height="138" fill="url(#v)"/>', 100, 138)}}\n`;
  }
  for (const n of NOBLES) css += `.nart-${n.id}{background-image:${svgUrl(portrait(n), 100, 100)}}\n`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
})();

// ---------- tiện ích ----------
const me = () => S.game.players.find((p) => p.id === S.lobby.me);
const cur = () => S.game.players[S.game.turn];
const myTurn = () => S.game && S.game.phase !== 'over' && cur().id === S.lobby.me;
function pay(p, card) {
  let gold = 0; const out = {};
  for (const c of COLORS) {
    const need = Math.max(0, (card.cost[c] || 0) - p.bonuses[c]);
    const use = Math.min(need, p.tokens[c]);
    out[c] = use; gold += need - use;
  }
  if (gold > p.tokens.gold) return null;
  out.gold = gold; return out;
}
const total = (t) => Object.values(t).reduce((a, b) => a + b, 0);
function showToast(m, quiet) {
  if (!quiet) FX.sfx('error');
  toastMsg = m; clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastMsg = ''; render(); }, 3000); render();
}
async function post(path, body = {}) {
  const r = await fetch('/api/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ room: sess && sess.room, token: sess && sess.token, ...body }) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || 'Lỗi');
  return j;
}
async function act(action) {
  try { await post('action', { action }); sel = []; disc = {}; modal = null; }
  catch (e) { showToast(e.message); }
}

// ---------- kết nối ----------
// Long-poll: server giữ request tới khi có thay đổi (chạy tốt qua tunnel/proxy, khác với SSE).
let loopId = 0, ver = 0;
function connect() {
  const id = ++loopId; ver = 0; fails = 0;
  (async () => {
    while (sess && id === loopId) {
      try {
        const r = await fetch(`/api/poll?room=${sess.room}&token=${sess.token}&v=${ver}`, { cache: 'no-store' });
        const j = await r.json();
        if (id !== loopId) return;
        if (!r.ok) throw new Error(j.error || 'lỗi');
        fails = 0;
        if (offline) { offline = false; render(); }
        ver = j.v;
        if (!j.same) {
          const prevG = S && S.game, snap = FX.snapshot();
          S = j.data; onState(); render();
          if (S.game) FX.diff(prevG, S.game, snap, S.lobby.me);
        }
      } catch (e) {
        if (id !== loopId) return;
        fails++;
        if (fails >= 2 && !offline) { offline = true; render(); }
        if (fails > 8) { // phòng không còn / phiên hỏng
          localStorage.removeItem('splendor'); sess = null; S = null; lobbyErr = 'Mất kết nối với phòng.'; render(); return;
        }
        await new Promise((r) => setTimeout(r, Math.min(1000 * fails, 4000)));
      }
    }
  })();
}
function setSess(s) { sess = s; localStorage.setItem('splendor', JSON.stringify(s)); connect(); }
function onState() {
  const L = S.lobby; skew = L.now - Date.now();
  const maxChat = L.chat.length ? L.chat[L.chat.length - 1].i : 0;
  if (seenChat === null) seenChat = maxChat;
  else if (maxChat > seenChat) {
    const fresh = L.chat.filter((c) => c.i > seenChat);
    seenChat = maxChat;
    for (const c of fresh) if (c.id !== L.me) {
      FX.sfx(c.emo ? 'tok' : 'chat');
      if (S.game && c.emo) setTimeout(() => {
        const pl = document.querySelector(`.pl[data-pid="${c.id}"]`);
        if (pl) { const r = pl.getBoundingClientRect(); FX.floatText({ x: r.left, y: r.top, w: r.width, h: 20 }, c.text, 'noble'); }
      }, 50);
    }
  }
  const nt = L.nudge ? L.nudge.t : 0;
  if (seenNudge === null) seenNudge = nt;
  else if (nt > seenNudge) {
    seenNudge = nt;
    if (L.nudge.to === L.me) { FX.sfx('nudge'); FX.flash(`${L.nudge.from} đang đợi bạn!`); vib([200, 100, 200]); }
  }
  const g = S.game;
  if (!g) { if (modal && modal.kind !== 'settings') modal = null; return; }
  const key = g.turn + ':' + g.phase + ':' + g.round;
  if (key !== lastTurnKey) {
    lastTurnKey = key; sel = []; disc = {};
    if (myTurn() && (document.hidden || !document.hasFocus())) {
      vib(150);
      if (notifyOn) try { new Notification('Splendor', { body: 'Đến lượt bạn!', tag: 'splendor-turn' }); } catch (e) {}
    }
    if (modal && !['over', 'settings', 'history'].includes(modal.kind)) modal = null;
  }
  if (g.phase === 'over' && !(modal && modal.kind === 'over') && !modal?.dismissed) modal = { kind: 'over' };
  document.title = myTurn() ? '▶ Đến lượt bạn! - Splendor' : 'Splendor';
}

// ---------- vẽ thành phần ----------
function costCircles(card) {
  return COLORS.filter((c) => card.cost[c]).map((c) => `<div class="cost ${c}">${card.cost[c]}</div>`).join('');
}
// ---------- ảnh thẻ thật (public/art, cắt bằng tools/build_art.py); ảnh nào lỗi thì quay về tranh SVG ----------
const NOIMG = new Set();
function probeArt() {
  const check = (key, src) => { const im = new Image(); im.onerror = () => { NOIMG.add(key); render(); }; im.src = src; };
  CARDS.forEach((c) => check('c' + c.id, `art/c${c.id}.jpg`));
  NOBLES.forEach((n) => check('n' + n.id, `art/n${n.id}.jpg`));
}
const useImg = (key) => prefs.art === 'photo' && !NOIMG.has(key);
function cardHtml(id, attrs = '', cls = '') {
  const c = CARDS[id], cid = cls.includes('nocid') ? '' : `data-cid="${id}"`;
  if (useImg('c' + id)) return `<div class="card img b-${c.bonus} ${cls}" style="background-image:url(art/c${id}.jpg)" ${cid} ${attrs}></div>`;
  return `<div class="card b-${c.bonus} art-${c.level}-${c.bonus}-${id % 2} ${cls}" ${cid} ${attrs}>
    <div class="top"><span class="pts">${c.points || ''}</span>${gemSvg(c.bonus, 28)}</div>
    <div class="costs">${costCircles(c)}</div><i class="lvm">${'•'.repeat(c.level)}</i></div>`;
}
const ROMAN = ['', 'I', 'II', 'III'];
function backHtml(level, n, attrs = '') {
  return `<div class="card back l${level}" ${attrs}><div class="bk">
    <span class="bt">SPLENDOR</span>${gemSvg(['', 'green', 'gold', 'blue'][level], 34)}<b>${ROMAN[level]}</b><span class="bn">${n == null ? '' : n + ' thẻ'}</span></div></div>`;
}
function nobleProg(n) {
  if (!(S && S.game && me())) return '';
  const b = me().bonuses; let have = 0, need = 0;
  for (const c of COLORS) if (n.req[c]) { need += n.req[c]; have += Math.min(b[c], n.req[c]); }
  return need ? `<i class="nprog" title="${have}/${need}"><u style="width:${(have / need) * 100}%"></u></i>` : '';
}
function nobleHtml(id, pick) {
  const n = NOBLES[id], pk = `${pick ? 'pick' : ''}" data-nid="${id}" ${pick ? `data-a="noble" data-id="${id}"` : ''}`;
  if (useImg('n' + id)) return `<div class="noble img ${pk} style="background-image:url(art/n${id}.jpg)">${nobleProg(n)}</div>`;
  return `<div class="noble nart-${id} ${pk}><div class="nside">
    <span class="np">${n.points}</span>
    <div class="nr">${COLORS.filter((c) => n.req[c]).map((c) => `<div class="cost ${c}">${n.req[c]}</div>`).join('')}</div></div>${nobleProg(n)}</div>`;
}
function tokHtml(c, n, extra = '', cls = '', attrs = '') {
  let stk = '';
  if (!cls.includes('mini') && n > 0 && attrs.includes('data-bank')) { // xếp chồng: càng nhiều đá, chồng càng dày
    const k = Math.min(n, 6), L = [];
    for (let i = 1; i <= k; i++) L.push(`0 ${i * 3}px 0 ${i % 2 ? 'var(--tc)' : 'var(--te)'}`);
    stk = `style="--stk:${L.join(',')},0 ${k * 3 + 6}px 12px #000a"`;
  }
  return `<div class="tok ${c} ${cls}" ${attrs} ${stk} title="${VI[c]}">${gemSvg(c, cls.includes('mini') ? 17 : 32)}${extra}<span class="n">${n}</span></div>`;
}

// ---------- màn hình sảnh ----------
function renderEntry() {
  const q = new URLSearchParams(location.search).get('room') || '';
  const name = localStorage.getItem('splendor_name') || '';
  return `<div class="center"><div class="box">
    <div class="gemrow">${[...COLORS, 'gold'].map((c) => gemSvg(c, 30)).join('')}</div>
    <h1>SPLENDOR</h1><div class="sub">Bản chơi riêng cùng bạn bè · 2–4 người</div>
    <input id="name" placeholder="Tên của bạn" maxlength="16" value="${esc(name)}">
    <div class="row"><button style="flex:1" data-a="create">Tạo phòng mới</button></div>
    <div class="sub" style="margin:.6em 0">— hoặc vào phòng bạn bè —</div>
    <div class="row"><input id="code" placeholder="MÃ PHÒNG" maxlength="4" value="${esc(q.toUpperCase())}" style="text-transform:uppercase;letter-spacing:.2em;text-align:center"><button data-a="join">Vào</button></div>
    <div class="err">${esc(lobbyErr)}</div></div></div>`;
}
function renderLobby() {
  const L = S.lobby, host = L.hostId === L.me;
  const link = `${location.origin}/?room=${L.code}`;
  return `<div class="center"><div class="box">
    <h1>SPLENDOR</h1><div class="sub">Gửi mã hoặc link này cho bạn bè</div>
    <div class="code">${L.code}</div>
    <div class="row"><input readonly value="${esc(link)}" onclick="this.select()"><button class="sec" data-a="copy">Chép</button></div>
    <div class="lbl" style="margin-top:14px">Người chơi (${L.members.length}/4)</div>
    ${L.members.map((m) => `<div class="member"><span class="dot ${m.online ? 'on' : ''}"></span><b style="flex:1">${esc(m.name)}${m.id === L.me ? ' (bạn)' : ''}</b>${m.bot ? '<span class="tag bot">MÁY</span>' : ''}${m.id === L.hostId ? '<span class="tag">CHỦ PHÒNG</span>' : ''}${host && m.bot ? `<button class="sec x" data-a="rmbot" data-id="${m.id}" title="Xoá máy">✕</button>` : ''}</div>`).join('')}
    ${host ? `<div class="lbl" style="margin-top:12px">Thêm máy chơi cùng</div><div class="row" style="flex-wrap:wrap;margin:6px 0">${L.bots.map((b) => `<button class="sec" data-a="addbot" data-s="${b.key}" ${L.members.length >= 4 ? 'disabled' : ''}>+ ${b.name}</button>`).join('')}</div>
      <div class="row"><span class="lbl" style="flex:none">Đồng hồ lượt</span><select id="timer">${[0, 45, 60, 90, 120, 180].map((t) => `<option value="${t}" ${L.settings.timer === t ? 'selected' : ''}>${t ? t + ' giây' : 'Tắt'}</option>`).join('')}</select></div>`
      : `<div class="lbl" style="margin-top:10px">Đồng hồ lượt: ${L.settings.timer ? L.settings.timer + ' giây' : 'tắt'}</div>`}
    ${scoreHtml()}
    <div class="row" style="margin-top:14px">
      ${host ? `<button style="flex:1" data-a="start" ${L.members.length < 2 ? 'disabled' : ''}>Bắt đầu ván</button>` : '<div class="sub" style="flex:1;margin:0">Đợi chủ phòng bắt đầu…</div>'}
      <button class="sec" data-a="leave">Rời</button></div>
    <div class="err">${esc(lobbyErr)}</div></div></div>`;
}

// ---------- màn hình game ----------
function banner() {
  const g = S.game, p = cur(), mine = myTurn();
  let t = '', s = '';
  if (g.phase === 'over') t = '🏁 Ván đã kết thúc';
  else if (mine) {
    if (g.phase === 'main') { t = 'Đến lượt bạn!'; s = g.canPass ? 'Bạn không còn nước đi nào — hãy bỏ lượt.' : 'Lấy đá quý, giữ 1 thẻ, hoặc mua 1 thẻ.'; }
    if (g.phase === 'discard') { t = 'Bạn đang có hơn 10 viên đá'; s = `Hãy bỏ bớt ${total(me().tokens) - 10} viên.`; }
    if (g.phase === 'noble') { t = 'Có nhiều quý tộc muốn đến thăm'; s = 'Bấm vào một quý tộc để chọn.'; }
  } else t = `Lượt của ${esc(p.name)}`, s = g.phase === 'discard' ? 'đang bỏ bớt đá' : g.phase === 'noble' ? 'đang chọn quý tộc' : '';
  const dl = S.lobby.deadline, cd = g.phase !== 'over' && dl && !isBotId(p.id) ? `<span class="cd" data-dl="${dl}"></span>` : '';
  return `<div class="banner ${mine ? 'me' : ''}">${cd}${t}${s ? `<small>${s}</small>` : ''}</div>` +
    (g.finalRound && g.phase !== 'over' ? `<div class="banner final">⚠ Vòng cuối! Có người đã đạt 15 điểm — chơi hết vòng này.</div>` : '');
}

function boardHtml() {
  const g = S.game, m = me(), mine = myTurn() && g.phase === 'main';
  let h = `<div class="nobles">${g.nobles.map((id) => nobleHtml(id, g.eligible.includes(id))).join('')}</div>`;
  for (const l of [3, 2, 1]) {
    h += `<div class="lvrow">` + (g.deckCounts[l] ? backHtml(l, g.deckCounts[l], `data-deck="${l}" ` + (mine && m.reserved.length < 3 ? `data-a="deck" data-l="${l}"` : '')) : `<div class="card empty"></div>`);
    g.board[l].forEach((id, i) => {
      if (id == null) { h += `<div class="card empty"></div>`; return; }
      const aff = mine && pay(m, CARDS[id]);
      h += cardHtml(id, `data-a="card" data-from="board" data-l="${l}" data-i="${i}" data-id="${id}"`, aff ? 'afford' : mine ? 'nope' : '');
    });
    h += `</div>`;
  }
  return h;
}

function bankHtml() {
  const g = S.game, mine = myTurn() && g.phase === 'main';
  let h = '';
  for (const c of [...COLORS, 'gold']) {
    const n = g.bank[c], k = sel.filter((x) => x === c).length;
    h += tokHtml(c, n, k ? `<span class="sc">${k}</span>` : '', `${k ? 'sel' : ''} ${n ? '' : 'zero'}`, `data-bank="${c}" ` + (c !== 'gold' && mine ? `data-a="tok" data-c="${c}"` : ''));
  }
  return h;
}

function selValid() {
  const g = S.game;
  if (!sel.length) return false;
  if (sel.length === 2 && sel[0] === sel[1]) return g.bank[sel[0]] >= 4;
  const avail = COLORS.filter((c) => g.bank[c] > 0).length;
  return new Set(sel).size === sel.length && sel.length === Math.min(3, avail);
}

function actsHtml() {
  const g = S.game, mine = myTurn() && g.phase === 'main';
  if (!mine) return '';
  return `<div class="acts">
    <button data-a="take" ${selValid() ? '' : 'disabled'} title="${sel.map((c) => VI[c]).join(' + ')}">Lấy ${sel.length ? sel.length + ' viên' : 'đá'}</button>
    ${sel.length ? '<button class="sec" data-a="clear">Bỏ chọn</button>' : ''}
    ${g.canPass ? '<button class="bad" data-a="pass">Bỏ lượt</button>' : ''}</div>`;
}

function playerHtml(p) {
  const g = S.game, isMe = p.id === S.lobby.me, turn = cur().id === p.id && g.phase !== 'over';
  const mem = S.lobby.members.find((m) => m.id === p.id);
  const pi = g.players.indexOf(p), pcol = ['#e8b923', '#4f8be9', '#e24a44', '#3dbd71'][pi % 4];
  let h = `<div class="pl ${turn ? 'turn' : ''}" data-pid="${p.id}" style="--pc:${pcol}"><div class="hd"><span class="av">${esc(Array.from((p.name || '?').trim())[0].toUpperCase())}</span><span class="dot ${mem && mem.online ? 'on' : ''}"></span>
    <span class="nm">${esc(p.name)}${isMe ? ' (bạn)' : ''}</span>${turn ? '<span class="tag">LƯỢT</span>' : ''}<span class="pt" style="--p:${Math.min(100, (p.points / 15) * 100)}"><b>${p.points}</b></span></div>`;
  h += `<div class="chips">${['white', 'blue', 'green', 'red', 'black', 'gold'].map((c) => p.tokens[c] ? tokHtml(c, p.tokens[c], '', 'mini') : '').join('') || '<span class="lbl">chưa có đá</span>'}</div>`;
  h += `<div class="bon">${COLORS.map((c) => p.bonuses[c] ? `<span class="bonc k-${c}" title="Bonus ${VI[c]}">${gemSvg(c, 15)}<b>${p.bonuses[c]}</b></span>` : '').join('')}<span class="bonc" title="Số thẻ đã mua">🃏 ${p.cards.length}</span>${p.nobles.length ? `<span class="bonc">👑 ${p.nobles.length}</span>` : ''}</div>`;
  if (p.reserved.length) {
    h += `<div class="lbl">Thẻ giữ</div><div class="res">` + p.reserved.map((r) => {
      if (r.hidden) return backHtml(r.level, null, 'style="cursor:default"').replace('card back', 'card back small');
      const aff = isMe && myTurn() && g.phase === 'main' && pay(p, CARDS[r.id]);
      return cardHtml(r.id, isMe ? `data-a="card" data-from="reserved" data-id="${r.id}"` : 'style="cursor:default"', 'small ' + (aff ? 'afford' : ''));
    }).join('') + '</div>';
  }
  return h + '</div>';
}

function chatHtml() {
  const L = S.lobby;
  const msgs = L.chat.map((c) => `<div class="cm ${c.id === L.me ? 'mine' : ''} ${c.emo ? 'emo' : ''}"><b>${esc(c.name)}</b> ${esc(c.text)}</div>`).join('') || '<div class="lbl" style="padding:4px">Chưa có tin nhắn</div>';
  return `<div class="chat"><div class="cmsgs" id="cmsgs">${msgs}</div>
    <div class="qe">${EMO.map((e) => `<button class="sec" data-a="emo" data-t="${e}">${e}</button>`).join('')}${PHRASES.map((e) => `<button class="sec ph" data-a="emo" data-t="${e}">${e}</button>`).join('')}</div>
    <div class="crow"><input id="chatin" maxlength="140" placeholder="Nhắn tin…" autocomplete="off"><button data-a="chatsend">Gửi</button></div></div>`;
}
function scoreHtml() {
  const L = S.lobby, rows = L.members.filter((m) => !m.bot && L.scores[m.id] && L.scores[m.id].g).map((m) => ({ n: m.name, ...L.scores[m.id] }));
  if (!rows.length) return '';
  return `<div class="lbl" style="margin-top:12px">Thành tích nhóm</div><table class="score" style="width:100%">${rows.sort((a, b) => b.w - a.w).map((r) => `<tr><td>${esc(r.n)}</td><td>${r.w} thắng</td><td class="lbl">${r.g} ván</td></tr>`).join('')}</table>`;
}
function renderGame() {
  const g = S.game;
  const order = [...g.players]; // giữ thứ tự lượt
  return `<div class="wrap">
    <div class="topbar">${banner()}
      ${g.phase !== 'over' && !myTurn() && !isBotId(cur().id) ? '<button class="sec" data-a="nudge">⏰ Nhắc</button>' : ''}
      ${g.phase === 'over' ? '<button data-a="showover">🏆 Kết quả</button>' : ''}
      <button class="sec" data-a="history">Lịch sử</button><button class="sec" data-a="help">Luật</button>
      ${S.lobby.hostId === S.lobby.me && g.phase !== 'over' ? '<button class="sec" data-a="abort">Hủy ván</button>' : ''}
      <button class="bad" data-a="quit">Thoát</button></div>
    <div class="game">
      <div class="table"><div class="board">${boardHtml()}</div>
      <div class="bank">${bankHtml()}${actsHtml()}</div></div>
      <div class="side">${order.map(playerHtml).join('')}
        <div class="log" id="log">${g.log.slice(-40).map((l) => `<div>${esc(l.t)}</div>`).join('')}</div>
        ${chatHtml()}
        <div class="lbl">Phòng ${S.lobby.code} · Vòng ${g.round}</div></div>
    </div></div>`;
}

// ---------- modal ----------
function renderModal() {
  if (!modal) return '';
  if (modal.kind === 'settings') return settingsHtml();
  const g = S.game, m = me();
  if (modal.kind === 'help') return `<div class="ov" data-a="closem"><div class="md" data-stop>
    <h3>Luật tóm tắt</h3><p style="font-size:.9rem;line-height:1.5">Mỗi lượt chọn <b>1</b> hành động:<br>
    • Lấy 3 viên khác màu; hoặc 2 viên cùng màu (khi chồng còn ≥ 4).<br>
    • Giữ 1 thẻ (tối đa 3) và nhận 1 vàng (joker).<br>
    • Mua 1 thẻ (từ bàn hoặc thẻ đã giữ). Thẻ đã mua cho bonus vĩnh viễn giảm giá.<br>
    Tối đa 10 viên đá trong tay. Cuối lượt, nếu đủ bonus thì quý tộc (+3) tự đến.<br>
    Ai đạt 15 điểm sẽ kích hoạt vòng cuối; điểm cao nhất thắng (hòa: ít thẻ hơn thắng).</p>
    <div class="mdb"><button data-a="closem">Đóng</button></div></div></div>`;
  if (modal.kind === 'history') {
    let h = '', r0 = -1;
    for (const l of g.log) { if (l.r !== r0) { r0 = l.r; h += `<div class="rh">Vòng ${l.r}</div>`; } h += `<div class="hl">${esc(l.t)}</div>`; }
    return `<div class="ov" data-a="closem"><div class="md wide" data-stop><h3>Lịch sử nước đi</h3><div class="hist" id="hist">${h}</div>
      <div class="mdb"><button data-a="closem">Đóng</button></div></div></div>`;
  }
  if (modal.kind === 'over') return finalHtml();
  if (modal.kind === 'deck') return `<div class="ov" data-a="closem"><div class="md" data-stop>
    <h3>Giữ thẻ úp cấp ${modal.level}?</h3><p>Bạn sẽ bốc thẻ trên cùng của chồng (không xem trước ai cũng không thấy trừ bạn) và nhận 1 vàng nếu còn.</p>
    <div class="mdb"><button class="sec" data-a="closem">Hủy</button><button data-a="doreserve" data-l="${modal.level}" data-i="-1">Giữ thẻ</button></div></div></div>`;
  if (modal.kind === 'card') {
    const card = CARDS[modal.id], mine = myTurn() && g.phase === 'main', pm = pay(m, card);
    const canRes = mine && modal.from === 'board' && m.reserved.length < 3;
    const payHtml = pm ? COLORS.concat('gold').filter((c) => pm[c]).map((c) => tokHtml(c, pm[c], '', 'mini')).join('') || '<b>Miễn phí!</b>' : '<span style="color:var(--bad)">Không đủ đá quý</span>';
    return `<div class="ov" data-a="closem"><div class="md" data-stop>
      ${cardHtml(modal.id, '', 'nocid')}
      <div class="lbl" style="text-align:center;margin-top:10px">Bạn sẽ trả</div><div class="pay">${payHtml}</div>
      <div class="mdb"><button class="sec" data-a="closem">Đóng</button>
        ${canRes ? `<button class="sec" data-a="doreserve" data-l="${modal.level}" data-i="${modal.index}">Giữ</button>` : ''}
        ${mine ? `<button data-a="dobuy" ${pm ? '' : 'disabled'}>Mua</button>` : ''}</div></div></div>`;
  }
  return '';
}


// ---------- màn hình kết quả ----------
function finalHtml() {
  const g = S.game, L = S.lobby, host = L.hostId === L.me, anim = !modal.shown;
  const rows = [...g.players].sort((a, b) => b.points - a.points || a.cards.length - b.cards.length);
  const won = g.winners.includes(L.me), tie = g.winners.length > 1;
  const wn = g.players.filter((p) => g.winners.includes(p.id)).map((p) => esc(p.name)).join(' & ');
  const maxP = Math.max(1, ...rows.map((p) => p.points));
  const col = (p) => PCOL[g.players.indexOf(p) % 4];
  const title = won ? (tie ? '🤝 Hoà — cùng chiến thắng!' : '🏆 Chiến thắng!') : 'Ván đã kết thúc';
  const sub = won ? 'Một vụ giao thương rực rỡ!' : `${wn} giành chiến thắng. Lần sau sẽ khác!`;
  const pod = rows.map((p, i) => {
    const w = g.winners.includes(p.id);
    return `<div class="pod ${w ? 'win' : ''} ${anim ? 'play' : ''}" style="--h:${46 + (p.points / maxP) * 120}px;--pc:${col(p)};--d:${(rows.length - 1 - i) * 0.25}s">
      <div class="pn">${w ? '<span class="crown">👑</span>' : ''}<span class="av">${esc(Array.from((p.name || '?').trim())[0].toUpperCase())}</span><b>${esc(p.name)}</b></div>
      <div class="bar"><span class="cnt" data-to="${p.points}">${anim ? 0 : p.points}</span><small>${p.cards.length} thẻ · ${p.nobles.length} quý tộc</small></div></div>`;
  }).join('');
  // biểu đồ điểm theo vòng
  let chart = '';
  const ser = g.series || [];
  if (ser.length >= 2) {
    const W = 340, H = 120, px = 26, py = 10, n = ser.length, my = Math.max(15, maxP);
    const X = (i) => px + (i / n) * (W - px - 8), Y = (v) => H - py - (v / my) * (H - 2 * py);
    const lines = g.players.map((p, k) => {
      const pts = [[X(0), Y(0)], ...ser.map((r, i) => [X(i + 1), Y(r[k])])];
      const len = Math.round(pts.reduce((a, c, i) => (i ? a + Math.hypot(c[0] - pts[i - 1][0], c[1] - pts[i - 1][1]) : 0), 0)) + 4;
      const last = pts[pts.length - 1];
      return `<polyline points="${pts.map((c) => c.map((v) => v.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="${PCOL[k % 4]}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" ${anim ? `class="draw" style="--len:${len}"` : ''}/>
        <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="3.4" fill="${PCOL[k % 4]}"/>`;
    }).join('');
    const y15 = Y(15);
    chart = `<div class="lbl" style="margin-top:12px">Điểm theo từng vòng</div>
      <svg class="chart" viewBox="0 0 ${W} ${H}"><line x1="${px}" y1="${y15}" x2="${W - 8}" y2="${y15}" stroke="#e8b92388" stroke-dasharray="4 4"/><text x="2" y="${y15 + 3}" font-size="9" fill="#e8b923">15</text>
      <line x1="${px}" y1="${H - py}" x2="${W - 8}" y2="${H - py}" stroke="#ffffff22"/>${lines}</svg>
      <div class="legend">${g.players.map((p, k) => `<span><i style="background:${PCOL[k % 4]}"></i>${esc(p.name)}</span>`).join('')}</div>`;
  }
  // danh hiệu
  const st = (p, k) => (p.st && p.st[k]) || 0;
  const AW = [['📚', 'Nhà sưu tập', 'thẻ', (p) => p.cards.length], ['👑', 'Quý tộc sủng ái', 'quý tộc', (p) => p.nobles.length],
    ['💰', 'Tay buôn đá', 'viên đã lấy', (p) => st(p, 'take')], ['🃏', 'Người giữ bài', 'thẻ đã giữ', (p) => st(p, 'reserve')],
    ['🏰', 'Chủ thành cấp 3', 'thẻ cấp 3', (p) => p.cards.filter((id) => CARDS[id].level === 3).length]];
  const awards = AW.map(([ic, nm, unit, f]) => {
    const mx = Math.max(...g.players.map(f)); if (mx <= 0) return '';
    const who = g.players.filter((p) => f(p) === mx); if (who.length === g.players.length) return '';
    return `<div class="aw"><span class="ic">${ic}</span><div><b>${nm}</b><small>${who.map((p) => esc(p.name)).join(' & ')} · ${mx} ${unit}</small></div></div>`;
  }).filter(Boolean).slice(0, 4).join('');
  return `<div class="ov final ${won ? 'won' : 'lost'}"><div class="rays"></div><div class="md fin ${anim ? 'play' : ''}" data-stop>
    <h2 class="ftitle">${title}</h2><div class="sub">${sub}</div>
    <div class="podium">${pod}</div>${chart}
    ${awards ? `<div class="awards">${awards}</div>` : ''}${scoreHtml()}
    <div class="mdb"><button class="sec" data-a="closeover">Xem bàn</button>${host ? '<button data-a="rematch">Ván mới</button><button class="sec" data-a="tolobby">Về sảnh</button>' : '<div class="sub" style="flex:1;margin:0">Đợi chủ phòng bắt đầu ván mới…</div>'}</div></div></div>`;
}
function countUp() {
  document.querySelectorAll('.cnt[data-to]').forEach((el) => {
    const to = +el.dataset.to, t0 = performance.now(), dur = 1400 + to * 25;
    const tick = (t) => { const k = Math.min(1, (t - t0) / dur); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1 && document.body.contains(el)) requestAnimationFrame(tick); else el.textContent = to; };
    requestAnimationFrame(tick);
  });
}

// ---------- cài đặt giao diện ----------
function settingsHtml() {
  const st = FX.state(), tr = FX.tracks();
  return `<div class="ov" data-a="closem"><div class="md wide set" data-stop>
    <h3>Tuỳ chỉnh</h3>
    <div class="lbl">Bàn chơi</div>
    <div class="swatches">${TABLES.map((t) => `<button class="sw ${prefs.table === t.id ? 'on' : ''}" data-a="pref" data-k="table" data-v="${t.id}" style="--s1:${t.c1};--s2:${t.c2}"><i></i>${t.name}</button>`).join('')}</div>
    <div class="lbl">Bộ bài (mặt sau thẻ)</div>
    <div class="swatches">${DECKS.map((d) => `<button class="sw deck ${prefs.deck === d.id ? 'on' : ''}" data-a="pref" data-k="deck" data-v="${d.id}" ><span class="mb l1 card back" style="--k1:${d.k[0][0]};--k2:${d.k[0][1]}"></span><span class="mb l2 card back" style="--k1:${d.k[1][0]};--k2:${d.k[1][1]}"></span><span class="mb l3 card back" style="--k1:${d.k[2][0]};--k2:${d.k[2][1]}"></span>${d.name}</button>`).join('')}</div>
    <div class="lbl">Tranh trên thẻ</div>
    <div class="swatches"><button class="sw txt ${prefs.art === 'photo' ? 'on' : ''}" data-a="pref" data-k="art" data-v="photo">Ảnh gốc</button><button class="sw txt ${prefs.art === 'svg' ? 'on' : ''}" data-a="pref" data-k="art" data-v="svg">Tranh vẽ</button></div>
    <div class="lbl">Nhạc nền</div>
    <div class="tracks">${tr.map((t) => `<button class="tk ${st.track === t.id && st.music ? 'on' : ''}" data-a="track" data-id="${t.id}"><b>${st.track === t.id && st.music ? '♪ ' : ''}${t.name}</b><small>${t.desc}</small></button>`).join('')}
      <button class="tk ${st.music ? '' : 'on'}" data-a="music"><b>${st.music ? 'Tắt nhạc nền' : '✓ Đang tắt nhạc'}</b></button></div>
    <div class="vol"><span class="lbl">Âm lượng nhạc</span><input type="range" id="musvol" min="0" max="100" value="${Math.round(st.mvol * 100)}"></div>
    <div class="vol"><span class="lbl">Âm lượng hiệu ứng</span><input type="range" id="sfxvol" min="0" max="100" value="${Math.round(st.svol * 100)}"></div>
    <div class="mdb"><button data-a="closem">Xong</button></div></div></div>`;
}

function renderDiscard() {
  const g = S.game;
  if (!(myTurn() && g.phase === 'discard')) return '';
  const m = me(), need = total(m.tokens) - 10, got = total(disc);
  return `<div class="ov"><div class="md"><h3>Bỏ bớt ${need} viên</h3>
    <p style="color:var(--mut);font-size:.9rem">Tối đa 10 viên đá trong tay. Đã chọn bỏ: <b>${got}/${need}</b></p>
    <div class="disc">${[...COLORS, 'gold'].filter((c) => m.tokens[c]).map((c) => `<div class="dc">${tokHtml(c, m.tokens[c] - (disc[c] || 0))}
      <div><button class="sec" data-a="dminus" data-c="${c}">−</button><b>${disc[c] || 0}</b><button class="sec" data-a="dplus" data-c="${c}">+</button></div></div>`).join('')}</div>
    <div class="mdb"><button data-a="dodisc" ${got === need ? '' : 'disabled'}>Xác nhận</button></div></div></div>`;
}

function sndHtml() {
  const st = FX.state();
  return `<div class="snd"><button data-a="settings" title="Giao diện, bộ bài, nhạc">⚙️</button><button class="${st.music ? '' : 'off'}" data-a="music" title="Nhạc nền">🎵</button><button class="${st.sfx ? '' : 'off'}" data-a="sfx" title="Hiệu ứng âm thanh">🔔</button>${'Notification' in window ? `<button class="${notifyOn ? '' : 'off'}" data-a="notif" title="Thông báo khi đến lượt (lúc ở tab khác)">📣</button>` : ''}</div>`;
}
function render() {
  const ae = document.activeElement, keep = ae && ae.id ? { id: ae.id, v: ae.value, s: ae.selectionStart } : null;
  const IDS = ['log', 'cmsgs'], stick = {};
  for (const id of IDS) { const e = document.getElementById(id); stick[id] = !e || e.scrollTop + e.clientHeight >= e.scrollHeight - 10; }
  let h;
  if (!sess || !S) h = renderEntry();
  else if (!S.game) h = renderLobby();
  else h = renderGame() + renderModal() + renderDiscard();
  if (!(sess && S && S.game) && modal && modal.kind === 'settings') h += settingsHtml();
  // hoạt ảnh xuất hiện chỉ chạy khi đổi màn hình/hộp thoại; vẽ lại giữa chừng (poll, chọn đá...) thì giữ nguyên, không giật
  const sig = (!sess || !S ? 'e' : !S.game ? 'l' : 'g') + '|' + (modal ? modal.kind : '') + '|' + (toastMsg ? 1 : 0) + '|' + (S && S.game && myTurn() && S.game.phase === 'discard' ? 'd' : '');
  $app.classList.toggle('still', sig === lastSig); lastSig = sig;
  $app.innerHTML = (offline ? '<div class="conn">⚠ Mất kết nối — đang thử lại…</div>' : '') + sndHtml() + h + (toastMsg ? `<div class="toast">${esc(toastMsg)}</div>` : '');
  if (keep) { const e = document.getElementById(keep.id); if (e) { e.value = keep.v; e.focus(); try { e.setSelectionRange(keep.s, keep.s); } catch (x) {} } }
  markFocusable(); hideZoom();
  if (modal && modal.kind === 'over' && !modal.shown) { modal.shown = true; countUp(); }
  for (const id of [...IDS, 'hist']) { const e = document.getElementById(id); if (e && (id === 'hist' || stick[id])) e.scrollTop = e.scrollHeight; }
}

// ---------- sự kiện ----------
$app.addEventListener('click', async (e) => {
  if (e.target.closest('[data-stop]') && !e.target.closest('[data-a]')) return;
  const t = e.target.closest('[data-a]'); if (!t) return;
  if (t.classList.contains('ov') && e.target !== t) return;
  const a = t.dataset.a, g = S && S.game;
  try {
    switch (a) {
      case 'create': case 'join': {
        const name = document.getElementById('name').value.trim() || 'Người chơi';
        localStorage.setItem('splendor_name', name);
        const room = (document.getElementById('code').value || '').trim().toUpperCase();
        lobbyErr = '';
        const r = await post(a, a === 'join' ? { name, room } : { name });
        setSess({ room: r.room, token: r.token });
        history.replaceState(null, '', '/');
        break;
      }
      case 'copy': navigator.clipboard && navigator.clipboard.writeText(`${location.origin}/?room=${S.lobby.code}`); showToast('Đã chép link', true); break;
      case 'start': await post('start'); break;
      case 'settings': modal = { kind: 'settings' }; render(); break;
      case 'pref': prefs[t.dataset.k] = t.dataset.v; localStorage.setItem('splendor_prefs', JSON.stringify(prefs)); applyPrefs(); render(); break;
      case 'track': FX.setTrack(t.dataset.id); render(); break;
      case 'showover': modal = { kind: 'over' }; render(); break;
      case 'addbot': await post('addbot', { style: t.dataset.s }); break;
      case 'rmbot': await post('rmbot', { id: t.dataset.id }); break;
      case 'rematch': modal = null; await post('rematch'); break;
      case 'history': modal = { kind: 'history' }; render(); break;
      case 'nudge': await post('nudge'); FX.sfx('click'); showToast('Đã nhắc ' + cur().name, true); break;
      case 'emo': await post('chat', { text: t.dataset.t, emo: true }); break;
      case 'chatsend': { const el = document.getElementById('chatin'); const txt = el.value.trim(); if (!txt) break; el.value = ''; await post('chat', { text: txt }); break; }
      case 'notif': {
        if (notifyOn) { notifyOn = false; localStorage.setItem('splendor_notify', '0'); render(); break; }
        const r = await Notification.requestPermission();
        notifyOn = r === 'granted'; localStorage.setItem('splendor_notify', notifyOn ? '1' : '0');
        showToast(notifyOn ? 'Đã bật thông báo khi đến lượt' : 'Trình duyệt chưa cho phép thông báo', notifyOn); break;
      }
      case 'leave': try { await post('leave'); } catch (x) {} localStorage.removeItem('splendor'); loopId++; sess = null; S = null; render(); break;
      case 'tolobby': await post('lobby'); modal = null; break;
      case 'abort': if (confirm('Hủy ván này và đưa cả phòng về sảnh?')) { await post('lobby'); modal = null; } break;
      case 'quit': {
        if (S.game.phase !== 'over' && !confirm('Thoát khỏi phòng? Máy sẽ chơi thay bạn.')) break;
        try { await post('leave'); } catch (x) {} localStorage.removeItem('splendor'); loopId++; sess = null; S = null; modal = null; render(); break;
      }
      case 'music': FX.setMusic(!FX.state().music); render(); break;
      case 'sfx': FX.setSfx(!FX.state().sfx); FX.sfx('click'); render(); break;
      case 'help': modal = { kind: 'help' }; render(); break;
      case 'closem': modal = null; render(); break;
      case 'closeover': modal = { kind: 'closed', dismissed: true }; render(); break;
      case 'tok': {
        const c = t.dataset.c, k = sel.filter((x) => x === c).length;
        if (!k && g.bank[c] < 1) { showToast('Hết viên ' + VI[c]); break; }
        FX.sfx('tok');
        if (k === 1 && sel.length === 1 && g.bank[c] >= 4) sel = [c, c];
        else if (k) sel = sel.filter((x) => x !== c);
        else if (sel.length === 2 && sel[0] === sel[1]) sel = [c];
        else if (sel.length < 3) sel = [...sel, c];
        render(); break;
      }
      case 'clear': sel = []; render(); break;
      case 'take': await act({ type: 'take', colors: sel }); break;
      case 'pass': await act({ type: 'pass' }); break;
      case 'card': FX.sfx('open'); modal = { kind: 'card', from: t.dataset.from, level: +t.dataset.l, index: +t.dataset.i, id: +t.dataset.id }; render(); break;
      case 'deck': FX.sfx('open'); modal = { kind: 'deck', level: +t.dataset.l }; render(); break;
      case 'doreserve': await act({ type: 'reserve', level: +t.dataset.l, index: +t.dataset.i }); break;
      case 'dobuy': await act(modal.from === 'reserved' ? { type: 'buy', from: 'reserved', id: modal.id } : { type: 'buy', from: 'board', level: modal.level, index: modal.index }); break;
      case 'noble': await act({ type: 'noble', id: +t.dataset.id }); break;
      case 'dplus': { const c = t.dataset.c; if ((disc[c] || 0) < me().tokens[c] && total(disc) < total(me().tokens) - 10) disc[c] = (disc[c] || 0) + 1; render(); break; }
      case 'dminus': { const c = t.dataset.c; if (disc[c]) disc[c]--; render(); break; }
      case 'dodisc': await act({ type: 'discard', tokens: disc }); break;
    }
  } catch (err) { if (!sess || !S) { lobbyErr = err.message; render(); } else showToast(err.message); }
});

$app.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'chatin') { e.preventDefault(); const b = $app.querySelector('[data-a="chatsend"]'); b && b.click(); }
});
$app.addEventListener('input', (e) => {
  if (e.target.id === 'musvol') FX.setVolume('music', e.target.value / 100);
  if (e.target.id === 'sfxvol') FX.setVolume('sfx', e.target.value / 100);
});
$app.addEventListener('change', async (e) => {
  if (e.target.id === 'timer') { try { await post('settings', { timer: +e.target.value }); } catch (x) { showToast(x.message); } }
});
// đồng hồ lượt + nhấp nháy tiêu đề khi ở tab khác
let blink = 0;
setInterval(() => {
  for (const el of document.querySelectorAll('.cd')) {
    const left = Math.max(0, Math.ceil((+el.dataset.dl - (Date.now() + skew)) / 1000));
    el.textContent = '⏳ ' + left + 's'; el.classList.toggle('urgent', left <= 10);
    if (left <= 5 && left > 0 && S && S.game && myTurn()) FX.sfx('tick');
  }
  if (S && S.game && myTurn() && document.hidden) document.title = (blink ^= 1) ? '▶ Đến lượt bạn!' : 'Splendor';
}, 1000);

// ---------- xem trước thẻ khi rê chuột ----------
let zoomT = 0, zoomEl = null;
function hideZoom() { clearTimeout(zoomT); if (zoomEl) { zoomEl.remove(); zoomEl = null; } }
$app.addEventListener('mouseover', (e) => {
  const c = e.target.closest && e.target.closest('.card[data-cid]');
  if (!c || c.closest('.md') || !(S && S.game) || matchMedia('(hover: none)').matches) return;
  if (c === zoomEl) return;
  clearTimeout(zoomT);
  zoomT = setTimeout(() => {
    if (!document.body.contains(c)) return;
    hideZoom();
    const id = +c.dataset.cid, card = CARDS[id], m = me(), r = c.getBoundingClientRect();
    const eff = {}; if (m) for (const k of COLORS) { const v = Math.max(0, (card.cost[k] || 0) - m.bonuses[k]); if (v) eff[k] = v; }
    const pm = m && pay(m, card);
    let need = 0; if (m && !pm) { for (const k of COLORS) need += Math.max(0, (eff[k] || 0) - m.tokens[k]); need = Math.max(0, need - m.tokens.gold); }
    const status = !m ? '' : pm ? '<b class="ok">Bạn đủ đá để mua</b>' : `<b class="no">Còn thiếu ${need} viên</b>`;
    zoomEl = document.createElement('div'); zoomEl.className = 'zoomtip';
    zoomEl.innerHTML = `${cardHtml(id, '', 'nocid zbig')}<div class="zi"><div class="lbl">Giá thực (sau bonus)</div><div class="zc">${COLORS.filter((k) => eff[k]).map((k) => `<div class="cost ${k}">${eff[k]}</div>`).join('') || '<b>Miễn phí</b>'}</div>${status}</div>`;
    document.body.appendChild(zoomEl);
    const w = zoomEl.offsetWidth, h = zoomEl.offsetHeight;
    let x = r.right + 12; if (x + w > innerWidth - 8) x = r.left - w - 12;
    zoomEl.style.left = Math.max(8, x) + 'px'; zoomEl.style.top = Math.max(8, Math.min(innerHeight - h - 8, r.top - 20)) + 'px';
  }, 450);
});
$app.addEventListener('mouseout', (e) => { if (e.target.closest && e.target.closest('.card[data-cid]')) hideZoom(); });
$app.addEventListener('mousedown', hideZoom);

// bàn phím: thẻ, đá quý, nút bấm trong ván có thể chọn bằng Tab + Enter/Space
$app.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.card[data-a], .tok[data-a], .noble[data-a]')) { e.preventDefault(); e.target.click(); }
});
function markFocusable() { $app.querySelectorAll('.card[data-a], .tok[data-a], .noble[data-a]').forEach((el) => { el.tabIndex = 0; el.setAttribute('role', 'button'); }); }

// ---------- màn chờ ----------
function hideSplash() { const sp = document.getElementById('splash'); if (sp) { sp.classList.add('hide'); setTimeout(() => sp.remove(), 700); } }
window.addEventListener('load', () => setTimeout(hideSplash, 450));
setTimeout(hideSplash, 3500);

// ---------- khởi động ----------
probeArt();
if (sess) connect();
render();
