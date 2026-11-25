// ---------- 소리 (Web Audio 직접 합성) ----------
const SND = {
  ctx: null, master: null, sfxG: null, musG: null, noise: null,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
      this.sfxG = this.ctx.createGain(); this.sfxG.connect(this.master);
      this.musG = this.ctx.createGain(); this.musG.connect(this.master);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.apply();
      this.loadSamples();
    } catch (e) { this.ctx = null; }
  },
  apply() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(settings.sound ? 0.9 : 0, t, 0.02);
    this.sfxG.gain.setTargetAtTime(settings.sfx * 0.55, t, 0.02);
    this.musG.gain.setTargetAtTime(settings.music * 0.42, t, 0.02);
  },
  tone(f, dur, type = 'square', vol = 0.3, f2 = null, when = 0, dest = null, attack = 0.004) {
    if (!this.ctx) return;
    const t = (when || this.ctx.currentTime);
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfxG);
    o.start(t); o.stop(t + dur + 0.02);
  },
  noiseHit(dur, vol = 0.3, ftype = 'highpass', freq = 2000, when = 0, dest = null) {
    if (!this.ctx) return;
    const t = when || this.ctx.currentTime;
    const s = this.ctx.createBufferSource(); s.buffer = this.noise;
    const f = this.ctx.createBiquadFilter(); f.type = ftype; f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.sfxG);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  },
  // assets/sfx_*.mp3|ogg|wav 가 있으면 그 소리를 씀
  bufs: {},
  loadSamples() {
    for (const k of ['sfx_shot', 'sfx_spread']) {
      const url = ASSETS[k]; if (!url || this.bufs[k]) continue;
      this.bufs[k] = 'loading';
      try {
        const bin = atob(url.split(',')[1]); const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        this.ctx.decodeAudioData(arr.buffer, (b) => { this.bufs[k] = b; }, () => { this.bufs[k] = null; });
      } catch (e) { this.bufs[k] = null; }
    }
  },
  sample(k, vol) {
    const b = this.bufs[k]; if (!b || b === 'loading') return false;
    const s = this.ctx.createBufferSource(), g = this.ctx.createGain();
    s.buffer = b; s.playbackRate.value = 0.96 + Math.random() * 0.08; g.gain.value = vol;
    s.connect(g); g.connect(this.sfxG); s.start(); return true;
  },
  play(name, p = 0) {
    if (!this.ctx || !settings.sound) return;
    const now = this.ctx.currentTime;
    switch (name) {
      case 'shot': // 패치 탄: 딸깍 + 뿅 하강 + 낮은 쿵 + 디지털 꼬리
        if (this.sample('sfx_shot', 0.9)) break;
        this.noiseHit(0.025, 0.22, 'highpass', 4500);
        this.tone(1900, 0.075, 'square', 0.11, 420);
        this.tone(190, 0.09, 'sine', 0.3, 55);
        this.tone(2637, 0.05, 'triangle', 0.05, 2093, now + 0.035);
        break;
      case 'spread': // 리팩터: 묵직한 확산음 + 7발 틱
        if (this.sample('sfx_spread', 1)) break;
        this.noiseHit(0.16, 0.32, 'bandpass', 1400);
        this.tone(760, 0.16, 'sawtooth', 0.13, 150);
        this.tone(130, 0.18, 'sine', 0.4, 42);
        for (let i = 0; i < 7; i++) this.tone(2200 + i * 180, 0.03, 'square', 0.04, null, now + 0.02 + i * 0.012);
        break;
      case 'hit': { const m = 1 + Math.min(p, 20) * 0.035; this.tone(1568 * m, 0.18, 'triangle', 0.26); this.tone(2093 * m, 0.22, 'sine', 0.16, null, now + 0.05); break; } // 맑은 띵 (연속일수록 음이 올라감)
      case 'perfect': this.tone(3136, 0.16, 'sine', 0.14, null, now + 0.04); this.tone(4186, 0.2, 'sine', 0.1, null, now + 0.1); break;
      case 'warn': this.tone(880, 0.06, 'square', 0.07); this.tone(660, 0.06, 'square', 0.07, null, now + 0.08); break;
      case 'pickup': [0, 4, 7, 12, 16, 19].forEach((s, i) => this.tone(659 * Math.pow(2, s / 12), 0.1, 'triangle', 0.14, null, now + i * 0.045)); break;
      case 'rush': this.tone(220, 0.25, 'sawtooth', 0.2, 440); this.tone(330, 0.25, 'sawtooth', 0.15, 660, now + 0.25); this.noiseHit(0.3, 0.15, 'bandpass', 900, now + 0.1); break;
      case 'split': for (let i = 0; i < 3; i++) this.noiseHit(0.05, 0.25, 'bandpass', 2500 + i * 900, now + i * 0.04); this.tone(600, 0.1, 'square', 0.1, 1200); break; // 지직
      case 'tele': this.tone(300, 0.14, 'sine', 0.3, 1800); this.tone(1800, 0.08, 'sine', 0.12, 2600, now + 0.12); break; // 뿅
      case 'glitch': this.noiseHit(0.35, 0.35, 'bandpass', 1200); this.tone(120, 0.3, 'sawtooth', 0.18, 60); break; // 잡음
      case 'combo': [0, 4, 7, 12].forEach((s, i) => this.tone(523 * Math.pow(2, s / 12), 0.12, 'square', 0.12, null, now + i * 0.06)); break; // 올라가는 음
      case 'deflect': this.tone(2400, 0.05, 'square', 0.1, 1800); this.noiseHit(0.04, 0.12, 'highpass', 5000); break;
      case 'rollback': this.tone(900, 0.5, 'sawtooth', 0.12, 220); this.tone(1200, 0.5, 'sine', 0.1, 300); break;
      case 'unlock': [0, 7, 12, 16, 19].forEach((s, i) => this.tone(440 * Math.pow(2, s / 12), 0.16, 'triangle', 0.16, null, now + i * 0.07)); break;
      case 'click': this.tone(660, 0.04, 'square', 0.08); break;
      case 'crash': this.noiseHit(0.9, 0.45, 'lowpass', 900); this.tone(220, 0.9, 'sawtooth', 0.25, 30); break;
      case 'clear': [0, 4, 7, 12, 16].forEach((s, i) => this.tone(523 * Math.pow(2, s / 12), 0.22, 'square', 0.12, null, now + i * 0.09)); break;
      case 'success': [0, 4, 7, 12, 7, 12, 16, 19, 24].forEach((s, i) => this.tone(392 * Math.pow(2, s / 12), 0.2, i % 2 ? 'triangle' : 'square', 0.13, null, now + i * 0.1)); break;
      case 'phase': this.tone(110, 0.6, 'sawtooth', 0.25, 55); this.noiseHit(0.5, 0.2, 'lowpass', 600); break;
      case 'spawn': this.tone(200 + p * 40, 0.05, 'square', 0.05, 400); break;
    }
  },
};

// 쌓이는 음악: 드럼 → 베이스 → 화음 → 멜로디 → 전체 합주
const MUS = {
  on: false, step: 0, next: 0, timer: null, tempo: 112, layer: 0, boss: false, crash: false,
  tempoMul: 1, pitchMul: 1, slow: false, keyRoot: 220, minor: false, mel: [], prog: [0, 5, 3, 4],
  start(stageIdx, seed) {
    if (!SND.ctx) return;
    this.stop();
    const roots = [220, 196, 174.6, 233.1, 164.8];
    this.keyRoot = roots[stageIdx % 5];
    this.boss = stageIdx === 4; this.minor = stageIdx >= 2;
    this.tempo = this.boss ? 152 : 108 + stageIdx * 6;
    this.prog = this.boss ? [0, 0, 5, 6] : this.minor ? [0, 5, 3, 4] : [0, 3, 4, 3];
    const r = mulberry32(seed + stageIdx * 31);
    this.mel = []; for (let i = 0; i < 32; i++) this.mel.push(r() < 0.55 ? Math.floor(r() * 7) : null);
    this.layer = 0; this.crash = false; this.tempoMul = 1; this.pitchMul = 1; this.slow = false;
    this.step = 0; this.next = SND.ctx.currentTime + 0.08; this.on = true;
    SND.musG.gain.cancelScheduledValues(SND.ctx.currentTime);
    SND.apply();
    this.timer = setInterval(() => this.tick(), 25);
  },
  stop() { this.on = false; if (this.timer) clearInterval(this.timer); this.timer = null; },
  crashStop() { // 늘어지며 멈춤
    if (!this.on || !SND.ctx) return;
    this.crash = true;
    const t = SND.ctx.currentTime;
    SND.musG.gain.setTargetAtTime(0, t + 0.3, 0.45);
    setTimeout(() => { this.stop(); SND.apply(); }, 2200);
  },
  note(deg, oct) {
    const sc = this.minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
    const o = Math.floor(deg / 7), d = ((deg % 7) + 7) % 7;
    return this.keyRoot * Math.pow(2, (sc[d] + 12 * (o + oct)) / 12) * this.pitchMul;
  },
  tick() {
    if (!this.on || !SND.ctx) return;
    while (this.next < SND.ctx.currentTime + 0.12) {
      this.playStep(this.step, this.next);
      let dt = 60 / this.tempo / 4 * this.tempoMul * (this.slow ? 1.7 : 1);
      if (this.crash) { this.tempoMul *= 1.09; this.pitchMul *= 0.965; }
      this.next += dt; this.step++;
    }
  },
  playStep(s, t) {
    const st = s % 16, bar = Math.floor(s / 16) % 4, chord = this.prog[bar];
    const D = SND.musG, sl = this.slow ? 0.84 : 1;
    // 드럼 (항상)
    if (st % 4 === 0 && (this.boss || st === 0 || st === 8 || (st === 12 && bar % 2))) SND.tone(140, 0.16, 'sine', 0.55, 40, t, D, 0.002);
    if (st === 4 || st === 12) SND.noiseHit(0.12, 0.22, 'bandpass', 1800, t, D);
    if (st % 2 === 1 || this.boss) SND.noiseHit(0.03, 0.08, 'highpass', 7000, t, D);
    // 베이스
    if (this.layer >= 1 && [0, 3, 6, 8, 11, 14].includes(st)) SND.tone(this.note(chord, -1) * sl, 0.16, 'triangle', 0.32, null, t, D);
    // 화음
    if (this.layer >= 2 && (st === 0 || st === 8)) for (const k of [0, 2, 4]) SND.tone(this.note(chord + k, 0) * sl, 0.5, 'square', 0.035, null, t, D, 0.02);
    // 멜로디
    if (this.layer >= 3) { const m = this.mel[(s % 32)]; if (m != null && st % 2 === 0) SND.tone(this.note(chord + m, 1) * sl, 0.18, 'square', 0.06, null, t, D); }
    // 전체 합주 (아르페지오)
    if (this.layer >= 4 && st % 2 === 1) SND.tone(this.note(chord + [0, 2, 4, 7][(st >> 1) % 4], 2) * sl, 0.1, 'triangle', 0.05, null, t, D);
  },
};
