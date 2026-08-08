import './style.css';

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const startScreen = document.querySelector('#startScreen');
const gameScreen = document.querySelector('#gameScreen');
const resultScreen = document.querySelector('#resultScreen');
const leftName = document.querySelector('#leftName');
const leftScore = document.querySelector('#leftScore');
const rightScore = document.querySelector('#rightScore');
const timerEl = document.querySelector('#timer');
const soundButton = document.querySelector('#soundButton');
const musicSelect = document.querySelector('#musicSelect');
let playerSheet, rivalSheet, playerActionSheet, rivalActionSheet, ballSkin;
const keys = { left: false, right: false, jump: false, kick: false, head: false, slide: false, feint: false, chest: false };
const W = 1280, H = 720, ground = 668;
const PLAYER_SIZE = 220, PLAYER_DRAW_WIDTH = 220, PLAYER_HEAD_Y = 47;
const BALL_RADIUS = 20, BALL_DRAW_SIZE = 52;
let selected = 'bernardo', selectedBall = 'telstar', selectedEnvironment = 'torreon', running = false, last = 0, timeLeft = 90, score = [0, 0], kickoff = 0, goalMoment = null;
let player, cpu, ball;
let audioContext, soundEnabled = false, lastBounceSound = 0, lastFrameSound = 0;
let youtubePlayer, youtubeApiReady = false, pendingMusicStart = false;
// Los postes quedan al borde: la cancha útil gana amplitud sin perder el volumen de la red.
const goal = { leftLine: 56, rightLine: 1224, top: 332, bottom: 668, depth: 56 };
const torreonBackground = new Image();
torreonBackground.src = '/assets/background-torreon-valdivia-v2.png';
const hospitalBackground = new Image();
hospitalBackground.src = '/assets/background-hospital-valdivia.png';
const costaneraBackground = new Image();
costaneraBackground.src = '/assets/background-costanera-lobos-marinos-valdivia.png';
const plazaBackground = new Image();
plazaBackground.src = '/assets/background-plaza-valdivia.png';
const jardinBackground = new Image();
jardinBackground.src = '/assets/background-jardin-botanico-valdivia.png';
const coliseoBackground = new Image();
coliseoBackground.src = '/assets/background-coliseo-valdivia.png';

const characterData = {
  bernardo: { name: 'BERNARDO', sheet: '/assets/capitan-sprites-v2.png', actionSheet: '/assets/bernardo-action-sprites-v1.png', artFacing: 1 },
  patito: { name: 'PATITO', sheet: '/assets/jefe-sprites-v2.png', actionSheet: '/assets/patito-action-sprites-v1.png', artFacing: -1 },
  'patito-classic': { name: 'PATITO CLASSIC', sheet: '/assets/patito-classic-sprites-v2.png', actionSheet: '/assets/patito-classic-action-sprites-v1.png', artFacing: -1 },
  'carlitos-run': { name: 'CARLITOS RUN', sheet: '/assets/carlitos-run-sprites-v1.png', actionSheet: '/assets/carlitos-run-action-sprites-v1.png', artFacing: 1 }
};
const ballSkins = {
  cuero: '/assets/balls/cuero.png', telstar: '/assets/balls/telstar.png', tango: '/assets/balls/tango.png', azteca: '/assets/balls/azteca.png',
  tricolore: '/assets/balls/tricolore.png', fever: '/assets/balls/fever.png', teamgeist: '/assets/balls/teamgeist.png', jabulani: '/assets/balls/jabulani.png',
  alrihla: '/assets/balls/alrihla.png', trionda: '/assets/balls/trionda.png'
};

function loadYoutubeApi() {
  if (window.YT || document.querySelector('script[data-youtube-api]')) return;
  const script = document.createElement('script');
  script.src = 'https://www.youtube.com/iframe_api'; script.async = true; script.dataset.youtubeApi = 'true';
  document.head.appendChild(script);
}
function createYoutubePlayer() {
  const videoId = musicSelect.value;
  if (!youtubeApiReady || videoId === 'none') return;
  if (youtubePlayer) { youtubePlayer.cueVideoById(videoId); return; }
  youtubePlayer = new window.YT.Player('youtubePlayer', {
    width: 200, height: 200, videoId,
    playerVars: { autoplay: 0, controls: 0, playsinline: 1, rel: 0, modestbranding: 1 },
    events: { onReady: event => { event.target.setVolume(32); event.target.cueVideoById(musicSelect.value); if (pendingMusicStart) startMusic(); } }
  });
}
function startMusic() {
  const videoId = musicSelect.value;
  if (videoId === 'none') return stopMusic();
  pendingMusicStart = true;
  if (!youtubeApiReady) { loadYoutubeApi(); return; }
  if (!youtubePlayer) { createYoutubePlayer(); return; }
  youtubePlayer.loadVideoById(videoId); youtubePlayer.setVolume(32); youtubePlayer.playVideo(); pendingMusicStart = false;
}
function stopMusic() { pendingMusicStart = false; if (youtubePlayer?.pauseVideo) youtubePlayer.pauseVideo(); }
window.onYouTubeIframeAPIReady = () => { youtubeApiReady = true; createYoutubePlayer(); };
loadYoutubeApi();

function audio() {
  if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === 'suspended') audioContext.resume();
  return audioContext;
}
function tone(frequency, duration, options = {}) {
  if (!soundEnabled) return;
  const ac = audio(), now = ac.currentTime;
  const osc = ac.createOscillator(), gain = ac.createGain();
  osc.type = options.type || 'square'; osc.frequency.setValueAtTime(frequency, now);
  if (options.end) osc.frequency.exponentialRampToValueAtTime(Math.max(25, options.end), now + duration);
  gain.gain.setValueAtTime(options.volume ?? .045, now);
  gain.gain.exponentialRampToValueAtTime(.001, now + duration);
  osc.connect(gain).connect(ac.destination); osc.start(now); osc.stop(now + duration);
}
function noise(duration = .06, volume = .035, filter = 900) {
  if (!soundEnabled) return;
  const ac = audio(), data = ac.createBuffer(1, Math.max(1, ac.sampleRate * duration), ac.sampleRate);
  const channel = data.getChannelData(0); for (let i = 0; i < channel.length; i++) channel[i] = Math.random() * 2 - 1;
  const source = ac.createBufferSource(), band = ac.createBiquadFilter(), gain = ac.createGain();
  band.type = 'bandpass'; band.frequency.value = filter; gain.gain.setValueAtTime(volume, ac.currentTime); gain.gain.exponentialRampToValueAtTime(.001, ac.currentTime + duration);
  source.buffer = data; source.connect(band).connect(gain).connect(ac.destination); source.start(); source.stop(ac.currentTime + duration);
}
function sfx(name) {
  if (!soundEnabled) return;
  if (name === 'kick') { tone(150, .09, { end: 78, volume: .065, type: 'sawtooth' }); noise(.045, .025, 300); }
  if (name === 'head') { tone(250, .075, { end: 155, volume: .055, type: 'triangle' }); noise(.035, .018, 650); }
  if (name === 'bounce') { tone(105, .08, { end: 65, volume: .04, type: 'sine' }); }
  if (name === 'frame') { tone(730, .11, { end: 430, volume: .055, type: 'square' }); tone(1080, .07, { end: 780, volume: .025, type: 'sine' }); }
  if (name === 'slide') { noise(.11, .04, 360); tone(88, .12, { end: 50, volume: .035, type: 'sawtooth' }); }
  if (name === 'hit') { tone(98, .1, { end: 54, volume: .06, type: 'sawtooth' }); noise(.055, .025, 420); }
  if (name === 'goal') { [392, 494, 587, 784].forEach((f, i) => setTimeout(() => tone(f, .32, { end: f * 1.12, volume: .06, type: 'triangle' }), i * 82)); }
  if (name === 'whistle') { tone(1420, .14, { end: 1880, volume: .05, type: 'sine' }); }
}

function resetPositions() {
  const playerData = characterData[selected];
  const rivalData = selected === 'bernardo' ? characterData.patito : characterData.bernardo;
  player = createPlayer(245, 1, playerData.artFacing);
  cpu = createPlayer(1035, -1, rivalData.artFacing);
  ball = { x: W / 2, y: 360, vx: 0, vy: 0, r: BALL_RADIUS, spin: 0, trail: [] };
  kickoff = 1.1;
}

function createPlayer(x, dir, artFacing) {
  return { x, y: ground - 112, vx: 0, vy: 0, dir, kick: 0, head: 0, headContact: 0, stun: 0, hit: 0, phase: 0, landing: 0, artFacing, celebrate: false, defeat: false, slide: 0, feint: 0, chest: 0, aerial: 0, fall: 0, recover: 0, actionCooldown: 0 };
}

function chromaSprite(source) {
  const image = new Image();
  image.src = source;
  return new Promise(resolve => {
    image.onload = () => {
      const surface = document.createElement('canvas');
      surface.width = image.naturalWidth; surface.height = image.naturalHeight;
      const painter = surface.getContext('2d', { willReadFrequently: true });
      painter.drawImage(image, 0, 0);
      const pixels = painter.getImageData(0, 0, surface.width, surface.height);
      for (let i = 0; i < pixels.data.length; i += 4) {
        const r = pixels.data[i], g = pixels.data[i + 1], b = pixels.data[i + 2];
        if (g > 130 && g > r * 1.28 && g > b * 1.25) pixels.data[i + 3] = 0;
      }
      painter.putImageData(pixels, 0, 0); resolve(surface);
    };
  });
}

async function prepareSelectionImages() {
  const images = [...document.querySelectorAll('img[data-chroma]')];
  await Promise.all(images.map(async image => {
    const cleaned = await chromaSprite(image.src);
    image.src = cleaned.toDataURL('image/png');
  }));
}

async function startGame() {
  if (soundEnabled) audio();
  const data = characterData[selected];
  const rivalData = selected === 'bernardo' ? characterData.patito : characterData.bernardo;
  [playerSheet, rivalSheet, playerActionSheet, rivalActionSheet, ballSkin] = await Promise.all([
    chromaSprite(data.sheet), chromaSprite(rivalData.sheet), chromaSprite(data.actionSheet), chromaSprite(rivalData.actionSheet), chromaSprite(ballSkins[selectedBall])
  ]);
  leftName.textContent = data.name;
  score = [0, 0]; timeLeft = 90; last = performance.now(); running = true;
  startScreen.classList.add('hidden'); resultScreen.classList.add('hidden'); gameScreen.classList.remove('hidden');
  resetPositions(); startMusic(); sfx('whistle'); requestAnimationFrame(loop);
}

function addGoal(who) {
  score[who]++; leftScore.textContent = score[0]; rightScore.textContent = score[1];
  const winner = who === 0 ? player : cpu, loser = who === 0 ? cpu : player;
  winner.celebrate = true; loser.defeat = true;
  goalMoment = { who, time: 1.65 };
  sfx('goal');
}

function update(dt) {
  if (goalMoment) {
    goalMoment.time -= dt;
    if (goalMoment.time <= 0) { goalMoment = null; resetPositions(); }
    return;
  }
  if (kickoff > 0) { kickoff -= dt; return; }
  timeLeft = Math.max(0, timeLeft - dt);
  const secs = Math.ceil(timeLeft); timerEl.textContent = `0${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  if (!timeLeft) return finish();
  controlPlayer(dt); controlCpu(dt); physics(player, dt); physics(cpu, dt); ballPhysics(dt);
}

function physics(p, dt) {
  const wasStunned = p.stun > 0;
  p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 1750 * dt;
  if (p.y > ground - 112) { if (p.vy > 240) p.landing = 1; p.y = ground - 112; p.vy = 0; }
  p.x = Math.max(90, Math.min(W - 90, p.x)); p.kick = Math.max(0, p.kick - dt); p.head = Math.max(0, p.head - dt); p.headContact = Math.max(0, p.headContact - dt); p.stun = Math.max(0, p.stun - dt); p.hit = Math.max(0, p.hit - dt); p.slide = Math.max(0, p.slide - dt); p.feint = Math.max(0, p.feint - dt); p.chest = Math.max(0, p.chest - dt); p.aerial = Math.max(0, p.aerial - dt); p.fall = Math.max(0, p.fall - dt); p.actionCooldown = Math.max(0, p.actionCooldown - dt);
  if (wasStunned && p.stun === 0) p.recover = .26;
  p.recover = Math.max(0, p.recover - dt);
  if (p.stun > 0) p.vx *= Math.pow(.006, dt);
  p.phase += Math.abs(p.vx) * dt / 58; p.landing = Math.max(0, p.landing - dt * 5);
}
function controlPlayer(dt) {
  if (player.stun > 0 || player.slide > 0 || player.feint > 0) return;
  const speed = 450;
  if (keys.left) { player.vx = -speed; player.dir = -1; } else if (keys.right) { player.vx = speed; player.dir = 1; } else player.vx *= Math.pow(.001, dt);
  if (keys.jump && player.y >= ground - 113) player.vy = -710;
  if (keys.slide && player.actionCooldown <= 0) slideTackle(player);
  if (keys.feint && player.actionCooldown <= 0) feint(player);
  if (keys.chest && player.actionCooldown <= 0) chestControl(player);
  if (keys.kick && player.kick <= 0) kick(player, 1.15);
  if (keys.head && player.head <= 0) headBall(player, 1.18);
}
function controlCpu(dt) {
  if (cpu.stun > 0 || cpu.slide > 0 || cpu.feint > 0) return;
  const dx = ball.x - cpu.x; cpu.dir = dx > 0 ? 1 : -1;
  cpu.vx = Math.abs(dx) > 44 ? Math.sign(dx) * 280 : 0;
  if (ball.y < 360 && cpu.y >= ground - 113 && Math.random() < .025) cpu.vy = -660;
  if (ball.y > cpu.y - 8 && ball.y < cpu.y + 68 && Math.abs(dx) < 70 && cpu.actionCooldown <= 0 && Math.random() < .05) chestControl(cpu);
  if (Math.abs(dx) < 105 && Math.abs(ball.y - (cpu.y + 64)) < 50 && cpu.actionCooldown <= 0 && Math.random() < .012) slideTackle(cpu);
  if (Math.abs(dx) < 135 && Math.abs(ball.y - (cpu.y + 62)) < 100 && cpu.kick <= 0) kick(cpu, .95);
  if (ball.y < cpu.y + 92 && ball.y > cpu.y - 18 && Math.abs(dx) < 82 && cpu.head <= 0) headBall(cpu, .9);
}
function kick(p, power) {
  p.kick = .24;
  const airborne = p.y < ground - 136;
  const ballHigh = ball.y < p.y + 55;
  if (airborne && ballHigh) p.aerial = .34;
  const dx = ball.x - (p.x + p.dir * 44), dy = ball.y - (p.y + 58);
  if (Math.abs(dx) < 125 && Math.abs(dy) < 105) {
    ball.vx = p.dir * ((airborne ? 880 : 760) * power) + p.vx * .3;
    ball.vy = (airborne ? -510 : -360) * power + dy * 2; ball.trail.push({ x: ball.x, y: ball.y, life: .35 });
    sfx('kick');
  }
  const opponent = p === player ? cpu : player;
  const reach = opponent.x - (p.x + p.dir * 56);
  const height = opponent.y - p.y;
  if (Math.abs(reach) < 108 && Math.abs(height) < 92 && opponent.stun <= 0) {
    opponent.vx = p.dir * (590 * power); opponent.vy = -315; opponent.stun = .48; opponent.fall = .5; opponent.hit = .32; sfx('hit');
    ball.trail.push({ x: opponent.x, y: opponent.y + 54, life: .22, hit: true });
  }
}
function slideTackle(p) {
  if (p.y < ground - 114) return;
  p.slide = .42; p.actionCooldown = .58; p.vx = p.dir * 690;
  sfx('slide');
  const opponent = p === player ? cpu : player;
  const reach = opponent.x - (p.x + p.dir * 72);
  if (Math.abs(reach) < 125 && Math.abs(opponent.y - p.y) < 75 && opponent.stun <= 0) {
    opponent.vx = p.dir * 510; opponent.vy = -245; opponent.stun = .42; opponent.fall = .46; opponent.hit = .3; sfx('hit');
  }
  const dx = ball.x - (p.x + p.dir * 68), dy = ball.y - (p.y + 82);
  if (Math.abs(dx) < 118 && Math.abs(dy) < 65) {
    ball.vx = p.dir * 640 + p.vx * .35; ball.vy = -105 + dy * 1.5;
    ball.trail.push({ x: ball.x, y: ball.y, life: .25, hit: true });
  }
}
function feint(p) {
  p.feint = .17; p.actionCooldown = .42;
  p.vx = -p.dir * 160;
  setTimeout(() => { if (p && !p.stun && p.feint > 0) p.vx = p.dir * 520; }, 85);
}
function chestControl(p) {
  p.chest = .24; p.actionCooldown = .38;
  const cx = p.x + p.dir * 4, cy = p.y + 22;
  const dx = ball.x - cx, dy = ball.y - cy;
  if (Math.abs(dx) < 72 && Math.abs(dy) < 70) {
    ball.x = cx + Math.sign(dx || p.dir) * 45; ball.y = cy - 18;
    ball.vx = p.vx * .42 + p.dir * 95; ball.vy = -125;
    ball.trail.push({ x: ball.x, y: ball.y, life: .2, head: true });
  }
}
function headBall(p, power) {
  p.head = .22;
  const hx = p.x + p.dir * 6, hy = p.y - PLAYER_HEAD_Y;
  const dx = ball.x - hx, dy = ball.y - hy;
  if (Math.abs(dx) < 90 && Math.abs(dy) < 82) {
    ball.vx = p.dir * (610 * power) + p.vx * .24;
    ball.vy = -230 * power + dy * 2;
    ball.trail.push({ x: ball.x, y: ball.y, life: .28, head: true });
    sfx('head');
  }
}
function bounceOnHead(p) {
  if (p.headContact > 0) return;
  const hx = p.x + p.dir * 6, hy = p.y - PLAYER_HEAD_Y;
  let dx = ball.x - hx, dy = ball.y - hy;
  const distance = Math.hypot(dx, dy), reach = ball.r + 34;
  if (distance >= reach) return;
  const nx = dx / (distance || 1), ny = dy / (distance || 1);
  const bounce = Math.max(440, Math.hypot(ball.vx, ball.vy) * .82);
  ball.x = hx + nx * (reach + 1); ball.y = hy + ny * (reach + 1);
  ball.vx = nx * bounce + p.vx * .22;
  ball.vy = ny * bounce - 85;
  p.headContact = .14; p.head = .15;
  ball.trail.push({ x: ball.x, y: ball.y, life: .32, head: true });
  sfx('head');
}
function ballPhysics(dt) {
  ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.vy += 1160 * dt; ball.vx *= Math.pow(.86, dt);
  ball.spin += ball.vx * dt / 62;
  ball.trail.forEach(t => t.life -= dt); ball.trail = ball.trail.filter(t => t.life > 0);
  if (ball.y + ball.r > ground) { if (Math.abs(ball.vy) > 180 && performance.now() - lastBounceSound > 90) { sfx('bounce'); lastBounceSound = performance.now(); } ball.y = ground - ball.r; ball.vy *= -.66; ball.vx *= .84; }
  if (ball.y - ball.r < 76) { ball.y = 76 + ball.r; ball.vy *= -.8; }
  [player, cpu].forEach(p => {
    const dx = ball.x - p.x, dy = ball.y - (p.y + 62), d = Math.hypot(dx, dy);
    if (d < 70) { ball.vx += dx / d * 240; ball.vy += dy / d * 220; }
    bounceOnHead(p);
  });
  collideGoalFrame(goal.leftLine, -1);
  collideGoalFrame(goal.rightLine, 1);
  const throughMouth = ball.y > goal.top + ball.r && ball.y < goal.bottom - ball.r;
  if (ball.x + ball.r < goal.leftLine && throughMouth) return addGoal(1);
  if (ball.x - ball.r > goal.rightLine && throughMouth) return addGoal(0);
  if (ball.x < ball.r || ball.x > W - ball.r) { ball.vx *= -0.8; ball.x = Math.max(ball.r, Math.min(W - ball.r, ball.x)); }
}
function collideGoalFrame(line, side) {
  const back = line + side * goal.depth;
  collideRod(line, goal.top, back, goal.top);
  collideRod(line, goal.top, line, goal.top + 14);
  collideRod(line, goal.bottom - 14, line, goal.bottom);
}
function collideRod(x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;
  const ratio = lengthSq ? Math.max(0, Math.min(1, ((ball.x - x1) * dx + (ball.y - y1) * dy) / lengthSq)) : 0;
  const px = x1 + dx * ratio, py = y1 + dy * ratio;
  let nx = ball.x - px, ny = ball.y - py;
  const distance = Math.hypot(nx, ny), reach = ball.r + 8;
  if (distance >= reach) return;
  nx /= distance || 1; ny /= distance || 1;
  const towardsFrame = ball.vx * nx + ball.vy * ny;
  if (towardsFrame >= 0) return;
  ball.x = px + nx * (reach + 1); ball.y = py + ny * (reach + 1);
  ball.vx = (ball.vx - 2 * towardsFrame * nx) * .78;
  ball.vy = (ball.vy - 2 * towardsFrame * ny) * .78;
  ball.trail.push({ x: px, y: py, life: .18, hit: true });
  if (performance.now() - lastFrameSound > 90) { sfx('frame'); lastFrameSound = performance.now(); }
}
function field() {
  const environmentImage = selectedEnvironment === 'torreon' ? torreonBackground : selectedEnvironment === 'hospital' ? hospitalBackground : selectedEnvironment === 'costanera' ? costaneraBackground : selectedEnvironment === 'plaza' ? plazaBackground : selectedEnvironment === 'jardin' ? jardinBackground : selectedEnvironment === 'coliseo' ? coliseoBackground : null;
  if (environmentImage?.complete) ctx.drawImage(environmentImage, 0, 0, W, H);
  else { const sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#0e5d45'); sky.addColorStop(1, '#08342d'); ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#d9bf79'; ctx.fillRect(0, 230, W, 70); }
  drawGoal(goal.leftLine, -1); drawGoal(goal.rightLine, 1);
}
function drawGoal(line, side) {
  const back = line + side * goal.depth, width = Math.abs(back - line), x = Math.min(line, back);
  ctx.save(); ctx.fillStyle='rgba(220,245,255,.11)';ctx.fillRect(x,goal.top,width,goal.bottom-goal.top);
  ctx.strokeStyle='rgba(232,250,255,.44)';ctx.lineWidth=1;
  for(let y=goal.top+14;y<goal.bottom;y+=16){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+width,y);ctx.stroke();}
  for(let xx=x+8;xx<x+width;xx+=12){ctx.beginPath();ctx.moveTo(xx,goal.top);ctx.lineTo(xx,goal.bottom);ctx.stroke();}
  ctx.restore();
}
function drawGoalFrame(line, side) {
  const back = line + side * goal.depth;
  ctx.save();ctx.strokeStyle='#f7ffff';ctx.lineWidth=10;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(line,goal.bottom);ctx.lineTo(line,goal.top);ctx.lineTo(back,goal.top);ctx.stroke();ctx.restore();
}
function drawGoalFrontNet(line, side) {
  const behindLine = side < 0 ? ball.x < line : ball.x > line;
  if (!behindLine) return;
  const back = line + side * goal.depth, width = Math.abs(back - line), x = Math.min(line, back);
  ctx.save();ctx.strokeStyle='rgba(245,255,255,.78)';ctx.lineWidth=1.5;
  for(let y=goal.top+10;y<goal.bottom;y+=14){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+width,y);ctx.stroke();}
  for(let xx=x+7;xx<x+width;xx+=10){ctx.beginPath();ctx.moveTo(xx,goal.top);ctx.lineTo(xx,goal.bottom);ctx.stroke();}
  ctx.restore();
}
function drawPlayer(p, sheet, actionSheet) {
  const moving = Math.min(1, Math.abs(p.vx) / 260);
  const cheer = p.celebrate ? Math.abs(Math.sin((1.65 - goalMoment.time) * 10)) * 24 : 0;
  const bob = Math.sin(p.phase) * 5 * moving - p.landing * 7 - cheer;
  const frame = p.slide > .02 || p.kick > .035 ? 3 : (p.head > .035 || p.chest > .035 || p.y < ground - 113 || p.celebrate) ? 2 : moving > .14 ? 1 : 0;
  const actionFrame = p.chest > .035 ? 0 : p.slide > .035 ? 1 : p.feint > .035 ? 2 : (p.aerial > .035 || p.fall > .035 || p.recover > .035) ? 3 : -1;
  const hasActionSprite = actionFrame >= 0 && actionSheet;
  ctx.save(); ctx.translate(p.x, p.y + 112 + bob + (p.defeat ? 13 : 0));
  ctx.fillStyle = 'rgba(0,0,0,.23)'; ctx.beginPath();ctx.ellipse(0, 3, 69 - p.landing * 12, 13, 0, 0, Math.PI * 2);ctx.fill();
  ctx.scale(p.dir * p.artFacing, 1);
  const poseTilt = hasActionSprite ? 0 : p.aerial > 0 ? -.92 : p.slide > 0 ? .2 : p.chest > 0 ? -.12 : p.feint > 0 ? .2 : 0;
  const fallTilt = hasActionSprite ? 0 : p.fall > 0 ? .64 * p.dir : p.recover > 0 ? -.18 * p.dir : 0;
  ctx.rotate((p.vx / 450) * .075 + poseTilt * p.dir + (p.defeat ? .16 * p.dir : 0) + fallTilt + (p.stun > 0 ? Math.sin(p.stun * 35) * .12 : 0));
  if (!hasActionSprite && p.slide > 0) ctx.scale(1.12, .82);
  if (!hasActionSprite && p.chest > 0) ctx.scale(.96, 1.05);
  const width = PLAYER_DRAW_WIDTH, height = PLAYER_SIZE;
  if (actionFrame >= 0 && actionSheet) {
    const sw = actionSheet.width / 2, sh = actionSheet.height / 2;
    const sx = (actionFrame % 2) * sw, sy = Math.floor(actionFrame / 2) * sh;
    ctx.drawImage(actionSheet, sx, sy, sw, sh, -width / 2, -height + 8, width, height);
  } else if (sheet) {
    const sw = sheet.width / 2, sh = sheet.height / 2;
    const sx = (frame % 2) * sw, sy = Math.floor(frame / 2) * sh;
    ctx.drawImage(sheet, sx, sy, sw, sh, -width / 2, -height + 8, width, height);
  }
  if (p.defeat) { ctx.fillStyle='#80d8ff';ctx.globalAlpha=.9;ctx.beginPath();ctx.arc(29,-169,6,0,Math.PI*2);ctx.arc(43,-150,4,0,Math.PI*2);ctx.fill(); }
  if (p.hit > 0) { ctx.strokeStyle='#ffd45a';ctx.lineWidth=5;ctx.globalAlpha=p.hit*3;ctx.beginPath();ctx.arc(5,-164,24,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#fff0a2';ctx.font='bold 26px Arial';ctx.fillText('✦',21,-186);ctx.fillText('✦',-26,-174); }
  if (frame === 3 || p.head > .035 || p.chest > .035) { ctx.strokeStyle=frame === 3 ? '#fff8ae' : p.chest > .035 ? '#ffdfa1' : '#c6f6ff';ctx.lineWidth=9;ctx.lineCap='round';ctx.globalAlpha=.8;ctx.beginPath();ctx.moveTo(80,-27);ctx.lineTo(130,-6);ctx.stroke(); }
  ctx.restore();
}
function drawBall() {
  ball.trail.forEach(t => { ctx.globalAlpha = t.life * 1.5;ctx.fillStyle=t.hit?'#ffdc6b':t.head?'#b7f4ff':'#fff4be';ctx.beginPath();ctx.arc(t.x,t.y,t.hit?42:ball.r*(t.life/.35),0,Math.PI*2);ctx.fill(); });ctx.globalAlpha=1;
  if (ballSkin) { ctx.save();ctx.translate(ball.x,ball.y);ctx.rotate(ball.spin);ctx.drawImage(ballSkin,-BALL_DRAW_SIZE/2,-BALL_DRAW_SIZE/2,BALL_DRAW_SIZE,BALL_DRAW_SIZE);ctx.restore();return; }
  ctx.fillStyle='#fffdf2';ctx.beginPath();ctx.arc(ball.x,ball.y,ball.r,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#27323a';ctx.lineWidth=3;ctx.stroke();ctx.fillStyle='#27323a';ctx.beginPath();ctx.arc(ball.x,ball.y,7,0,Math.PI*2);ctx.fill();
}
function drawCelebration() {
  if (!goalMoment) return;
  const elapsed = 1.65 - goalMoment.time;
  for (let i = 0; i < 26; i++) { const x = (i * 97 + elapsed * 160) % W; const y = 125 + ((i * 61 + elapsed * 270) % 300); ctx.fillStyle = ['#f8d364','#ff7961','#77d9ff','#fff'][i % 4]; ctx.fillRect(x, y, 10, 18); }
  ctx.fillStyle='rgba(3,30,25,.38)';ctx.fillRect(0,0,W,H);ctx.fillStyle='#fff';ctx.textAlign='center';ctx.font='900 84px Arial';ctx.fillText('¡GOOOL!',W/2,210);
}
function draw() { field(); drawPlayer(player, playerSheet, playerActionSheet);drawPlayer(cpu, rivalSheet, rivalActionSheet);drawBall();drawGoalFrontNet(goal.leftLine,-1);drawGoalFrontNet(goal.rightLine,1);drawGoalFrame(goal.leftLine,-1);drawGoalFrame(goal.rightLine,1);drawCelebration(); if(kickoff>0){ctx.fillStyle='rgba(3,30,25,.5)';ctx.fillRect(0,0,W,H);ctx.fillStyle='#fff';ctx.textAlign='center';ctx.font='900 70px Arial';ctx.fillText('¡A JUGAR!',W/2,310);} }
function loop(now) { if(!running) return; const dt=Math.min(.033,(now-last)/1000);last=now;update(dt);draw();if(running)requestAnimationFrame(loop); }
function finish() { running=false; stopMusic(); gameScreen.classList.add('hidden');resultScreen.classList.remove('hidden'); const title=score[0]>score[1]?'¡Ganaste!':score[0]===score[1]?'¡Empate!':'¡Casi!';document.querySelector('#resultTitle').textContent=title;document.querySelector('#resultScore').textContent=`${score[0]} — ${score[1]}`; }

document.querySelectorAll('.character').forEach(button => button.addEventListener('click', () => { selected=button.dataset.player;document.querySelectorAll('.character').forEach(b=>b.classList.toggle('selected',b===button)); }));
document.querySelectorAll('.ball-option').forEach(button => button.addEventListener('click', () => { selectedBall=button.dataset.ball;document.querySelectorAll('.ball-option').forEach(b=>b.classList.toggle('selected',b===button)); }));
document.querySelectorAll('.environment-option').forEach(button => button.addEventListener('click', () => { selectedEnvironment=button.dataset.environment;document.querySelectorAll('.environment-option').forEach(b=>b.classList.toggle('selected',b===button)); }));
musicSelect.addEventListener('change', () => { if (musicSelect.value === 'none') stopMusic(); else if (youtubeApiReady) createYoutubePlayer(); });
soundButton.addEventListener('click', () => { soundEnabled = !soundEnabled; if (soundEnabled) { audio(); sfx('whistle'); } soundButton.textContent = soundEnabled ? '♫' : '♩'; soundButton.setAttribute('aria-label', soundEnabled ? 'Silenciar sonido' : 'Activar sonido'); soundButton.classList.toggle('active', soundEnabled); });
document.querySelector('#playButton').addEventListener('click', startGame);document.querySelector('#againButton').addEventListener('click', startGame);
window.addEventListener('keydown', e=>{ const m={ArrowLeft:'left',a:'left',A:'left',ArrowRight:'right',d:'right',D:'right',ArrowUp:'jump',w:'jump',W:'jump',' ':'kick',f:'head',F:'head',s:'slide',S:'slide',e:'feint',E:'feint',q:'chest',Q:'chest'};if(m[e.key]){keys[m[e.key]]=true;e.preventDefault();} });
window.addEventListener('keyup', e=>{ const m={ArrowLeft:'left',a:'left',A:'left',ArrowRight:'right',d:'right',D:'right',ArrowUp:'jump',w:'jump',W:'jump',' ':'kick',f:'head',F:'head',s:'slide',S:'slide',e:'feint',E:'feint',q:'chest',Q:'chest'};if(m[e.key])keys[m[e.key]]=false; });
document.querySelectorAll('[data-key]').forEach(b=>{const key=b.dataset.key;['pointerdown','pointerup','pointerleave','pointercancel'].forEach(event=>b.addEventListener(event,e=>{keys[key]=event==='pointerdown';e.preventDefault();}));});
prepareSelectionImages();
