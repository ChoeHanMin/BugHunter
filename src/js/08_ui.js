// ---------- 화면 · HUD ----------
const SCREENS = ['#scrTitle', '#scrHow', '#scrDiff', '#scrPause', '#scrSettings', '#scrRecords', '#scrClear', '#scrCrash', '#scrResult'];
const CHALLENGES = [
  ['release', '정식 출시 등급 받기'],
  ['nocrash', '무사고 (크래시 0회로 클리어)'],
  ['norollback', '롤백 없이 클리어'],
  ['acc90', '정확도 90% 이상으로 클리어'],
  ['blast5', '리팩터 한 방에 복제 버그 5마리'],
  ['boss90', '보스를 1분 30초 안에 정상화'],
  ['hard', '난이도 상 클리어'],
  ['hardrelease', '난이도 상에서 정식 출시'],
];
const UI = {
  pendingDaily: false, setReturn: null, _hud: {},
  init() {
    $('#verBadge').textContent = DAILY_VER;
    if (ASSETS.logo) $('#logo').innerHTML = `<img class="logoimg" src="${ASSETS.logo}" alt="BUG HUNTER">`;
    const c1 = bugImgCanvas('basic'); $('#howPic1').append(c1); const hand = document.createElement('div'); hand.className = 'hand'; hand.textContent = IS_TOUCH ? '👆' : '🖱️'; $('#howPic1').append(hand);
    $('#howPic2').append(bugImgCanvas('clone'));
    $('#crashBug').append(bugImgCanvas('basic'));
    const click = (id, fn) => $(id).addEventListener('click', (e) => { SND.init(); SND.play('click'); fn(e); });
    click('#btnStart', () => this.start(false));
    click('#btnDaily', () => this.start(true));
    click('#btnRecords', () => this.showRecords());
    click('#btnSettings', () => this.showSettings('#scrTitle'));
    click('#btnHowGo', () => this.afterHow());
    click('#btnHowSkip', () => this.afterHow());
    click('#btnDiffBack', () => this.only('#scrTitle'));
    $$('.dcard').forEach((b) => b.addEventListener('click', () => { SND.init(); SND.play('click'); Store.set('diff', b.dataset.d); this.only(); Game.newRun(this.pendingDaily, b.dataset.d); }));
    click('#btnResume', () => this.resume());
    click('#btnPauseSet', () => this.showSettings('#scrPause'));
    click('#btnRestartStage', () => { this.only(); Game.state = 'play'; if (SND.ctx) SND.ctx.resume(); Game.restoreSnapshot(); Game.startStage(Game.run.stage); });
    click('#btnToTitle', () => { if (SND.ctx) SND.ctx.resume(); Game.toTitle(); });
    click('#btnSetBack', () => { this.only(this.setReturn || '#scrTitle'); });
    click('#btnRecBack', () => this.only('#scrTitle'));
    click('#btnNext', () => { this.only(); Game.nextStage(); });
    click('#btnRebuild', () => { this.only(); Game.rebuild(); });
    click('#btnCrashTitle', () => Game.toTitle());
    click('#btnCopy', () => this.copyNote());
    click('#btnAgain', () => { this.pendingDaily = !!(Game.run && Game.run.daily); this.only(); Game.newRun(this.pendingDaily, Game.run ? Game.run.diff : 'normal'); });
    click('#btnResTitle', () => Game.toTitle());
    $('#pauseBtn').addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); SND.init(); this.pause(); });
    // 설정
    const s = settings;
    $('#setSound').checked = s.sound; $('#setSfx').value = s.sfx * 100; $('#setMusic').value = s.music * 100;
    $('#setFlash').checked = s.reduceFlash; $('#setQuality').value = s.quality;
    $('#setSound').addEventListener('change', (e) => { s.sound = e.target.checked; SND.apply(); saveSettings(); });
    $('#setSfx').addEventListener('input', (e) => { s.sfx = e.target.value / 100; SND.apply(); saveSettings(); });
    $('#setSfx').addEventListener('change', () => SND.play('hit'));
    $('#setMusic').addEventListener('input', (e) => { s.music = e.target.value / 100; SND.apply(); saveSettings(); });
    $('#setFlash').addEventListener('change', (e) => { s.reduceFlash = e.target.checked; saveSettings(); });
    $('#setQuality').addEventListener('change', (e) => { s.quality = e.target.value; FX.setQuality(); saveSettings(); });
  },
  only(id) { for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id); },
  showTitle() { this.only('#scrTitle'); $('#hud').classList.add('hidden'); this.hint(''); $('#banner').classList.add('hidden'); },
  showHUD() {
    this.only(); $('#hud').classList.remove('hidden');
    $('#stageLbl').innerHTML = 'STAGE ' + Game.S.def.id + ' · ' + Game.S.def.name + `<span class="diffchip" style="color:${Game.D.key === 'hard' ? '#FF4D5E' : '#aab2a3'}">${Game.D.name}</span>`;
    $('#helpBadge').classList.toggle('hidden', !Game.run.help[Game.run.stage]);
    this._hud = {};
  },
  start(daily) {
    this.pendingDaily = daily;
    if (!Store.get('seenHow', false)) { this.only('#scrHow'); return; }
    this.afterHow();
  },
  afterHow() { Store.set('seenHow', true); this.showDiff(); },
  showDiff() {
    $('#diffMode').textContent = this.pendingDaily ? '오늘의 빌드 ' + DAILY_VER : '정식 빌드';
    const last = Store.get('diff', 'normal');
    $$('.dcard').forEach((b) => b.classList.toggle('last', b.dataset.d === last));
    this.only('#scrDiff');
  },
  pause() {
    if (Game.state !== 'play') return;
    Game.state = 'paused'; Game.ptr.down = false;
    if (SND.ctx) SND.ctx.suspend();
    this.only('#scrPause');
  },
  resume() {
    this.only(); Game.state = 'play'; Game.last = performance.now();
    if (SND.ctx) SND.ctx.resume();
  },
  showSettings(ret) { this.setReturn = ret; this.only('#scrSettings'); },
  showRecords() {
    const rec = Store.get('records', {});
    const st = rec.stages || {};
    let h = '<table><tr><th>스테이지</th><th>최고 점수</th><th>최고 정확도</th></tr>';
    STAGES.forEach((d, i) => { const s = st[i]; h += `<tr><td>${d.id}. ${d.name}</td><td>${s ? s.score.toLocaleString() : '-'}</td><td>${s ? Math.round(s.acc * 100) + '%' : '-'}</td></tr>`; });
    h += '</table>';
    const daily = rec.daily && rec.daily.date === TODAY_KEY ? rec.daily.grade : '-';
    h += `<p style="font-size:13px">오늘의 빌드 <b style="color:var(--lime)">${DAILY_VER}</b> 최고 등급: <b>${daily}</b>` + (rec.best ? ` · 전체 최고 점수 <b>${rec.best.toLocaleString()}</b>` : '') + '</p>';
    const ch = rec.ch || {};
    h += '<div class="ch"><b>도전 과제</b>' + CHALLENGES.map(([k, n]) => `<span class="${ch[k] ? 'ok' : 'no'}">${ch[k] ? '✔' : '□'} ${n}</span>`).join('') + '</div>';
    $('#recBody').innerHTML = h;
    this.only('#scrRecords');
  },
  banner(a, b, dur, big) {
    const el = $('#banner'); el.querySelector('.b1').textContent = a; el.querySelector('.b2').textContent = b;
    el.classList.remove('hidden'); el.classList.toggle('big', !!big); Game.bannerT = dur;
  },
  hint(txt, dur = 0) {
    const el = $('#hint');
    if (!txt) { el.classList.add('hidden'); Game.hintT = 0; return; }
    el.textContent = txt; el.classList.remove('hidden'); Game.hintT = dur || 9999;
  },
  toast(txt) { const el = $('#toast'); el.textContent = txt; el.classList.remove('hidden'); Game.toastT = 1.8; },
  tick(dt) {
    if (Game.bannerT > 0) { Game.bannerT -= dt; if (Game.bannerT <= 0) $('#banner').classList.add('hidden'); }
    if (Game.hintT > 0 && Game.hintT < 9000) { Game.hintT -= dt; if (Game.hintT <= 0) $('#hint').classList.add('hidden'); }
    if (Game.toastT > 0) { Game.toastT -= dt; if (Game.toastT <= 0) $('#toast').classList.add('hidden'); }
    if (!Game.run || !Game.S || $('#hud').classList.contains('hidden')) return;
    this.clTick(dt);
    const r = Game.run, S = Game.S, H = this._hud;
    const set = (k, v, fn) => { if (H[k] !== v) { H[k] = v; fn(v); } };
    set('stab', Math.round(r.stab), (v) => { $('#stabFill').style.width = v + '%'; $('#stabFill').classList.toggle('low', v <= 30); $('#stabTxt').textContent = v + '%'; });
    set('prog', Math.round((S.ratio || 0) * 100), (v) => { $('#progFill').style.width = v + '%'; $('#progTxt').textContent = (S.def.boss ? `오류 줄 ${Boss.fixed}/16 · ` : '고친 비율 ') + v + '%'; });
    set('score', r.score, (v) => { $('#scoreTxt').textContent = v.toLocaleString(); });
    set('mult', Game.mult().toFixed(1), (v) => { const el = $('#comboTxt'); el.textContent = '연속 ×' + v; el.style.color = v === '2.0' ? '#FFD34D' : ''; });
    set('gl', Game.glitches.map((g) => g.type + Math.ceil(g.t)).join(), () => {
      $('#glitchList').innerHTML = Game.glitches.map((g) => `<div>⚠ ${GLITCH[g.type].name} ${Math.ceil(g.t)}s</div>`).join('');
    });
    set('w', Game.weapon + '|' + Game.unlocked(1) + Game.unlocked(2) + '|' + S.rb + '|' + (Game.rollT > 0), () => {
      $$('.wpn').forEach((b) => {
        const w = +b.dataset.w;
        b.classList.toggle('sel', w === Game.weapon);
        b.classList.toggle('locked', !Game.unlocked(w));
      });
      $('#rbCount').textContent = '×' + S.rb;
      $('.wpn.rb').classList.toggle('empty', S.rb <= 0);
      $('.wpn.rb').classList.toggle('on', Game.rollT > 0);
    });
    const cd = Game.refT > 0 ? Math.round((Game.refT / 3) * 100) : 0;
    set('cd', cd, (v) => { $('.wpn[data-w="1"] .cd').style.width = v + '%'; });
  },
  // ----- 패치 로그 (왼쪽 코드 창) -----
  clQ: [], clT: 0,
  codeStart(def) {
    $('#codeLogBody').innerHTML = ''; this.clQ = [];
    this.clPush([['cmd', `$ build stage${def.id}.${def.key} --watch`], ['trace', `  ${def.boss ? 'mainLoop()' : 'world'} 로딩 중…`], ['ok', '  ready. 버그 감시 시작']]);
  },
  clPush(lines) {
    this.clQ.push(...lines);
    if (this.clQ.length > 18) this.clQ.splice(0, this.clQ.length - 18); // 너무 밀리면 오래된 줄 건너뛰기
  },
  codeFix(type, seg) {
    const r = Math.random, P = (a) => a[Math.floor(r() * a.length)];
    const v = P(['player', 'enemy', 'tree', 'texture', 'camera', 'score', 'sound', 'saveData', 'mesh', 'input', 'npc', 'shader']);
    const m = P(['update', 'render', 'load', 'spawn', 'move', 'draw', 'sync', 'init', 'apply', 'reset']);
    const n = Math.floor(r() * 900 + 100);
    const T = {
      basic: [[`- ${v}.${m}(${v}.data);`, `+ ${v}?.${m}(${v}.data ?? {});`], [`- if (${v} = null) return;`, `+ if (${v} === null) return;`], [`- ${m}(${v}, undefinde);`, `+ ${m}(${v}, undefined);`]],
      clone: [[`- for (i = 0; i <= ${v}s.length; i++)`, `+ for (i = 0; i < ${v}s.length; i++)`], [`- copy(copy(${v}));`, `+ copy(${v});`]],
      mini: [[`- ${v}s.push(${v});`, `+ if (!${v}s.has(${v})) ${v}s.add(${v});`], [`- dup(${v});`, `+ // 중복 호출 제거`]],
      ghost: [[`- ${v}.alpha = undefined;`, `+ ${v}.alpha = 1.0;`], [`- ${v}.visible = Math.random() > .5;`, `+ ${v}.visible = true;`]],
      e404: [[`- fetch("/${v}.json")`, `+ fetch("/assets/${v}.json")`], [`- load("${v}_final_v2.png")`, `+ load("${v}.png")`]],
      loop: [[`- while (true) ${m}();`, `+ while (running) ${m}();`], [`- function ${m}() { ${m}(); }`, `+ function ${m}() { if (done) return; }`]],
      hotfix: [[`+ stability += 20;`, `+ glitches.clear();`]],
    };
    let pair = seg ? [`- ${CODE[seg.i][1].trim()}`, `+ ${CODE[seg.i][0].trim()}`] : P(T[type] || T.basic);
    const file = seg ? 'mainLoop' : type === 'hotfix' ? 'hotfix' : v;
    const lines = type === 'hotfix'
      ? [['cmd', '$ deploy hotfix --now'], ['add', '  ' + pair[0]], ['add', '  ' + pair[1]]]
      : [['cmd', `@@ ${file}.js:${n} @@`], ['del', pair[0]], ['add', pair[1]], ['cmd', `$ run ${file}.js`]];
    lines.push(['ok', `✔ Run Successfully (${Math.floor(r() * 40 + 3)}ms)`]);
    this.clPush(lines);
  },
  codeError(type) {
    const r = Math.random, P = (a) => a[Math.floor(r() * a.length)];
    const v = P(['player', 'world', 'camera', 'ui', 'physics', 'audio', 'render']);
    const msg = {
      basic: `TypeError: ${v}.update is not a function`, clone: `RangeError: ${v} 복제가 너무 많음`, mini: `Warning: 중복된 ${v} 발견`,
      trojan: `SecurityError: hotfix.exe 는 핫픽스가 아닙니다`,
      ghost: `ReferenceError: ${v} is not defined`, e404: `404 Not Found: /${v}.json`, loop: `RangeError: Maximum call stack size exceeded`,
    }[type] || `Error: ${v} 붕괴`;
    const code = String(Math.floor(r() * 1e6)).padStart(6, '0');
    this.clPush([['cmd', `$ run ${v}.js`], ['del', msg], ['trace', `    at ${v}.tick (${v}.js:${Math.floor(r() * 900 + 10)}:${Math.floor(r() * 80 + 1)})`], ['err', `✖ Run Error(0x${code})`]]);
  },
  clTick(dt) {
    if (!this.clQ.length) return;
    this.clT -= dt;
    let n = this.clQ.length > 8 ? 3 : 1; // 밀리면 빨리 찍기
    if (this.clT > 0) return;
    this.clT = 0.035;
    const body = $('#codeLogBody');
    while (n-- > 0 && this.clQ.length) {
      const [cls, txt] = this.clQ.shift();
      const d = document.createElement('div'); d.className = cls; d.textContent = txt;
      body.appendChild(d);
      while (body.children.length > 14) body.removeChild(body.firstChild);
    }
  },
  showClear() {
    const r = Game.run, i = Game.S.idx, res = r.stageRes[i];
    $('#clrTitle').textContent = `패치 완료 ${i + 1}/5`;
    $('#clrStats').innerHTML = [
      ['스테이지', STAGES[i].name], ['고친 버그', res.fixed + '마리'], ['정확도', Math.round(res.acc * 100) + '%'],
      ['걸린 시간', fmtTime(res.time)], ['시간 보너스', '+' + res.timeBonus.toLocaleString()], ['안정성 회복', '+30% → ' + Math.round(r.stab) + '%'],
    ].map(([k, v]) => `<span class="k">${k}</span><span class="v">${v}</span>`).join('') + `<span class="k full">총점</span><span class="v full">${r.score.toLocaleString()}</span>`;
    $('#btnNext').textContent = i === 3 ? '보스 "메인 루프" ▶' : '다음 스테이지 ▶';
    this.only('#scrClear');
  },
  showCrash() {
    $('#hud').classList.add('hidden'); this.hint('');
    const msgs = [
      '버그 헌터가 버그에게 졌습니다. 아이러니하네요.',
      '안정성이 0%가 되어 세상이 잠시 멈췄습니다.',
      '버그를 잡으러 왔다가 버그가 되었습니다.',
      'Ctrl+Z를 눌렀지만 아무 일도 일어나지 않았습니다.',
      '이 오류는 개발자도 처음 봅니다. (진짜예요)',
      '버그들이 축하 파티를 열고 있습니다.',
    ];
    $('#crashMsg').textContent = pick(msgs, Math.random);
    const r = Game.run, help = r.help[r.stage];
    $('#crashCode').textContent =
      `ERR_TOO_MANY_BUGS  (0xB06${r.stage + 1}${r.st.crashes % 10})\n` +
      `at stage${r.stage + 1}.${STAGES[r.stage].key}()\n` +
      `at bugHunter.patch(stability = 0%)\n\n` +
      `> 이 스테이지 처음부터 다시 빌드합니다. 판 전체는 유지돼요.` +
      (help ? `\n> 연속 크래시 감지: 도움 모드 ON (버그 속도 -15%)` : '');
    this.only('#scrCrash');
  },
  grade() {
    const r = Game.run, acc = r.st.shots ? r.st.hits / r.st.shots : 0;
    if (r.help.some((x) => x)) return '출시 연기';
    if (acc >= 0.7 && r.st.crashes === 0 && r.stab >= 50) return '정식 출시';
    if (acc >= 0.5 && r.st.crashes <= 2) return '베타';
    return '알파';
  },
  showResult() {
    const r = Game.run;
    MUS.startTitle();
    $('#hud').classList.add('hidden'); this.hint('');
    const stabBonus = Math.round(r.stab) * 10;
    if (!r.finalized) { r.score += stabBonus; r.finalized = true; r.stabBonus = stabBonus; }
    const acc = r.st.shots ? r.st.hits / r.st.shots : 0;
    const grade = this.grade(); r.grade = grade;
    $('#resMode').textContent = (r.daily ? '오늘의 빌드 ' + DAILY_VER : '정식 빌드') + ' · 난이도 ' + Game.D.name;
    $('#resGrade').textContent = grade;
    const f = r.st.fixed;
    $('#resStats').innerHTML = [
      ['총점', r.score.toLocaleString()], ['정확도', Math.round(acc * 100) + '%'], ['크래시', r.st.crashes + '회'], ['남은 안정성', Math.round(r.stab) + '% (+' + r.stabBonus.toLocaleString() + ')'],
      ['기본 / 복제 / 작은 복제', `${f.basic} / ${f.clone} / ${f.mini}`], ['투명 / 404 / 무한루프', `${f.ghost} / ${f.e404} / ${f.loop}`],
      ['보스 오류 줄', f.boss + '/16 · ' + fmtTime(r.st.bossTime)], ['최대 연속 패치', r.maxStreak + '회'], ['PERFECT / 핫픽스', `${r.st.perfect} / ${r.st.hotfix}`],
    ].map(([k, v]) => `<span class="k">${k}</span><span class="v">${v}</span>`).join('');
    const note = this.patchNote(grade, acc);
    $('#resNote').textContent = note; $('#resNoteTa').value = note;
    $('#resNoteTa').classList.add('hidden'); $('#resNote').classList.remove('hidden');
    $('#btnCopy').textContent = '패치 노트 복사';
    // 기록 · 도전 과제
    const rec = Store.get('records', {});
    rec.best = Math.max(rec.best || 0, r.score);
    if (r.daily) {
      const cur = rec.daily && rec.daily.date === TODAY_KEY ? rec.daily.grade : null;
      if (!cur || GRADES.indexOf(grade) < GRADES.indexOf(cur)) rec.daily = { date: TODAY_KEY, grade };
    }
    rec.ch = rec.ch || {};
    const got = [];
    const earn = (k, ok) => { if (ok && !rec.ch[k]) { rec.ch[k] = true; got.push(CHALLENGES.find((c) => c[0] === k)[1]); } };
    earn('release', grade === '정식 출시');
    earn('nocrash', r.st.crashes === 0);
    earn('norollback', r.st.rollbacks === 0);
    earn('acc90', acc >= 0.9);
    earn('blast5', r.st.blastMax >= 5);
    earn('boss90', r.st.bossTime > 0 && r.st.bossTime <= 90);
    earn('hard', r.diff === 'hard');
    earn('hardrelease', r.diff === 'hard' && grade === '정식 출시');
    Store.set('records', rec);
    $('#resChal').textContent = got.length ? '🏆 새 도전 과제: ' + got.join(', ') : '';
    this.only('#scrResult');
  },
  patchNote(grade, acc) {
    const r = Game.run, st = r.st, f = st.fixed;
    const rr = mulberry32(r.score + st.shots);
    const ver = r.daily ? DAILY_VER : 'v1.0.' + st.crashes;
    const kinds = [['기본', f.basic], ['복제', f.clone + f.mini], ['투명', f.ghost], ['404', f.e404], ['무한루프', f.loop]].sort((a, b) => b[1] - a[1]);
    const lines = [`${kinds[0][0]} 버그 ${kinds[0][1]}마리 수정`];
    const glName = { tear: '화면 찢어짐', inv: '색 반전', flip: '화면 뒤집힘', slip: '조준 미끄러짐', pix: '픽셀화' };
    const topG = Object.entries(st.glitch).sort((a, b) => b[1] - a[1])[0];
    const total = Object.values(f).reduce((a, b) => a + b, 0);
    const miss = st.shots - st.hits;
    const pool = [];
    const add = (cond, txt, w = 1) => { if (cond) pool.push([txt, w + rr()]); };
    add(topG[1] > 0, `${glName[topG[0]]} 버그를 ${topG[1]}회 경험했습니다 (죄송합니다)`, 3);
    add(st.bossTime > 0, `메인 루프를 ${Math.floor(st.bossTime / 60)}분 ${Math.round(st.bossTime % 60)}초 만에 정상화`, 4);
    add(st.crashes > 0, `크래시 ${st.crashes}회 후 재빌드 성공 (끈기 +1)`, 2);
    add(st.crashes === 0, '크래시 0회 — 이번 빌드는 놀랍도록 안정적입니다', 2);
    add(true, `정확도 ${Math.round(acc * 100)}% — 손 떨림 패치 ${acc >= 0.9 ? '불필요' : '예정'}`, 1);
    add(st.rollbacks > 0, `롤백으로 시간을 ${st.rollbacks}번 되감음`, 1);
    add(st.rollbacks === 0, '롤백 없이 출시 (용감함)', 1.5);
    add(r.maxStreak >= 10, `최대 연속 패치 ${r.maxStreak}회 달성`, 1.5);
    add(f.ghost > 0, `투명 버그 ${f.ghost}마리를 눈치로 잡음`, 1);
    add(f.loop > 0, `무한루프 ${f.loop}개 탈출 성공`, 1);
    add(f.mini > 0, `작은 복제 버그 ${f.mini}마리 정리 (복붙 금지)`, 1);
    add(r.help.some((x) => x), '도움 모드로 버그 속도 15% 하향 조정', 2);
    add(true, `안정성 ${Math.round(r.stab)}%로 출시`, 0.5);
    add(miss > 0, `헛발질 ${miss}발 — 탄약이 무제한이라 다행`, 1);
    add(st.blastMax >= 3, `한 방에 복제 버그 ${st.blastMax}마리 동시 수정`, 1.5);
    add(true, `총 ${total}개의 버그가 세상에서 사라졌습니다`, 0.8);
    add(st.perfect >= 5, `PERFECT 패치 ${st.perfect}회 — 정밀 디버깅 장인`, 2);
    add(st.hotfix > 0, `핫픽스 ${st.hotfix}개 긴급 배포`, 1.2);
    add(st.overheat > 0, `패치 건 과열 ${st.overheat}회 — 냉각 팬 교체 예정`, 2.5);
    add(st.trojan > 0, `트로이 목마 핫픽스 ${st.trojan}개에 속음 (보안팀 호출)`, 3);
    add(st.dash >= 5, `돌진 버그 ${st.dash}마리와 정면 승부`, 1.5);
    pool.sort((a, b) => b[1] - a[1]);
    for (const p of pool.slice(0, 2)) lines.push(p[0]);
    const known = [];
    if (st.tele > 0) known.push(`알려진 문제: 플레이어가 404 버그를 ${st.tele}번 놓침`);
    if (st.contacts > 0) known.push(`알려진 문제: 버그와 ${st.contacts}번 부딪힘 (안전모 지급 예정)`);
    known.push('알려진 문제: 정상화된 메인 루프가 가끔 웃음');
    known.push('알려진 문제: 텍스처 없는 숲이 너무 예뻐짐');
    lines.push(known[0]);
    return `🐛 버그 헌터 ${ver} 패치 노트 — 등급: ${grade} · 난이도 ${Game.D.name}\n` + lines.map((l) => '• ' + l).join('\n') + `\n점수 ${r.score.toLocaleString()} · #버그헌터`;
  },
  copyNote() {
    const text = $('#resNote').textContent;
    const done = () => { $('#btnCopy').textContent = '복사됨 ✔'; this.toast('패치 노트를 복사했어요'); };
    const fallback = () => {
      const ta = $('#resNoteTa');
      ta.classList.remove('hidden'); $('#resNote').classList.add('hidden');
      ta.focus(); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      if (ok) done(); else { $('#btnCopy').textContent = '길게 눌러 복사하세요'; this.toast('복사가 막혀 있어요 — 글자를 길게 눌러 복사하세요'); }
    };
    try {
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback);
      else fallback();
    } catch (e) { fallback(); }
  },
};
function fmtTime(s) { s = Math.max(0, s || 0); return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0'); }

// 시작
window.addEventListener('load', () => {
  try { UI.init(); Game.init(); }
  catch (e) {
    document.body.innerHTML = '<div style="padding:24px;color:#eee;font-family:sans-serif">이 기기에서 3D(WebGL)를 시작할 수 없어요.<br>다른 브라우저로 열어 주세요.<br><small style="color:#888">' + String(e && e.message || e) + '</small></div>';
  }
});
