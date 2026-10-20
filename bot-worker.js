'use strict';
// Luồng riêng cho máy "Cao thủ" để việc nghĩ không chặn server (long-poll của người chơi khác).
const { parentPort } = require('worker_threads');
const { think } = require('./mcts');

parentPort.on('message', ({ id, game, me, ms }) => {
  try { parentPort.postMessage({ id, action: think(game, me, ms) }); }
  catch (e) { parentPort.postMessage({ id, error: e.message }); }
});
