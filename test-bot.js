const E = require('./engine'), B = require('./bot');
const styles = ['balanced', 'noble', 'rush', 'balanced'];
const wins = {}; let games = 0, over = 0, turns = 0, bad = 0;
for (let n = 0; n < 200; n++) {
  const np = 2 + (n % 3);
  const ps = Array.from({ length: np }, (_, i) => ({ id: 'p' + i, name: styles[i] + i }));
  const g = E.newGame(ps); let t = 0;
  while (g.phase !== 'over' && t++ < 600) {
    const p = g.players[g.turn], st = styles[+p.id.slice(1)];
    try { B.play(g, p.id, st); } catch (e) { bad++; break; }
  }
  games++; turns += g.round; if (g.phase === 'over') { over++; for (const w of g.winners) { const s = styles[+w.slice(1)]; wins[s] = (wins[s] || 0) + 1; } }
}
console.log({ games, over, bad, avgRounds: (turns / games).toFixed(1), wins });
