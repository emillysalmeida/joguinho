/* MEGAMANIA-like — shmup tela fixa, 8-bit, Canvas 2D + WebAudio. Sem dependências. */
(function () {
'use strict';

var W = 240, H = 320;
var canvas = document.getElementById('game');
var ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

var elScore = document.getElementById('score');
var elHi = document.getElementById('hi');
var elLevel = document.getElementById('level');
var elLives = document.getElementById('lives');
var elFuel = document.getElementById('fuel-fill');
var ovTitle = document.getElementById('overlay-title');
var ovMsg = document.getElementById('overlay-msg');
var ovOver = document.getElementById('overlay-over');
var msgTitle = document.getElementById('msg-title');
var msgSub = document.getElementById('msg-sub');
var finalScore = document.getElementById('final-score');

// ---------- AUDIO (sintetizado, sem assets) ----------
var AC = null, masterGain = null, noiseBuf = null;
function ensureAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    AC = new Ctx();
    masterGain = AC.createGain();
    masterGain.gain.value = 0.35;
    masterGain.connect(AC.destination);
    var len = AC.sampleRate * 1;
    noiseBuf = AC.createBuffer(1, len, AC.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { AC = null; }
}
function beep(type, f0, f1, dur, vol) {
  if (!AC) return;
  try {
    var o = AC.createOscillator(), g = AC.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, AC.currentTime);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), AC.currentTime + dur);
    g.gain.setValueAtTime(vol, AC.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + dur);
    o.connect(g); g.connect(masterGain);
    o.start(); o.stop(AC.currentTime + dur + 0.02);
  } catch (e) {}
}
function noiseHit(dur, vol, fFrom, fTo) {
  if (!AC) return;
  try {
    var src = AC.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    var flt = AC.createBiquadFilter(); flt.type = 'lowpass';
    flt.frequency.setValueAtTime(fFrom, AC.currentTime);
    flt.frequency.exponentialRampToValueAtTime(Math.max(40, fTo), AC.currentTime + dur);
    var g = AC.createGain();
    g.gain.setValueAtTime(vol, AC.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + dur);
    src.connect(flt); flt.connect(g); g.connect(masterGain);
    src.start(); src.stop(AC.currentTime + dur + 0.02);
  } catch (e) {}
}
function sfxLaser() { beep('square', 1400 + Math.random() * 200, 280, 0.12, 0.5); }
function sfxEnemy() { beep('sawtooth', 420, 140, 0.16, 0.22); }
function sfxBoom() { noiseHit(0.30, 0.9, 3200, 250); beep('square', 300, 60, 0.22, 0.35); } // crushing
function sfxPlayerDeath() { noiseHit(0.7, 1.0, 2500, 80); beep('sawtooth', 280, 35, 0.6, 0.5); }
function sfxClear() { beep('square', 523, 523, 0.09, 0.4); setTimeout(function(){beep('square',659,659,0.09,0.4);},100); setTimeout(function(){beep('square',784,784,0.16,0.4);},200); }
function sfxLow() { beep('square', 220, 220, 0.07, 0.25); }

// ---------- PIXEL ART ----------
function makeSprite(rows, pal) {
  var w = rows[0].length, h = rows.length;
  var c = document.createElement('canvas'); c.width = w; c.height = h;
  var g = c.getContext('2d');
  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      var ch = rows[y][x];
      if (ch === '.' || ch === ' ') continue;
      g.fillStyle = pal[ch] || '#fff';
      g.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

var SPR = {};
SPR.player = makeSprite([
"................",
".......GG.......",
".......GG.......",
"......GGGG......",
"......GGGG......",
".....GGGGGG.....",
".....GGGGGG.....",
"..C..GGGGGG..C..",
"..CCCGGGGGGCCC..",
".CCCCGGGGGGCCCC.",
"CCCCCCWWWWCCCCCC",
"................"
], { G:'#3DFF5A', C:'#3DEFFF', W:'#FFFFFF' });

SPR.burger = makeSprite([
"................",
".....######.....",
"...##########...",
"..############..",
"..############..",
".##############.",
".##gg######gg##.",
".##############.",
".#YYYYYYYYYYYY#.",
".#BBBBBBBBBBBB#.",
"..############..",
"...##########...",
"................",
"................"
], { '#':'#E8A33D', g:'#3DFF5A', Y:'#FFE93D', B:'#7A3B1A' });

SPR.cookie = makeSprite([
"................",
".....######.....",
"...##########...",
"..############..",
".####D####D####.",
".##############.",
".#####DD#######.",
".##############.",
".###D######D###.",
".##############.",
".#######DD#####.",
"..############..",
"...##########...",
".....######.....",
"................",
"................"
], { '#':'#C98A4A', D:'#3A1C08' });

SPR.iron = makeSprite([
".....HHHH.......",
"......HHHH......",
".......HHHH.....",
".......HHHH.....",
"......IIIIII....",
".....IIIIIIII...",
"....IIIIIIIIII..",
"...IIIIIIIIIIII.",
"..IIIIIIIIIIIIII",
"..SSSSSSSSSSSSSS",
"................",
"................"
], { H:'#5A2B2B', I:'#C0D0E0', S:'#FF6A00' });

SPR.bow = makeSprite([
"................",
"RR............RR",
"RRRR........RRRR",
"RRRRRR....RRRRRR",
"RRRRRRRKKRRRRRRR",
"RRRRRRRKKRRRRRRR",
"RRRRRRRKKRRRRRRR",
"RRRRRR....RRRRRR",
"RRRR........RRRR",
"RR............RR",
"................",
"................"
], { R:'#FF2D78', K:'#FFE93D' });

SPR.diamond = makeSprite([
"................",
".......CC.......",
"......CCCC......",
".....CCCCCC.....",
"....CCCCCCCC....",
"..CCCCCCCCCCCC..",
".CCWWCCCCCCWWCC.",
".CCWWCCCCCCWWCC.",
"..CCCCCCCCCCCC..",
"....CCCCCCCC....",
".....CCCCCC.....",
"......CCCC......",
".......CC.......",
"................"
], { C:'#3DEFFF', W:'#FFFFFF' });

var LEVEL_SPRITES = ['burger', 'cookie', 'iron', 'bow', 'diamond'];
var LEVEL_NAMES = ['HAMBÚRGUERES', 'BOLACHAS', 'FERROS', 'GRAVATAS', 'DIAMANTES'];
var LEVEL_SCORE = [100, 150, 200, 250, 300];

// ---------- ESTADO ----------
var G = {
  screen: 'title', // title | playing | over
  msgTimer: 0,
  dying: 0,
  invincible: 0,
  time: 0,
  score: 0,
  hi: 0,
  lives: 3,
  level: 1,
  energy: 100,
  shake: 0,
  lowWarned: false
};
try { G.hi = parseInt(localStorage.getItem('megamania_hi') || '0', 10) || 0; } catch (e) {}

var player = { x: W / 2, y: H - 32, w: 16, h: 12, speed: 175, cool: 0 };
var bullets = [];   // player
for (var i = 0; i < 8; i++) bullets.push({ active: false, x: 0, y: 0, w: 2, h: 8 });
var ebullet = { active: false, x: 0, y: 0, w: 3, h: 7, vy: 100 };
var eshootCool = 1.2;
var enemies = [];
var formation = { t: 0, x: 0, y: 0, amp: 26, freq: 0.9, descend: 7 };
var particles = [];
for (var p = 0; p < 80; p++) particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, color: '#fff' });

// ---------- INPUT ----------
var keys = { left: false, right: false, fire: false };
var touch = { left: false, right: false, fire: false, dragX: null, dragging: false };

function canvasX(clientX) {
  var r = canvas.getBoundingClientRect();
  return (clientX - r.left) / r.width * W;
}
window.addEventListener('keydown', function (e) {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
  if (e.code === 'Space' || e.code === 'KeyJ') { keys.fire = true; e.preventDefault(); }
  if (e.code === 'Enter') {
    if (G.screen === 'title' || G.screen === 'over') startGame();
  }
  if (e.code === 'KeyP' && G.screen === 'playing') togglePause();
});
window.addEventListener('keyup', function (e) {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
  if (e.code === 'Space' || e.code === 'KeyJ') keys.fire = false;
});

canvas.addEventListener('pointerdown', function (e) {
  ensureAudio();
  touch.dragging = true;
  touch.dragX = canvasX(e.clientX);
  touch.fire = true;
  canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
  if (G.screen === 'title' || G.screen === 'over') startGame();
});
canvas.addEventListener('pointermove', function (e) {
  if (touch.dragging) touch.dragX = canvasX(e.clientX);
});
window.addEventListener('pointerup', function () { touch.dragging = false; touch.dragX = null; touch.fire = false; });
canvas.addEventListener('touchstart', function (e) { e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });

function bindHold(id, prop) {
  var el = document.getElementById(id);
  var on = function (e) { e.preventDefault(); ensureAudio(); touch[prop] = true; };
  var off = function (e) { e.preventDefault(); touch[prop] = false; };
  el.addEventListener('pointerdown', on);
  el.addEventListener('pointerup', off);
  el.addEventListener('pointerleave', off);
  el.addEventListener('pointercancel', off);
}
bindHold('t-left', 'left'); bindHold('t-right', 'right'); bindHold('t-fire', 'fire');

document.getElementById('btn-start').addEventListener('click', function () { ensureAudio(); startGame(); });
document.getElementById('btn-restart').addEventListener('click', function () { ensureAudio(); startGame(); });

var paused = false;
function togglePause() { paused = !paused; }
document.addEventListener('visibilitychange', function () { if (document.hidden) paused = true; else paused = false; });

// ---------- FASES / ONDAS ----------
function spriteForLevel(lv) { return LEVEL_SPRITES[(lv - 1) % LEVEL_SPRITES.length]; }
function nameForLevel(lv) {
  var base = LEVEL_NAMES[(lv - 1) % LEVEL_NAMES.length];
  var loop = Math.floor((lv - 1) / LEVEL_NAMES.length);
  return loop > 0 ? base + ' +' + loop : base;
}
function scoreForLevel(lv) { return LEVEL_SCORE[(lv - 1) % LEVEL_SCORE.length] + Math.floor((lv - 1) / LEVEL_SCORE.length) * 200; }

function startGame() {
  G.screen = 'playing'; G.score = 0; G.lives = 3; G.level = 1;
  G.energy = 100; G.dying = 0; G.invincible = 0; G.time = 0; G.shake = 0;
  player.x = W / 2; player.cool = 0;
  clearBullets();
  ovTitle.classList.add('hidden'); ovOver.classList.add('hidden');
  startLevel(1);
  updateHUD();
}
function clearBullets() {
  for (var i = 0; i < bullets.length; i++) bullets[i].active = false;
  ebullet.active = false;
}
function startLevel(lv) {
  G.level = lv;
  G.energy = 100; // renova a cada fase (requisito)
  G.lowWarned = false;
  enemies.length = 0;
  formation.t = 0; formation.y = 0;
  var speedMul = 1 + (lv - 1) * 0.14;
  formation.descend = 6 * speedMul + 2;
  formation.freq = 0.85 + (lv - 1) * 0.12;
  formation.amp = 24 + Math.min(14, (lv - 1) * 2);
  eshootCool = 1.4;

  var cols = lv === 1 ? 6 : (lv < 4 ? 7 : 8);
  var rows = lv === 1 ? 2 : (lv < 3 ? 2 : 3);
  var sx = 30, sy = 22, ox = W / 2 - (cols - 1) * sx / 2, oy = 46;
  var spr = spriteForLevel(lv);
  for (var r = 0; r < rows; r++) {
    for (var c = 0; c < cols; c++) {
      enemies.push({
        alive: true, spr: spr,
        bx: ox + c * sx, by: oy + r * sy,
        x: ox + c * sx, y: oy + r * sy,
        w: 16, h: 12, phase: (c * 0.7 + r * 1.3)
      });
    }
  }
  ebullet.active = false;
  clearPlayerBulletsOnly();
  showMsg('FASE ' + lv, nameForLevel(lv) + ' • ' + scoreForLevel(lv) + ' PTS');
  G.invincible = Math.max(G.invincible, 1.0);
}
function clearPlayerBulletsOnly() { for (var i = 0; i < bullets.length; i++) bullets[i].active = false; }

var msgTimeout = null;
function showMsg(t, s) {
  msgTitle.textContent = t; msgSub.textContent = s;
  ovMsg.classList.remove('hidden');
  G.msgTimer = 1.7;
  if (msgTimeout) clearTimeout(msgTimeout);
  msgTimeout = setTimeout(function () { ovMsg.classList.add('hidden'); }, 1700);
}
function gameOver() {
  G.screen = 'over';
  finalScore.textContent = G.score;
  ovOver.classList.remove('hidden');
  try {
    if (G.score > G.hi) { G.hi = G.score; localStorage.setItem('megamania_hi', String(G.hi)); }
  } catch (e) {}
}
function explode(x, y, color, n, spd) {
  var c = 0;
  for (var i = 0; i < particles.length && c < n; i++) {
    if (particles[i].active) continue;
    var a = Math.random() * Math.PI * 2, s = (0.3 + Math.random() * 0.7) * spd;
    particles[i].active = true;
    particles[i].x = x; particles[i].y = y;
    particles[i].vx = Math.cos(a) * s; particles[i].vy = Math.sin(a) * s - 20;
    particles[i].life = particles[i].max = 0.4 + Math.random() * 0.4;
    particles[i].color = color;
    c++;
  }
}

// ---------- UPDATE ----------
function aliveCount() { var n = 0; for (var i = 0; i < enemies.length; i++) if (enemies[i].alive) n++; return n; }

function firePlayer() {
  for (var i = 0; i < bullets.length; i++) {
    if (!bullets[i].active) {
      bullets[i].active = true;
      bullets[i].x = player.x; bullets[i].y = player.y - 10;
      sfxLaser();
      return;
    }
  }
}

function update(dt) {
  G.time += dt;
  if (G.msgTimer > 0) G.msgTimer -= dt;
  if (G.invincible > 0) G.invincible -= dt;
  if (G.shake > 0) G.shake -= dt;

  // partículas sempre
  for (var i = 0; i < particles.length; i++) {
    if (!particles[i].active) continue;
    particles[i].life -= dt;
    if (particles[i].life <= 0) { particles[i].active = false; continue; }
    particles[i].x += particles[i].vx * dt;
    particles[i].y += particles[i].vy * dt;
    particles[i].vy += 160 * dt;
  }

  if (G.screen !== 'playing' || G.msgTimer > 0) {
    // congela ação durante cartaz de fase, mas mantém partículas
    updateBulletsOnly(dt);
    return;
  }

  if (G.dying > 0) {
    G.dying -= dt;
    updateBulletsOnly(dt);
    if (G.dying <= 0) {
      if (G.lives <= 0) gameOver();
      else { G.invincible = 2.0; G.energy = 100; ebullet.active = false; }
    }
    return;
  }

  // --- energia drena sempre ---
  G.energy -= 4.2 * dt;
  if (G.energy < 25 && !G.lowWarned) { G.lowWarned = true; }
  if (G.energy <= 25 && Math.floor(G.time * 4) % 8 === 0) { /* pisca via HUD */ }
  if (G.energy <= 0) {
    G.energy = 0;
    killPlayer(true); // sem explosão inimiga, só perda
    return;
  }

  // --- movimento player ---
  var dir = 0;
  if (keys.left || touch.left) dir -= 1;
  if (keys.right || touch.right) dir += 1;
  if (dir !== 0) {
    player.x += dir * player.speed * dt;
    touch.dragX = null;
  } else if (touch.dragX !== null) {
    // arrasto fluido: persegue o dedo
    var dx = touch.dragX - player.x;
    player.x += dx * Math.min(1, dt * 14);
    if (Math.abs(dx) < 0.6) player.x = touch.dragX;
  }
  if (player.x < 12) player.x = 12;
  if (player.x > W - 12) player.x = W - 12;

  // --- tiro ---
  player.cool -= dt;
  var wantFire = keys.fire || touch.fire || touch.dragging;
  if (wantFire && player.cool <= 0) { firePlayer(); player.cool = 0.20; }

  // --- formação inimiga: zigue-zague + descida lenta ---
  formation.t += dt;
  formation.x = Math.sin(formation.t * formation.freq * 2) * formation.amp;
  formation.y += formation.descend * dt;
  var maxY = 200;
  if (formation.y > 90) formation.y = 90 + Math.sin(formation.t * 0.7) * 8; // segura no meio após descer
  for (var e = 0; e < enemies.length; e++) {
    var en = enemies[e];
    if (!en.alive) continue;
    en.x = en.bx + formation.x + Math.sin(formation.t * 3 + en.phase) * 4;
    en.y = en.by + formation.y;
    if (en.x < 10) en.x = 10;
    if (en.x > W - 10) en.x = W - 10;
  }

  // --- tiro inimigo: UM de cada vez ---
  eshootCool -= dt;
  if (!ebullet.active && eshootCool <= 0) {
    var cands = [];
    for (var k = 0; k < enemies.length; k++) if (enemies[k].alive) cands.push(enemies[k]);
    if (cands.length) {
      // prefere os mais baixos
      cands.sort(function (a, b) { return b.y - a.y; });
      var pick = cands[Math.floor(Math.random() * Math.min(3, cands.length))];
      ebullet.active = true; ebullet.x = pick.x; ebullet.y = pick.y + 8;
      ebullet.vy = 85 + G.level * 9;
      sfxEnemy();
    }
    eshootCool = 0.9 + Math.random() * 1.1 - Math.min(0.5, G.level * 0.06);
  }

  updateBulletsOnly(dt);
  checkCollisions();

  // --- onda completa destruída ---
  if (aliveCount() === 0 && G.dying <= 0) {
    G.energy = Math.min(100, G.energy + 32); // recupera (requisito)
    G.score += 500 * G.level;
    sfxClear();
    updateHUD();
    var nl = G.level + 1;
    G.msgTimer = 1.7;
    showMsg('FASE ' + nl, nameForLevel(nl) + ' • ' + scoreForLevel(nl) + ' PTS');
    // prepara próxima após o cartaz
    setTimeout(function () { if (G.screen === 'playing') startLevel(nl); }, 1750);
    G.energy = Math.min(100, G.energy + 20);
    // trava update até trocar (evita duplo trigger)
    for (var j = 0; j < enemies.length; j++) enemies[j].alive = false;
    enemies.push({ alive: false, _wait: true, x: -99, y: -99, w: 0, h: 0, bx: -99, by: -99, phase: 0, spr: 'burger' });
  }

  updateHUD();
}

function updateBulletsOnly(dt) {
  for (var i = 0; i < bullets.length; i++) {
    if (!bullets[i].active) continue;
    bullets[i].y -= 380 * dt; // projétil rápido (requisito)
    if (bullets[i].y < -12) bullets[i].active = false;
  }
  if (ebullet.active) {
    ebullet.y += ebullet.vy * dt;
    if (ebullet.y > H + 12) { ebullet.active = false; }
    // contato do tiro inimigo com player é checado em checkCollisions
  }
}

function overlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax - aw / 2 < bx + bw / 2 && ax + aw / 2 > bx - bw / 2 &&
         ay - ah / 2 < by + bh / 2 && ay + ah / 2 > by - bh / 2;
}

function checkCollisions() {
  var shrink = 0.72; // hitbox precisa estilo arcade
  // tiro player x inimigo
  for (var i = 0; i < bullets.length; i++) {
    if (!bullets[i].active) continue;
    for (var e = 0; e < enemies.length; e++) {
      var en = enemies[e];
      if (!en.alive || en._wait) continue;
      if (overlap(bullets[i].x, bullets[i].y, bullets[i].w, bullets[i].h, en.x, en.y, en.w * shrink, en.h * shrink)) {
        bullets[i].active = false;
        en.alive = false;
        G.score += scoreForLevel(G.level);
        sfxBoom();
        explode(en.x, en.y, '#FFE93D', 10, 90);
        explode(en.x, en.y, '#FF2D78', 6, 60);
        break;
      }
    }
  }
  if (G.invincible > 0 || G.dying > 0) return;
  var pw = player.w * 0.7, ph = player.h * 0.7;
  // tiro inimigo x player
  if (ebullet.active && overlap(ebullet.x, ebullet.y, ebullet.w, ebullet.h, player.x, player.y, pw, ph)) {
    ebullet.active = false;
    killPlayer(false);
    return;
  }
  // contato direto destrói a nave (requisito)
  for (var k = 0; k < enemies.length; k++) {
    var en2 = enemies[k];
    if (!en2.alive || en2._wait) continue;
    if (overlap(player.x, player.y, pw, ph, en2.x, en2.y, en2.w * shrink, en2.h * shrink)) {
      en2.alive = false;
      killPlayer(false);
      return;
    }
  }
}

function killPlayer(byEnergy) {
  if (G.dying > 0) return;
  G.lives -= 1;
  G.dying = 1.4;
  G.shake = 0.4;
  sfxPlayerDeath();
  explode(player.x, player.y, '#3DFF5A', 18, 120);
  explode(player.x, player.y, '#FFFFFF', 10, 90);
  ebullet.active = false;
  if (!byEnergy) { /* morte por tiro/contato */ }
  updateHUD();
}

// ---------- RENDER ----------
function draw() {
  ctx.save();
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  if (G.shake > 0) {
    ctx.translate((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4);
  }

  // inimigos
  for (var e = 0; e < enemies.length; e++) {
    var en = enemies[e];
    if (!en.alive || en._wait) continue;
    var spr = SPR[en.spr] || SPR.burger;
    ctx.drawImage(spr, Math.round(en.x - 8), Math.round(en.y - 6));
  }

  // tiro inimigo
  if (ebullet.active) {
    ctx.fillStyle = '#FF2D78';
    ctx.fillRect(Math.round(ebullet.x - 1), Math.round(ebullet.y - 3), 3, 7);
    ctx.fillStyle = '#fff';
    ctx.fillRect(Math.round(ebullet.x), Math.round(ebullet.y - 2), 1, 3);
  }

  // tiros player (rápidos, vibrantes)
  for (var i = 0; i < bullets.length; i++) {
    if (!bullets[i].active) continue;
    ctx.fillStyle = '#fff';
    ctx.fillRect(Math.round(bullets[i].x - 1), Math.round(bullets[i].y - 4), 2, 8);
    ctx.fillStyle = '#3DEFFF';
    ctx.fillRect(Math.round(bullets[i].x - 1), Math.round(bullets[i].y - 4), 2, 2);
  }

  // player (pisca se invencível)
  if (G.screen === 'playing' && G.dying <= 0) {
    if (G.invincible <= 0 || Math.floor(G.time * 12) % 2 === 0) {
      ctx.drawImage(SPR.player, Math.round(player.x - 8), Math.round(player.y - 6));
      // chama do motor
      ctx.fillStyle = '#FF6A00';
      var f = Math.floor(G.time * 20) % 2;
      ctx.fillRect(Math.round(player.x - 1), Math.round(player.y + 6), 2, 2 + f * 2);
    }
  }

  // partículas
  for (var p = 0; p < particles.length; p++) {
    if (!particles[p].active) continue;
    ctx.globalAlpha = Math.max(0, particles[p].life / particles[p].max);
    ctx.fillStyle = particles[p].color;
    ctx.fillRect(Math.round(particles[p].x), Math.round(particles[p].y), 2, 2);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function updateHUD() {
  elScore.textContent = String(G.score).padStart(6, '0');
  elHi.textContent = String(Math.max(G.hi, G.score)).padStart(6, '0');
  elLevel.textContent = G.level;
  elLives.textContent = Math.max(0, G.lives);
  var pct = Math.max(0, Math.min(100, G.energy));
  elFuel.style.width = pct + '%';
  elFuel.style.background = pct > 50 ? '#3DFF5A' : (pct > 25 ? '#FFE93D' : '#FF2D78');
}

// ---------- LOOP fixo ----------
var last = performance.now(), acc = 0, STEP = 1000 / 60;
function frame(now) {
  requestAnimationFrame(frame);
  if (paused) { last = now; return; }
  var delta = now - last; last = now;
  if (delta > 250) delta = 250;
  acc += delta;
  var n = 0;
  while (acc >= STEP && n < 5) { update(STEP / 1000); acc -= STEP; n++; }
  if (n === 5) acc = 0;
  draw();
  // HUD da energia a cada frame p/ suavidade
  if (G.screen === 'playing') {
    var pct = Math.max(0, Math.min(100, G.energy));
    elFuel.style.width = pct + '%';
  }
}
elScore.textContent = '000000';
elHi.textContent = String(G.hi).padStart(6, '0');
updateHUD();
requestAnimationFrame(frame);
})();
