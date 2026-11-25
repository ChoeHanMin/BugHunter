// ---------- 게임 본체 ----------
const STAGES = [
  { id: 1, key: 'forest', name: '텍스처 없는 숲', theme: 0x6BD66B, sky: 0x173a26, dur: 44, count: 15, mix: { basic: 1 }, intro: ['basic'], fog: [18, 95, 30, 150], light: [0.8, 1.1] },
  { id: 2, key: 'city', name: '복붙 도시', theme: 0xFF9E3D, sky: 0x2a1838, dur: 50, count: 20, mix: { basic: 10, clone: 10 }, intro: ['clone'], unlock: 'refactor', fog: [22, 110, 30, 160], light: [0.8, 1.1] },
  { id: 3, key: 'subway', name: '렌더링 지하철', theme: 0x3DE0D0, sky: 0x0b2a30, dur: 52, count: 26, mix: { basic: 9, clone: 7, ghost: 10 }, intro: ['ghost'], unlock: 'rollback', fog: [6, 34, 18, 95], light: [0.25, 1.05] },
  { id: 4, key: 'physics', name: '물리 고장 구역', theme: 0xB07CFF, sky: 0x22163a, dur: 58, count: 28, mix: { basic: 6, clone: 5, ghost: 5, e404: 6, loop: 6 }, intro: ['e404', 'loop'], fog: [18, 100, 30, 150], light: [0.75, 1.1] },
  { id: 5, key: 'boss', name: '보스 "메인 루프"', theme: 0xC6F432, sky: 0x0f2a12, boss: true, fog: [30, 120, 40, 170], light: [0.7, 1.1] },
];
const GLITCH = {
  tear: { name: '화면 찢어짐', dur: 4 },
  inv: { name: '색 반전', dur: 3 },
  flip: { name: 'UI 뒤집힘', dur: 5 },
  slip: { name: '조준 미끄러짐', dur: 4 },
  pix: { name: '픽셀화', dur: 2 },
};
const NORMAL_SEED = 20261125;
const _proj = new THREE.Vector3();

const Game = {
  scene: null, camera: null, camR: new THREE.Vector3(1, 0, 0), camU: new THREE.Vector3(0, 1, 0), camF: new THREE.Vector3(0, 0, -1),
  look: new THREE.Vector3(), time: 0, state: 'title', run: null, S: null, bugs: [], bugSpeedMul: 1, ws: 1, rollT: 0,
  weapon: 0, refT: 0, lastShot: -9, ptr: { x: -100, y: -100, down: false, id: null, has: false },
  glitches: [], slip: { x: 0, y: 0 }, tracers: [], pops: [], taps: [], W: 1, H: 1, tanHalf: 1,
  hintT: 0, bannerT: 0, toastT: 0, fpsAcc: 0, fpsN: 0, titleBugs: [], titleU: 0,

  init() {
    buildTextures(); initGeo();
    FX.init($('#gl'));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, 400);
    World.init(this.scene);
    PFX.init(this.scene);
    this.ov = $('#ov'); this.g2 = this.ov.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.bindInput();
    this.toTitle();
    this.last = performance.now();
    const loop = (t) => { requestAnimationFrame(loop); this.frame(t); };
    requestAnimationFrame(loop);
  },
  resize() {
    this.W = window.innerWidth; this.H = window.innerHeight;
    const a = this.W / this.H;
    this.camera.aspect = a;
    // 세로 화면이면 시야각을 넓혀 보정
    this.camera.fov = a < 1 ? clamp(2 * Math.atan(Math.tan((78 * Math.PI) / 360) / a) * 180 / Math.PI, 70, 105) : 70;
    this.camera.updateProjectionMatrix();
    this.tanHalf = Math.tan((this.camera.fov * Math.PI) / 360);
    FX.resize();
    const pr = Math.min(window.devicePixelRatio || 1, 2);
    this.ov.width = this.W * pr; this.ov.height = this.H * pr; this.g2.setTransform(pr, 0, 0, pr, 0, 0);
  },

  // ----- 입력 -----
  bindInput() {
    const cv = $('#gl');
    const pos = (e) => { this.ptr.x = e.clientX; this.ptr.y = e.clientY; this.ptr.has = true; };
    cv.addEventListener('pointerdown', (e) => {
      SND.init();
      if (this.ptr.id != null && this.ptr.down && e.pointerType === 'touch') return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      this.ptr.id = e.pointerId; this.ptr.down = true; pos(e);
      if (e.pointerType !== 'mouse') this.taps.push({ x: e.clientX, y: e.clientY, t: 0 });
      this.fire(true);
      e.preventDefault();
    });
    window.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' || e.pointerId === this.ptr.id) pos(e); });
    const up = (e) => { if (e.pointerId === this.ptr.id) { this.ptr.down = false; this.ptr.id = null; if (e.pointerType !== 'mouse') this.ptr.has = false; } };
    window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    window.addEventListener('wheel', (e) => { if (this.state === 'play') this.selectWeapon(this.weapon === 0 ? 1 : 0); }, { passive: true });
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.key === 'Escape') { if (this.state === 'play') UI.pause(); else if (this.state === 'paused') UI.resume(); return; }
      if (this.state !== 'play') return;
      if (e.key === '1') this.selectWeapon(0);
      else if (e.key === '2') this.selectWeapon(1);
      else if (e.key === '3' || e.code === 'Space') { this.rollback(); e.preventDefault(); }
    });
    $$('.wpn').forEach((b) => b.addEventListener('pointerdown', (e) => {
      e.stopPropagation(); e.preventDefault(); SND.init();
      const w = +b.dataset.w;
      if (w === 2) this.rollback(); else this.selectWeapon(w);
    }));
    // 타이틀 음악은 첫 터치·클릭 뒤에 시작 (브라우저 정책)
    window.addEventListener('pointerdown', () => { SND.init(); if (this.state === 'title') MUS.startTitle(); }, true);
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'play') UI.pause(); });
    window.addEventListener('blur', () => { if (this.state === 'play') UI.pause(); });
  },
  unlocked(w) { const i = this.run ? this.run.stage : 0; return w === 0 || (w === 1 && i >= 1) || (w === 2 && i >= 2); },
  selectWeapon(w) {
    if (!this.unlocked(w)) { UI.toast('스테이지 ' + (w === 1 ? 2 : 3) + '부터 쓸 수 있어요'); return; }
    if (this.weapon !== w) SND.play('click');
    this.weapon = w;
  },
  refReady() { return this.refT <= 0; },

  // ----- 발사 -----
  fire(initial) {
    if (this.state !== 'play' || !this.S || !this.S.started || this.S.ending) return;
    const gap = initial ? 0.15 : 0.25;
    let x = this.ptr.x, y = this.ptr.y;
    if (this.hasGlitch('slip')) { x += this.slip.x; y += this.slip.y; }
    if (this.weapon === 1 && this.refReady() && this.unlocked(1)) { this.fireSpread(x, y); this.lastShot = this.time; return; }
    if (this.time - this.lastShot < gap) return;
    this.lastShot = this.time;
    this.fireSingle(x, y);
  },
  assist() { return IS_TOUCH ? 48 : 16; },
  findTarget(x, y, assist, exclude) {
    let best = null, bd = 1e9;
    for (const b of this.bugs) {
      if (!b.alive || !b.onScreen || (exclude && exclude.has(b))) continue;
      if (b.type === 'ghost' && !b.vis) continue;
      const d = Math.hypot(b.sx - x, b.sy - y);
      if (d <= b.sr * 0.9 + assist && d - b.sr < bd) { bd = d - b.sr; best = b; }
    }
    if (this.S && this.S.def.boss) {
      for (const s of Boss.targets()) {
        if (!s.onScreen || (exclude && exclude.has(s))) continue;
        const dx = Math.abs(s.sx - x), dy = Math.abs(s.sy - y);
        if (dx <= s.sw + assist * 0.6 && dy <= s.sh + assist * 0.6) {
          const sc = Math.hypot(dx, dy) - s.sh - (s.snake.real ? 30 : 0);
          if (sc < bd) { bd = sc; best = s; }
        }
      }
    }
    return best;
  },
  gunPivot() { return { x: this.W * (this.hudFlipped ? 0.2 : 0.8), y: this.H + Math.min(this.W, this.H) * 0.04 }; },
  gunLen() { return Math.min(Math.max(this.W, this.H) * 0.2, Math.min(this.W, this.H) * 0.42); },
  aimPoint() { return this.ptr.has ? { x: this.ptr.x, y: this.ptr.y } : { x: this.W / 2, y: this.H / 2 }; },
  gunPos() { // 총구 위치
    const fp = this.fpLayout();
    if (fp) return fp.muzzle;
    const p = this.gunPivot(), a = this.aimPoint();
    const ang = Math.atan2(a.y - p.y, a.x - p.x), L = this.gunLen() * (0.72 - this.recoil * 0.08);
    return { x: p.x + Math.cos(ang) * L, y: p.y + Math.sin(ang) * L };
  },
  // 1인칭 총 그림(assets/gun.png): 오른쪽 아래에서 손이 들고 있는 모습, 총구는 왼쪽 위
  loadGunAssets() {
    if (this.gunImgs) return;
    this.gunImgs = [gunCanvas('#C6F432'), gunCanvas('#FFD34D')];
    this.fpImgs = [];
    [ASSETS.gun, ASSETS.gun_refactor].forEach((url, i) => {
      if (!url) return;
      const im = new Image();
      im.onload = () => { im.muzzle = findMuzzle(im); };
      im.src = url; this.fpImgs[i] = im;
    });
  },
  fpImage() {
    this.loadGunAssets();
    const pickI = this.weapon === 1 && this.fpImgs[1] ? 1 : 0;
    const im = this.fpImgs[pickI];
    return im && im.complete && im.naturalWidth && im.muzzle ? im : null;
  },
  fpLayout() {
    const im = this.fpImage(); if (!im) return null;
    const W = this.W, H = this.H, a = this.aimPoint();
    const w = W < H ? W * 0.62 : Math.min(W * 0.46, H * 0.62), h = w * im.naturalHeight / im.naturalWidth; // 세로 화면은 크게
    const ax = (a.x - W / 2) / W, ay = (a.y - H / 2) / H;
    const bob = Math.sin(this.time * 3.2) * h * 0.012;
    const flip = this.hudFlipped;
    let x = W - w * 0.92 + ax * w * 0.14 + this.recoil * w * 0.05;
    const y = H - h * 0.9 + ay * h * 0.1 + this.recoil * h * 0.07 + bob;
    if (flip) x = W - x - w;
    const mx = flip ? x + w - im.muzzle.x * w : x + im.muzzle.x * w;
    return { im, x, y, w, h, flip, muzzle: { x: mx, y: y + im.muzzle.y * h } };
  },
  fireSingle(x, y) {
    this.run.st.shots++; this.S.shots++;
    SND.play('shot');
    this.recoil = 1;
    const g = this.gunPos();
    this.tracers.push({ x0: g.x, y0: g.y, x1: x, y1: y, t: 0, w: 4 });
    const t = this.findTarget(x, y, this.assist());
    // 한가운데를 맞히면 PERFECT
    this.perfectShot = !!t && t instanceof Bug && t.type !== 'hotfix' && Math.hypot(t.sx - x, t.sy - y) < Math.max(10, t.sr * 0.4);
    if (t && this.hitTarget(t)) { this.run.st.hits++; this.S.hits++; }
    this.perfectShot = false;
  },
  fireSpread(x, y) {
    this.refT = 3;
    this.run.st.shots++; this.S.shots++;
    SND.play('spread');
    this.recoil = 1.6; this.shake = Math.max(this.shake, 0.12);
    const g = this.gunPos();
    const hitSet = new Set(); let any = false, cloneFix = 0;
    const span = Math.min(this.W, this.H) * 0.07;
    for (let i = -3; i <= 3; i++) {
      const px = x + i * span, py = y + Math.abs(i) * span * 0.18;
      this.tracers.push({ x0: g.x, y0: g.y, x1: px, y1: py, t: 0, w: 3 });
      const t = this.findTarget(px, py, IS_TOUCH ? 30 : 18, hitSet);
      if (t) {
        hitSet.add(t);
        const wasClone = t.type === 'clone' || t.type === 'mini';
        if (this.hitTarget(t)) { any = true; if (wasClone) cloneFix++; }
      }
    }
    if (any) { this.run.st.hits++; this.S.hits++; }
    this.run.st.blastMax = Math.max(this.run.st.blastMax, cloneFix);
  },
  hitTarget(t) {
    if (t instanceof Bug) {
      if (t.type === 'hotfix') { this.collectHotfix(t); return true; }
      if (t.type === 'loop' && !t.vuln) { SND.play('deflect'); PFX.spark(t.pos, [0.85, 0.7, 1], 6, 4); this.pop(t.sx, t.sy - 20, '튕김!', '#d9c2ff'); return false; }
      if (t.type === 'clone') { this.split(t); return true; }
      this.fixBug(t); return true;
    }
    // 보스 코드 줄
    const res = Boss.hit(t);
    if (res === 'dmg') { SND.play('shot'); PFX.spark(t.pos, [1, 0.5, 0.5], 6, 3); this.addScore(30, t.sx, t.sy); return true; }
    if (res) {
      PFX.fix(t.pos, [1, 0.3, 0.37], 1.6); SND.play('hit', this.run.streak);
      this.shake = Math.max(this.shake, 0.18); this.hitStop = 0.06;
      this.addScore(400, t.sx, t.sy); this.run.st.fixed.boss++; this.S.fixed++; this.streakUp();
      UI.codeFix('boss', t);
      World.colorizeNear(t.pos, 3);
      return true;
    }
    SND.play('deflect'); this.pop(t.sx, t.sy - 16, '가짜 줄!', '#b0505a'); PFX.spark(t.pos, [0.7, 0.3, 0.35], 6, 3);
    return false;
  },
  split(b) {
    SND.play('split');
    PFX.spark(b.pos, [1, 0.83, 0.3], 14, 6);
    for (const s of [-1, 1]) {
      const p = b.pos.clone().addScaledVector(this.camR, s * 0.5);
      this.bugs.push(new Bug('mini', p, { sep: this.camR.clone().multiplyScalar(s * 4), spdMul: b.spdMul, ox: b.ox + s * 0.8, oy: b.oy }));
    }
    this.run.st.fixed.clone++;
    if (!this.S.def.boss) this.S.fixed++; // 보스전 진행률은 오류 줄만
    this.pop(b.sx, b.sy - 20, '분열!', '#FFD34D');
    UI.codeFix('clone');
    b.remove();
  },
  addScore(base, x, y) {
    const mult = this.mult();
    const v = Math.round(base * mult);
    this.run.score += v;
    if (v > 0) this.pop(x, y - 24, '+' + v, '#C6F432');
  },
  mult() { return Math.min(2, 1 + 0.1 * this.run.streak); },
  streakUp() {
    this.run.streak++;
    this.run.maxStreak = Math.max(this.run.maxStreak, this.run.streak);
    if (this.run.streak % 5 === 0) {
      SND.play('combo');
      if (this.glitches.length) { const g = this.glitches.shift(); UI.toast('연속 패치! ' + GLITCH[g.type].name + ' 복구'); }
      else UI.toast('연속 패치 ×' + this.run.streak);
    }
  },
  collectHotfix(b) {
    const r = this.run, before = r.stab;
    r.stab = Math.min(100, r.stab + 20);
    const fixedGl = this.glitches.length;
    this.glitches = [];
    SND.play('pickup');
    PFX.fix(b.pos, [0.78, 0.96, 0.2], 1.3);
    r.st.hotfix++;
    if (r.stab - before < 5) this.addScore(500, b.sx, b.sy);
    this.pop(b.sx, b.sy - 46, r.stab > before ? `핫픽스! 안정성 +${Math.round(r.stab - before)}` : '핫픽스! 보너스', '#E6FF7A');
    if (fixedGl) UI.toast('핫픽스 적용 — 화면 고장 모두 복구');
    UI.codeFix('hotfix');
    b.remove();
  },
  spawnHotfix() {
    const pos = this.camera.position.clone().addScaledVector(this.camF, 13).addScaledVector(this.camR, (RNG() < 0.5 ? -1 : 1) * rnd(1.5, 4)).addScaledVector(this.camU, rnd(0.8, 2.2));
    const b = this.spawnBugAt('hotfix', pos, {});
    if (!this.run.seenHotfix) { this.run.seenHotfix = true; b.label = '핫픽스'; UI.hint('핫픽스 등장! ' + BUGDEF.hotfix.tip, 4); }
  },
  fixBug(b) {
    const perfect = this.perfectShot;
    SND.play('hit', this.run.streak);
    if (perfect) { SND.play('perfect'); this.run.st.perfect++; this.pop(b.sx, b.sy - b.sr - 28, 'PERFECT', '#FFD34D'); this.hitStop = 0.05; }
    this.shake = Math.max(this.shake, perfect ? 0.1 : 0.05);
    PFX.fix(b.pos, b.type === 'ghost' ? [0.75, 0.96, 1] : b.type === 'clone' || b.type === 'mini' ? [1, 0.83, 0.3] : [1, 0.3, 0.37], b.type === 'mini' ? 0.7 : 1);
    this.addScore(b.def.pts * (perfect ? 1.5 : 1), b.sx, b.sy);
    this.run.st.fixed[b.type]++;
    if (!this.S.def.boss) this.S.fixed++;
    this.streakUp();
    World.colorizeNear(b.pos, b.type === 'mini' ? 2 : 4);
    if (this.S.tutorial) { this.S.tutorial = false; UI.hint(''); }
    UI.codeFix(b.type);
    b.remove();
  },
  contact(b) {
    if (!b.alive) return;
    b.remove();
    if (this.state !== 'play') return;
    this.run.stab = Math.max(0, this.run.stab - b.def.dmg);
    this.run.streak = 0; this.run.st.contacts++;
    FX.u.hit = 1; this.shake = 0.45;
    SND.play('glitch');
    this.addGlitch();
    UI.codeError(b.type);
    if (!this.S.warned && this.run.stage === 0) { this.S.warned = true; UI.hint('버그에 닿으면 안정성이 깎이고 화면이 고장 나요!', 3); }
    if (this.run.stab <= 0) this.crash();
  },
  hasGlitch(t) { return this.glitches.some((g) => g.type === t); },
  addGlitch() {
    const w = this.run.gw;
    let tot = 0; for (const k in w) tot += w[k];
    let x = RNG() * tot, type = 'tear';
    for (const k in w) { x -= w[k]; if (x <= 0) { type = k; break; } }
    if (this.glitches.length >= 2) this.glitches.shift(); // 최대 2개까지만 겹침
    this.glitches = this.glitches.filter((g) => g.type !== type);
    this.glitches.push({ type, t: GLITCH[type].dur });
    this.run.st.glitch[type]++;
    if (type === 'slip') { this.slip.x = (RNG() < 0.5 ? -1 : 1) * rnd(32, 46); this.slip.y = (RNG() < 0.5 ? -1 : 1) * rnd(10, 22); }
  },
  rollback() {
    if (this.state !== 'play' || !this.S || !this.S.started || this.S.ending) return;
    if (!this.unlocked(2)) { UI.toast('롤백은 스테이지 3부터!'); return; }
    if (this.rollT > 0) return;
    if (this.S.rb <= 0) { UI.toast('이번 스테이지 롤백을 다 썼어요'); return; }
    this.S.rb--; this.rollT = 3; this.run.st.rollbacks++;
    if (this.glitches.length) this.glitches.shift(); // 화면 고장 하나 즉시 복구
    SND.play('rollback'); MUS.slow = true;
  },
  crash() {
    this.state = 'crashing'; this.crashT = 0;
    this.run.st.crashes++;
    const i = this.run.stage;
    this.run.crashStreak[i]++;
    if (this.run.crashStreak[i] >= 2) this.run.help[i] = true;
    MUS.crashStop(); SND.play('crash');
    this.ptr.down = false;
  },

  // ----- 진행 -----
  newRun(daily) {
    const seed = daily ? DAILY_SEED : NORMAL_SEED;
    const r = mulberry32(seed ^ 0x9e3779b9);
    const gw = {}; for (const k of Object.keys(GLITCH)) gw[k] = daily ? 0.5 + r() : 1;
    this.run = {
      daily, seed, stage: 0, score: 0, stab: 100, streak: 0, maxStreak: 0, gw,
      st: { fixed: { basic: 0, clone: 0, mini: 0, ghost: 0, e404: 0, loop: 0, boss: 0 }, shots: 0, hits: 0, crashes: 0, contacts: 0,
        glitch: { tear: 0, inv: 0, flip: 0, slip: 0, pix: 0 }, rollbacks: 0, tele: 0, bossTime: 0, blastMax: 0, perfect: 0, hotfix: 0 },
      crashStreak: [0, 0, 0, 0, 0], help: [false, false, false, false, false], stageRes: [], snap: null,
    };
    this.weapon = 0;
    this.startStage(0);
  },
  snapshot() { const r = this.run; r.snap = { score: r.score, stab: r.stab, streak: r.streak, maxStreak: r.maxStreak, st: JSON.parse(JSON.stringify(r.st)) }; },
  restoreSnapshot() {
    const r = this.run, s = r.snap;
    const keep = { crashes: r.st.crashes, glitch: r.st.glitch, tele: r.st.tele, contacts: r.st.contacts };
    r.score = s.score; r.stab = 100; r.streak = 0; r.maxStreak = s.maxStreak;
    r.st = Object.assign(JSON.parse(JSON.stringify(s.st)), keep);
  },
  buildSchedule(def, seed) {
    const r = mulberry32(seed + def.id * 7919);
    const list = [];
    let u = 0.05, n = def.count;
    const isFirst = (t) => def.intro.includes(t) && t !== 'basic';
    for (const t of def.intro) { list.push({ u, type: t, intro: true }); u += t === 'basic' ? 0.06 : 0.1; n--; }
    const pool = [];
    const tot = Object.values(def.mix).reduce((a, b) => a + b, 0);
    for (const k in def.mix) for (let i = 0; i < Math.round((def.mix[k] / tot) * n); i++) pool.push(k);
    while (pool.length < n) pool.push('basic');
    pool.length = n;
    shuffle(pool, r); // 오늘의 빌드 시드로 순서만 섞음
    const u0 = u + 0.02, k = Math.round(n * 0.3), m = n - k;
    pool.forEach((t, i) => list.push({
      u: i < m ? u0 + (0.66 - u0) * (i + 0.5 + (r() - 0.5) * 0.7) / m // 평소
        : 0.73 + 0.14 * (i - m + 0.5 + (r() - 0.5) * 0.6) / k, // BUG RUSH 구간
      type: t, intro: false,
    }));
    // 핫픽스 아이템
    const hf = def.id === 1 ? [0.5] : [0.3 + r() * 0.1, 0.6 + r() * 0.08];
    for (const hu of hf) list.push({ u: hu, type: 'hotfix', intro: false });
    list.sort((a, b) => a.u - b.u);
    return list;
  },
  startStage(idx) {
    const r = this.run; r.stage = idx;
    const def = STAGES[idx];
    if (!r.snap || r.snapStage !== idx) { this.snapshot(); r.snapStage = idx; }
    RNG = mulberry32(r.seed + idx * 101 + r.st.crashes * 13);
    this.clearEntities();
    World.build(def, r.seed);
    this.S = {
      def, idx, u: 0, t: 0, queue: def.boss ? [] : this.buildSchedule(def, r.seed), fixed: 0, shots: 0, hits: 0,
      expected: 1, started: false, introT: 2.2, ending: false, rb: 2, rush: false, score0: r.score, tutorial: idx === 0, warned: false,
    };
    if (!def.boss) this.S.expected = def.count + this.S.queue.filter((q) => q.type === 'clone').length * 2;
    else this.S.expected = 16;
    this.bugSpeedMul = (1 + idx * 0.04) * (r.help[idx] ? 0.85 : 1);
    this.glitches = []; this.rollT = 0; this.ws = 1; this.refT = 0; this.tracers = []; this.pops = [];
    this.shake = 0; this.hitStop = 0; this.recoil = 0;
    this.camSpeed = def.boss ? 0 : World.len / def.dur;
    FX.u.tear = FX.u.inv = FX.u.pix = FX.u.hit = FX.u.slow = 0; FX.u.wipeOn = 0;
    if (!this.unlocked(this.weapon)) this.weapon = 0;
    if (def.boss) {
      this.bossAng = 0; this.camera.position.set(0, 3, 24); this.look.set(0, 5.5, 0);
      Boss.start(r.seed);
    } else {
      const P = World.curve.getPointAt(0), T = World.curve.getTangentAt(0);
      this.camera.position.set(P.x, 1.7, P.z); this.look.copy(P).addScaledVector(T, 6); this.look.y = 1.6;
    }
    this.camera.lookAt(this.look);
    this.state = 'play';
    UI.showHUD();
    UI.codeStart(def);
    UI.banner('STAGE ' + def.id, def.name, 2.2);
    MUS.start(idx, r.seed);
    if (def.unlock === 'refactor') { setTimeout(() => { SND.play('unlock'); UI.toast('리팩터 해금! ⋔ 부채꼴 7발 산탄'); }, 900); UI.hint(IS_TOUCH ? '아래 리팩터 버튼 → 7발 산탄 (충전 3초)' : '2번/휠: 리팩터 — 7발 산탄 (충전 3초)', 5); }
    else if (def.unlock === 'rollback') { setTimeout(() => { SND.play('unlock'); UI.toast('롤백 해금! ◀◀ 3초 슬로모션'); }, 900); UI.hint(IS_TOUCH ? '롤백 버튼: 3초 슬로모션 + 화면 고장 1개 복구 (2회)' : '스페이스: 롤백 — 3초 슬로모션 + 고장 1개 복구 (2회)', 5); }
    else if (idx === 0) UI.hint(IS_TOUCH ? '다가오는 버그를 탭해서 고치세요!' : '다가오는 버그를 클릭해서 고치세요! (누르고 있으면 연사)', 0);
    else if (r.help[idx]) UI.hint('도움 모드: 이 스테이지 버그 속도 -15%', 3);
  },
  rebuild() { // 크래시 후 해당 스테이지 처음부터
    this.restoreSnapshot();
    this.startStage(this.run.stage);
  },
  clearEntities() {
    for (const b of this.bugs) b.remove();
    this.bugs = []; PFX.clear(); Boss.dispose();
    for (const b of this.titleBugs) this.scene.remove(b.spr);
    this.titleBugs = [];
  },
  spawnBugAt(type, pos, opt) {
    const b = new Bug(type, pos, Object.assign({ spdMul: 1 }, opt));
    this.bugs.push(b);
    if (opt.intro) { b.label = BUGDEF[type].name; if (BUGDEF[type].tip) UI.hint('새 버그: ' + BUGDEF[type].name + ' — ' + BUGDEF[type].tip, 4); }
    SND.play('spawn', this.bugs.length);
    return b;
  },
  spawnFromQueue() {
    const S = this.S;
    while (S.queue.length && S.queue[0].u <= S.u && this.bugs.length < 8) {
      const q = S.queue.shift();
      const len = World.len;
      const s2 = Math.min(1, S.u + 34 / len);
      const P = World.curve.getPointAt(s2), T = World.curve.getTangentAt(s2);
      const N = new THREE.Vector3(-T.z, 0, T.x).normalize();
      const pos = P.clone().addScaledVector(N, rnd(-5, 5));
      pos.y = S.def.key === 'physics' ? rnd(9, 11) : rnd(1.2, 4.5); // 물리 구역: 천장에서 떨어짐
      if (q.type === 'hotfix') { this.spawnHotfix(); continue; }
      this.spawnBugAt(q.type, pos, { intro: q.intro });
    }
  },
  stageClear() {
    const S = this.S, r = this.run;
    S.ending = true; this.state = 'clearing'; this.clearT = 0;
    World.fillAll();
    MUS.layer = 4;
    SND.play('clear');
    r.stab = Math.min(100, r.stab + 30);
    r.crashStreak[S.idx] = 0;
    const acc = S.shots ? S.hits / S.shots : 0;
    const timeBonus = S.def.boss ? Math.max(0, Math.round((150 - S.t) * 20)) : Math.max(0, Math.round((S.def.dur + 8 - S.t) * 25));
    r.score += timeBonus;
    r.stageRes[S.idx] = { fixed: S.fixed, acc, time: S.t, score: r.score - S.score0, timeBonus };
    this.glitches = [];
    UI.hint('');
    this.saveStageRecord(S.idx, r.score - S.score0, acc);
  },
  saveStageRecord(i, score, acc) {
    const rec = Store.get('records', {});
    rec.stages = rec.stages || {};
    const s = rec.stages[i] || { score: 0, acc: 0 };
    s.score = Math.max(s.score, score); s.acc = Math.max(s.acc, acc);
    rec.stages[i] = s; Store.set('records', rec);
  },
  onBossSuccess() {
    this.run.st.bossTime = this.S.t;
    UI.banner('', 'BUILD SUCCESS', 3, true);
    SND.play('success');
    for (const b of this.bugs) { PFX.fix(b.pos, [1, 0.3, 0.37]); b.remove(); }
    this.bugs = [];
    this.S.bossEndT = 0;
  },
  nextStage() {
    if (this.run.stage >= 4) return UI.showResult();
    this.startStage(this.run.stage + 1);
  },

  // ----- 타이틀 배경 (회색 세상 + 기어 다니는 버그) -----
  toTitle() {
    this.state = 'title';
    MUS.startTitle();
    this.clearEntities();
    RNG = mulberry32(3);
    World.build(STAGES[0], 4);
    this.titleU = 0.05;
    const types = ['basic', 'clone', 'ghost', 'e404', 'loop', 'basic'];
    types.forEach((t, i) => {
      const m = new THREE.SpriteMaterial({ map: TEX[t][0], transparent: true, fog: false });
      const spr = new THREE.Sprite(m); spr.scale.setScalar(1.6);
      this.scene.add(spr);
      this.titleBugs.push({ spr, t, ph: i * 1.1, side: i % 2 ? 1 : -1, d: 9 + i * 3 });
    });
    FX.u.tear = FX.u.inv = FX.u.pix = FX.u.hit = FX.u.slow = 0; FX.u.wipeOn = 0;
    UI.showTitle();
  },
  updateTitle(dt) {
    this.titleU += dt * 0.004; if (this.titleU > 0.6) this.titleU = 0.05;
    const P = World.curve.getPointAt(this.titleU), T = World.curve.getTangentAt(this.titleU);
    this.camera.position.set(P.x, 2.2, P.z);
    this.look.copy(P).addScaledVector(T, 8); this.look.y = 1.8;
    this.camera.lookAt(this.look);
    this.updateCamBasis();
    const N = new THREE.Vector3(-T.z, 0, T.x);
    for (const b of this.titleBugs) {
      const k = this.time * 0.7 + b.ph;
      b.spr.position.copy(P).addScaledVector(T, b.d + Math.sin(k) * 1.5).addScaledVector(N, b.side * (5.2 + Math.sin(k * 1.7) * 1.2));
      b.spr.position.y = 0.7 + Math.abs(Math.sin(k * 3)) * 0.3;
      b.spr.material.map = TEX[b.t][Math.floor(this.time * 7 + b.ph) % 2];
      b.spr.material.rotation = Math.sin(k * 4) * 0.2;
    }
  },
  updateCamBasis() {
    this.camera.updateMatrixWorld();
    const m = this.camera.matrixWorld;
    this.camR.setFromMatrixColumn(m, 0); this.camU.setFromMatrixColumn(m, 1); this.camF.setFromMatrixColumn(m, 2).negate();
  },

  // ----- 메인 루프 -----
  frame(now) {
    let dt = (now - this.last) / 1000; this.last = now;
    if (dt > 0.05) dt = 0.05;
    if (dt < 0) dt = 0;
    if (this.state !== 'paused') this.time += dt;
    // 자동 화질 조절
    if (this.state === 'play') {
      this.fpsAcc += dt; this.fpsN++;
      if (this.fpsAcc > 2.5) { if (this.fpsAcc / this.fpsN > 1 / 40) FX.stepDown(); this.fpsAcc = 0; this.fpsN = 0; }
    }
    if (this.state === 'title') { this.updateTitle(dt); World.update(dt, 0); }
    else if (this.state === 'play' || this.state === 'crashing' || this.state === 'clearing') this.update(dt);
    if (this.state !== 'paused') {
      PFX.update(dt);
      this.updateFX(dt);
      FX.render(this.scene, this.camera, this.time);
      this.draw2D(dt);
      UI.tick(dt);
    }
  },
  update(dt) {
    const S = this.S, r = this.run;
    // 롤백 (세상 속도 30%)
    if (this.rollT > 0) { this.rollT -= dt; if (this.rollT <= 0) { this.rollT = 0; MUS.slow = false; } }
    const wsT = this.rollT > 0 ? 0.3 : 1;
    this.ws += (wsT - this.ws) * Math.min(1, dt * 8);
    let ws = this.state === 'crashing' ? 0.15 : this.ws;
    if (this.hitStop > 0) { this.hitStop -= dt; ws *= 0.12; }
    this.recoil = Math.max(0, this.recoil - dt * 9);
    if (this.refT > 0) this.refT -= dt;

    if (this.state === 'play') {
      if (!S.started) { S.introT -= dt; if (S.introT <= 0) S.started = true; }
      else {
        S.t += dt;
        if (!S.def.boss) {
          S.u = Math.min(1, S.u + (dt * ws) / S.def.dur);
          this.spawnFromQueue();
          if (S.u >= 1 && !S.queue.some((q) => q.type !== 'hotfix') && !this.bugs.some((b) => b.type !== 'hotfix')) this.stageClear();
          if (!S.rush && S.u >= 0.7) { // 클라이맥스
            S.rush = true; UI.banner('BUG RUSH', '버그가 몰려와요!', 1.8); SND.play('rush'); MUS.tempoMul = 0.82;
          }
        }
      }
      // 누르고 있으면 연사
      if (this.ptr.down) this.fire(false);
      // 화면 고장 타이머
      for (const g of this.glitches) g.t -= dt;
      this.glitches = this.glitches.filter((g) => g.t > 0);
    }
    // 카메라
    if (S.def.boss) {
      this.bossAng += dt * ws * 0.05;
      const R = 24;
      this.camera.position.set(Math.sin(this.bossAng) * R, 3 + Math.sin(this.time * 0.5) * 0.3, Math.cos(this.bossAng) * R);
      this.look.set(0, 5.5, 0);
    } else {
      const P = World.curve.getPointAt(S.u), T = World.curve.getTangentAt(S.u);
      this.camera.position.set(P.x, 1.7 + Math.sin(S.u * World.len * 1.3) * 0.04, P.z);
      const tgt = V1.copy(P).addScaledVector(T, 7); tgt.y = 1.6;
      this.look.lerp(tgt, Math.min(1, dt * 3));
    }
    this.camera.lookAt(this.look);
    if (this.shake > 0.002) {
      const k = this.shake * (settings.reduceFlash ? 0.4 : 1);
      this.camera.position.x += (Math.random() - 0.5) * k; this.camera.position.y += (Math.random() - 0.5) * k;
      this.camera.rotation.z += (Math.random() - 0.5) * k * 0.05;
      this.shake *= Math.exp(-dt * 12);
    }
    this.updateCamBasis();

    // 엔티티
    if (S.def.boss && S.started) Boss.update(dt, ws);
    else if (S.def.boss) Boss.update(0, 0);
    for (const b of this.bugs) if (b.alive) b.update(dt, ws);
    this.bugs = this.bugs.filter((b) => b.alive);
    this.project();
    if (this.state === 'play') this.check404(dt);

    // 진행률 → 색·음악
    const ratio = clamp(S.fixed / S.expected, 0, 1);
    S.ratio = ratio;
    World.update(dt, this.state === 'clearing' ? 1 : ratio);
    if (this.state === 'play') MUS.layer = ratio >= 0.999 ? 4 : Math.floor(ratio * 4 + 0.0001);

    // 보스 정상화 연출 → 클리어
    if (S.def.boss && Boss.ending && this.state === 'play') {
      S.bossEndT = (S.bossEndT || 0) + dt;
      if (S.bossEndT > 3.2) this.stageClear();
    }
    if (this.state === 'crashing') {
      this.crashT += dt;
      FX.u.tear = Math.min(1, FX.u.tear + dt * 3);
      if (this.crashT > 1.3) { this.state = 'crashed'; this.clearEntities(); UI.showCrash(); }
    }
    if (this.state === 'clearing') {
      this.clearT += dt;
      FX.u.wipeOn = 1; FX.u.wipe = clamp((this.clearT - 0.3) / 1.6, 0, 1); // 고치기 전/후 슬라이드
      if (this.clearT > 2.4) { FX.u.wipeOn = 0; this.state = 'cleared'; S.idx >= 4 ? UI.showResult() : UI.showClear(); }
    }
  },
  project() {
    const cam = this.camera, W = this.W, H = this.H, k = H / 2 / this.tanHalf;
    for (const b of this.bugs) {
      _proj.copy(b.pos).project(cam);
      b.behind = _proj.z > 1;
      b.onScreen = _proj.z < 1 && Math.abs(_proj.x) < 1.3 && Math.abs(_proj.y) < 1.3;
      b.dist = b.pos.distanceTo(cam.position);
      b.sx = (_proj.x + 1) / 2 * W; b.sy = (1 - _proj.y) / 2 * H;
      const d = Math.max(0.5, b.pos.distanceTo(cam.position));
      b.sr = (b.spr.scale.x / 2) / d * k;
    }
    if (this.S.def.boss) for (const sn of Boss.snakes) for (const s of sn.segs) {
      _proj.copy(s.pos).project(cam);
      s.onScreen = _proj.z < 1;
      s.sx = (_proj.x + 1) / 2 * W; s.sy = (1 - _proj.y) / 2 * H;
      const d = Math.max(0.5, s.pos.distanceTo(cam.position));
      s.sw = (s.mesh.scale.x / 2) / d * k; s.sh = (s.mesh.scale.y / 2) / d * k;
    }
  },
  check404(dt) {
    for (const b of this.bugs) {
      if (b.type !== 'e404' || !b.alive) continue;
      let over = false;
      if (this.ptr.has && (this.ptr.down || !IS_TOUCH)) {
        let x = this.ptr.x, y = this.ptr.y;
        if (this.hasGlitch('slip')) { x += this.slip.x; y += this.slip.y; }
        over = Math.hypot(b.sx - x, b.sy - y) < b.sr + 22;
      }
      b.hover = over ? b.hover + dt : Math.max(0, b.hover - dt * 0.5);
      if (b.hover >= 1) { // 근처로 순간이동
        b.hover = 0;
        PFX.spark(b.pos, [1, 0.54, 0.24], 10, 4);
        b.pos.addScaledVector(this.camR, (RNG() < 0.5 ? -1 : 1) * rnd(3, 5)).addScaledVector(this.camU, rnd(-1.2, 1.5));
        b.pos.addScaledVector(this.camF, 2);
        b.ox = -b.ox;
        this.run.st.tele++;
        SND.play('tele');
        this.pop(b.sx, b.sy, '404!', '#FF8A3D');
      }
    }
  },
  updateFX(dt) {
    const k = Math.min(1, dt * 10);
    const play = this.state === 'play';
    if (this.state !== 'crashing') FX.u.tear += ((play && this.hasGlitch('tear') ? 1 : 0) - FX.u.tear) * k;
    FX.u.inv += ((play && this.hasGlitch('inv') ? 1 : 0) - FX.u.inv) * k;
    FX.u.pix += ((play && this.hasGlitch('pix') ? 1 : 0) - FX.u.pix) * k;
    FX.u.slow += ((this.rollT > 0 ? 1 : 0) - FX.u.slow) * k;
    FX.u.hit = Math.max(0, FX.u.hit - dt * 2.2);
    const flip = play && this.hasGlitch('flip');
    if (flip !== this.hudFlipped) { this.hudFlipped = flip; $('#hud').classList.toggle('flipped', flip); }
  },
  drawGun(g) {
    this.loadGunAssets();
    const fp = this.fpLayout();
    if (fp) {
      g.save(); g.imageSmoothingEnabled = true;
      if (fp.flip) { g.translate(fp.x + fp.w, fp.y); g.scale(-1, 1); g.drawImage(fp.im, 0, 0, fp.w, fp.h); }
      else g.drawImage(fp.im, fp.x, fp.y, fp.w, fp.h);
      g.restore();
      if (this.recoil > 0.5) { // 총구 빛
        const m = fp.muzzle, r = fp.w * 0.09 * this.recoil;
        const gr = g.createRadialGradient(m.x, m.y, 0, m.x, m.y, r);
        gr.addColorStop(0, 'rgba(255,255,230,.95)'); gr.addColorStop(0.4, this.weapon === 1 ? 'rgba(255,211,77,.8)' : 'rgba(198,244,50,.8)'); gr.addColorStop(1, 'rgba(198,244,50,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(m.x, m.y, r, 0, 6.283); g.fill();
      }
      return;
    }
    const p = this.gunPivot(), a = this.aimPoint(), L = this.gunLen();
    const ang = Math.atan2(a.y - p.y, a.x - p.x);
    const img = this.gunImgs[this.weapon === 1 && this.refReady() ? 1 : 0];
    const h = L * img.height / img.width;
    g.save(); g.translate(p.x, p.y); g.rotate(ang);
    if (Math.cos(ang) < 0) g.scale(1, -1);
    g.imageSmoothingEnabled = false;
    const back = this.recoil * L * 0.08;
    g.drawImage(img, -L * 0.2 - back, -h * 0.55, L, h);
    if (this.recoil > 0.6) { // 총구 불꽃
      g.fillStyle = this.weapon === 1 ? '#FFD34D' : '#E6FF7A';
      const mx = L * 0.8 - back;
      g.fillRect(mx, -h * 0.25, L * 0.06, h * 0.3); g.fillRect(mx + L * 0.02, -h * 0.4, L * 0.02, h * 0.6);
    }
    g.restore();
  },
  pop(x, y, txt, col) { this.pops.push({ x, y, txt, col, t: 0 }); },

  // ----- 2D 오버레이: 조준선·탄 궤적·점수·이름표 -----
  draw2D(dt) {
    const g = this.g2, W = this.W, H = this.H;
    g.clearRect(0, 0, W, H);
    const inGame = this.state === 'play' || this.state === 'crashing' || this.state === 'clearing';
    if (!inGame) { this.tracers = []; this.pops = []; return; }
    // 탄 궤적
    for (const t of this.tracers) {
      t.t += dt;
      const a = 1 - t.t / 0.12;
      if (a <= 0) continue;
      g.strokeStyle = `rgba(198,244,50,${a})`; g.lineWidth = t.w;
      g.beginPath(); g.moveTo(t.x0, t.y0); g.lineTo(t.x1, t.y1); g.stroke();
      g.fillStyle = `rgba(230,255,140,${a})`; g.fillRect(t.x1 - 5, t.y1 - 5, 10, 10);
    }
    this.tracers = this.tracers.filter((t) => t.t < 0.12);
    if (this.state === 'play' || this.state === 'clearing') this.drawGun(g);
    // 404 겹침 게이지
    for (const b of this.bugs) {
      if (b.type === 'e404' && b.hover > 0.05 && b.onScreen) {
        g.strokeStyle = '#FF8A3D'; g.lineWidth = 3; g.beginPath();
        g.arc(b.sx, b.sy, b.sr + 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, b.hover)); g.stroke();
      }
      if (b.label && b.onScreen) {
        g.font = 'bold 13px ui-monospace,Menlo,monospace'; g.textAlign = 'center';
        const tw = g.measureText('NEW · ' + b.label).width + 14;
        g.fillStyle = 'rgba(14,16,13,.85)'; g.fillRect(b.sx - tw / 2, b.sy - b.sr - 30, tw, 20);
        g.fillStyle = '#FFD34D'; g.fillText('NEW · ' + b.label, b.sx, b.sy - b.sr - 15);
      }
    }
    // 가까운 버그 경고 + 화면 밖 버그 방향 화살표
    for (const b of this.bugs) {
      if (!b.alive || b.type === 'hotfix' || b.dist == null) continue;
      const inView = !b.behind && b.sx > 0 && b.sx < W && b.sy > 0 && b.sy < H;
      if (inView && b.dist < 7 && (b.type !== 'ghost' || b.vis)) {
        if (!b.warned && this.state === 'play') { b.warned = true; SND.play('warn'); }
        const pulse = 0.5 + 0.5 * Math.sin(this.time * 22);
        g.strokeStyle = `rgba(255,77,94,${0.5 + pulse * 0.5})`; g.lineWidth = 3;
        g.beginPath(); g.arc(b.sx, b.sy, b.sr + 6 + pulse * 4, 0, 6.283); g.stroke();
        g.font = 'bold 22px ui-monospace,Menlo,monospace'; g.textAlign = 'center';
        g.fillStyle = '#000'; g.fillText('!', b.sx + 2, b.sy - b.sr - 8); g.fillStyle = '#FF4D5E'; g.fillText('!', b.sx, b.sy - b.sr - 10);
      } else if (!inView && b.dist < 22 && this.state === 'play') {
        let dx = b.sx - W / 2, dy = b.sy - H / 2;
        if (b.behind) { dx = -dx; dy = -dy; }
        const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
        const m = 34, sc = Math.min((W / 2 - m) / Math.max(1e-3, Math.abs(dx)), (H / 2 - m) / Math.max(1e-3, Math.abs(dy)));
        const x = W / 2 + dx * sc, y = H / 2 + dy * sc, a = Math.atan2(dy, dx);
        const al = clamp(1.3 - b.dist / 22, 0.35, 1);
        g.save(); g.translate(x, y); g.rotate(a);
        g.fillStyle = `rgba(255,77,94,${al})`; g.beginPath(); g.moveTo(16, 0); g.lineTo(-8, -11); g.lineTo(-8, 11); g.closePath(); g.fill();
        g.strokeStyle = '#000'; g.lineWidth = 2; g.stroke(); g.restore();
      }
    }
    // 보스 오류 줄 체력 칸
    if (this.S && this.S.def.boss && !Boss.ending) for (const s of Boss.targets()) {
      if (!s.onScreen || !s.snake.real || !s.maxHp) continue;
      for (let k = 0; k < s.maxHp; k++) { g.fillStyle = k < s.hp ? '#FF4D5E' : '#3a3f37'; g.fillRect(s.sx - s.maxHp * 6 + k * 12, s.sy - s.sh - 12, 9, 6); }
    }
    // 점수 팝업
    g.textAlign = 'center';
    for (const p of this.pops) {
      p.t += dt;
      const a = 1 - p.t / 0.8;
      if (a <= 0) continue;
      g.font = 'bold 16px ui-monospace,Menlo,monospace';
      g.globalAlpha = a; g.fillStyle = '#000'; g.fillText(p.txt, p.x + 2, p.y - p.t * 40 + 2);
      g.fillStyle = p.col; g.fillText(p.txt, p.x, p.y - p.t * 40); g.globalAlpha = 1;
    }
    this.pops = this.pops.filter((p) => p.t < 0.8);
    // 조준선
    if (this.state === 'play') {
      let x = this.ptr.x, y = this.ptr.y;
      const slip = this.hasGlitch('slip');
      if (slip) { x += this.slip.x + Math.sin(this.time * 30) * 3; y += this.slip.y; }
      if (!IS_TOUCH && this.ptr.has) {
        const col = slip ? '#FF4D5E' : '#C6F432';
        g.strokeStyle = col; g.lineWidth = 2;
        g.beginPath(); g.arc(x, y, 14, 0, 6.283); g.stroke();
        g.beginPath(); g.moveTo(x - 22, y); g.lineTo(x - 8, y); g.moveTo(x + 8, y); g.lineTo(x + 22, y);
        g.moveTo(x, y - 22); g.lineTo(x, y - 8); g.moveTo(x, y + 8); g.lineTo(x, y + 22); g.stroke();
        g.fillStyle = col; g.fillRect(x - 1.5, y - 1.5, 3, 3);
        if (this.weapon === 1 && this.refReady()) { g.globalAlpha = 0.35; const span = Math.min(W, H) * 0.07; for (let i = -3; i <= 3; i++) g.fillRect(x + i * span - 2, y + Math.abs(i) * span * 0.18 - 2, 4, 4); g.globalAlpha = 1; }
      }
      for (const t of this.taps) {
        t.t += dt; const a = 1 - t.t / 0.35; if (a <= 0) continue;
        g.strokeStyle = `rgba(198,244,50,${a})`; g.lineWidth = 2;
        g.beginPath(); g.arc(t.x + (slip ? this.slip.x : 0), t.y + (slip ? this.slip.y : 0), 10 + t.t * 90, 0, 6.283); g.stroke();
      }
      this.taps = this.taps.filter((t) => t.t < 0.35);
    }
    if (this.rollT > 0) {
      g.font = 'bold 18px ui-monospace,Menlo,monospace'; g.textAlign = 'center'; g.fillStyle = '#6fe7ff';
      g.fillText('◀◀ ROLLBACK ' + this.rollT.toFixed(1), W / 2, H * 0.22);
    }
  },
};
