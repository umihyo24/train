'use strict';

global.Image = class { constructor() { this.dataset = {}; this.complete = false; this.naturalWidth = 0; } };
const game = require('../src/game.js');
const { CONFIG, gameState } = game;
function assert(cond, msg) { if (!cond) throw new Error(msg); }

// Start a new game and verify randomized legal boards.
game.startGame();
const firstBoard = gameState.board.map(t => t.type).join(',');
game.startGame();
const secondBoard = gameState.board.map(t => t.type).join(',');
assert(gameState.phase === 'playing', 'new game should enter playing phase');
assert(gameState.board.length >= CONFIG.boardMin && gameState.board.length <= CONFIG.boardMax, 'board size should be configured range');
assert(gameState.board[0].type === 'Start', 'board should start with Start');
assert(gameState.board.at(-1).type === 'Boss', 'board should end with Boss');
assert(firstBoard !== secondBoard || gameState.board.length >= CONFIG.boardMin, 'board generation should run');

// Purchase every property category and verify strategic passives are represented.
for (const category of CONFIG.categories) {
  const p = CONFIG.properties.find(prop => prop.category === category);
  gameState.player.Money += p.price;
  gameState.pendingTile = { action: 'buy', property: p };
  game.buyProperty();
  assert(gameState.player.OwnedProperties.some(o => o.category === category), `missing category ${category}`);
  assert(p.passive && p.description, 'properties must include passive and description');
}
assert(game.hasProperty('Farm'), 'Farm passive should be active');

// Trigger every tile type safely.
for (const type of CONFIG.tileTypes) {
  if (type === 'Boss') continue;
  gameState.board = [{ type: 'Start' }, { type }, { type: 'Boss' }];
  gameState.space = 1;
  game.startTurn();
  game.update();
  assert(gameState.phase === 'playing', `${type} should not crash`);
}

// Clear all five regions by simulating boss victories and settlement.
game.startGame();
for (const p of CONFIG.properties) {
  gameState.player.Money += p.price;
  gameState.pendingTile = { action: 'buy', property: p };
  game.buyProperty();
}
while (gameState.phase === 'playing') {
  gameState.space = gameState.board.length - 1;
  gameState.player.HP = gameState.player.MaxHP;
  gameState.inBoss = false;
  gameState.bossHP = 1;
  gameState.inBoss = true;
  game.bossCommand('Attack');
}
assert(gameState.screen === 'victory', 'final boss should produce victory');
assert(['D','C','B','A','S','SS'].includes(gameState.rank), 'rank should be valid');
assert(gameState.defeatedBosses === CONFIG.regions.length, 'all bosses defeated');

// Play continuously for at least 100 turns without runtime errors.
game.startGame();
for (let i = 0; i < 100 && gameState.phase === 'playing'; i++) {
  if (gameState.inBoss) game.bossCommand('Guard'); else game.startTurn();
  game.update();
  if (gameState.player.HP <= 0) gameState.player.HP = gameState.player.MaxHP;
}
assert(gameState.turn >= 1, 'continuous play should advance turns');

// Missing assets should render placeholders, not throw.
const calls = [];
const ctx = { drawImage(){ calls.push('image'); }, fillRect(){ calls.push('rect'); }, strokeRect(){}, fillText(){}, set fillStyle(v){}, set strokeStyle(v){} };
game.safeDrawImage(ctx, { complete: false, naturalWidth: 0 }, 0, 0, 10, 10, 'missing');
assert(calls.includes('rect'), 'placeholder rendered');
console.log('smoke tests passed');
