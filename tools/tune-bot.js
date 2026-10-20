'use strict';
// Tự tối ưu hệ số W của bot (bot.js) bằng (1+1)-ES: mỗi vòng đổi ngẫu nhiên 1-3 hệ số,
// cho bản mới đấu bản tốt nhất ~3300 ván (2 người + 4 người); thắng rõ (>52%, kiểm lại >51%) thì giữ.
// Dùng: node tools/tune-bot.js [số vòng=60]   -> kết quả ghi vào tools/tuned.json, chép tay vào W trong bot.js.
const { fork } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'tuned.json');

function games({ A, B, n2, n4 }) {
  const E = require(path.join(ROOT, 'engine.js')), Bot = require(path.join(ROOT, 'bot.js'));
  const play = (ws) => {
    const g = E.newGame(ws.map((_, i) => ({ id: 'p' + i, name: 'x' })));
    let s = 0;
    while (g.phase !== 'over' && s++ < 1000) { const p = g.players[g.turn]; Bot.play(g, p.id, 'balanced', ws[+p.id.slice(1)]); }
    return g.phase === 'over' ? g.winners : [];
  };
  let a2 = 0, a4 = 0;
  for (let i = 0; i < n2; i++) { const w = play([A, B]); if (w.includes('p0')) a2 += 1 / w.length; }
  for (let i = 0; i < n4; i++) { const w = play([A, B, A, B]); for (const x of w) if (x === 'p0' || x === 'p2') a4 += 1 / w.length; }
  return { a2, a4, n2, n4 };
}
if (process.argv[2] === 'child') { process.on('message', (m) => process.send(games(m))); return; }

const P = Math.max(1, os.cpus().length - 1), kids = Array.from({ length: P }, () => fork(__filename, ['child']));
// Tỉ lệ A thắng B: ván 2 người (A vs B) và ván 4 người (A,B,A,B). 0.5 = ngang nhau.
function evalPair(A, B, n2, n4) {
  return new Promise((resolve) => {
    let got = 0; const t = { a2: 0, a4: 0, n2: 0, n4: 0 };
    for (const k of kids) {
      k.once('message', (r) => { for (const x in t) t[x] += r[x]; if (++got === P) resolve({ p2: t.a2 / t.n2, p4: t.a4 / t.n4 }); });
      k.send({ A, B, n2: Math.ceil(n2 / P), n4: Math.ceil(n4 / P) });
    }
  });
}

(async () => {
  const W0 = require(path.join(ROOT, 'bot.js')).W;
  let best = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT)) : { ...W0 };
  const keys = Object.keys(W0), iters = +process.argv[2] || 60;
  let acc = 0;
  for (let it = 0; it < iters; it++) {
    const cand = { ...best };
    for (let j = 1 + Math.floor(Math.random() * 3); j > 0; j--) {
      const k = keys[Math.floor(Math.random() * keys.length)];
      cand[k] = +(best[k] * Math.exp(0.425 * (Math.random() * 2 - 1)) + (Math.random() < 0.1 ? (Math.random() - 0.5) * 0.4 : 0)).toFixed(3);
    }
    const r = await evalPair(cand, best, 2200, 1100);
    let ok = (r.p2 + r.p4) / 2 > 0.52;
    if (ok) { const r2 = await evalPair(cand, best, 4400, 2200); ok = (r2.p2 + r2.p4) / 2 > 0.51; }
    if (ok) { best = cand; acc++; fs.writeFileSync(OUT, JSON.stringify(best, null, 1)); }
    console.log(`vòng ${it} ${ok ? 'GIỮ ' : '    '} 2 người ${(100 * r.p2).toFixed(1)}%  4 người ${(100 * r.p4).toFixed(1)}%`);
  }
  console.log(`giữ ${acc} thay đổi`); console.log(JSON.stringify(best));
  for (const k of kids) k.kill();
})();
