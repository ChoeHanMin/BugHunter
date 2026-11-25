// ---------- 코드로 그리는 픽셀 아트 ----------
const GLYPH = {
  '{': ['.##', '.#.', '##.', '.#.', '.##'],
  '}': ['##.', '.#.', '.##', '.#.', '##.'],
  ';': ['...', '.#.', '...', '.#.', '#..'],
  '?': ['##.', '..#', '.#.', '...', '.#.'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '!': ['#', '#', '#', '.', '#'],
  '~': ['.....', '.#.#.', '#.#.#', '.#.#.', '.....'], // ∞
};
function drawGlyphs(g, str, cx, cy, color) {
  const rows = str.split('').map((c) => GLYPH[c]);
  const w = rows.reduce((s, r) => s + r[0].length, 0) + rows.length - 1;
  let x = Math.round(cx - w / 2);
  const y = Math.round(cy - 2.5);
  g.fillStyle = color;
  for (const r of rows) {
    for (let j = 0; j < 5; j++) for (let i = 0; i < r[j].length; i++) if (r[j][i] === '#') g.fillRect(x + i, y + j, 1, 1);
    x += r[0].length + 1;
  }
}
function pixLine(g, x0, y0, x1, y1) {
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  for (let n = 0; n < 40; n++) {
    g.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
}
const BUGSTYLE = {
  basic: { body: '#FF4D5E', dark: '#7a1824', eye: '#FFD34D', sym: '{}', symc: '#2a070c', rx: 7, ry: 6, legs: 3 },
  clone: { body: '#FFD34D', dark: '#8a6a10', eye: '#FF4D5E', sym: ';;', symc: '#3a2a00', rx: 7, ry: 6, legs: 3 },
  mini: { body: '#FFD34D', dark: '#8a6a10', eye: '#FF4D5E', sym: ';', symc: '#3a2a00', rx: 6, ry: 5, legs: 2 },
  ghost: { body: '#BFF6FF', dark: '#4a8a99', eye: '#FF4D5E', sym: '?', symc: '#12383f', rx: 7, ry: 6, legs: 3 },
  e404: { body: '#FF8A3D', dark: '#7a3210', eye: '#FFD34D', sym: '404', symc: '#2a0a00', rx: 8, ry: 6, legs: 3 },
  loop: { body: '#E05BFF', dark: '#5a1a70', eye: '#FFD34D', sym: '~', symc: '#25062e', rx: 7, ry: 7, legs: 2 },
};
function bugCanvas(type, frame) {
  const st = BUGSTYLE[type];
  const c = document.createElement('canvas'); c.width = c.height = 24;
  const g = c.getContext('2d');
  const cx = 12, cy = 13;
  // 다리
  g.fillStyle = st.dark;
  for (const s of [-1, 1]) {
    for (let k = 0; k < st.legs; k++) {
      const y0 = cy - 3 + k * 3 + (st.legs === 2 ? 1 : 0);
      const wig = ((frame + k) % 2) ? 1 : -1;
      const x0 = cx + s * (st.rx - 1), kx = cx + s * (st.rx + 2), fx = cx + s * (st.rx + 4);
      pixLine(g, x0, y0, kx, y0 - 2 + wig);
      pixLine(g, kx, y0 - 2 + wig, fx, y0 + 2 + (k - 1));
    }
  }
  // 몸통
  for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
    const d = ((x + 0.5 - cx) / st.rx) ** 2 + ((y + 0.5 - cy) / st.ry) ** 2;
    if (d <= 1) {
      const edge = ((x + 0.5 - cx) / (st.rx - 1.2)) ** 2 + ((y + 0.5 - cy) / (st.ry - 1.2)) ** 2 > 1;
      g.fillStyle = edge ? st.dark : st.body;
      g.fillRect(x, y, 1, 1);
    }
  }
  // 하이라이트
  g.fillStyle = 'rgba(255,255,255,.55)';
  g.fillRect(cx - 3, cy - st.ry + 2, 2, 1);
  // 눈 + 더듬이
  g.fillStyle = st.eye;
  g.fillRect(cx - 4, cy - st.ry + 1, 2, 2); g.fillRect(cx + 2, cy - st.ry + 1, 2, 2);
  g.fillStyle = st.dark;
  const ay = frame ? 0 : 1;
  pixLine(g, cx - 2, cy - st.ry, cx - 4, cy - st.ry - 3 + ay);
  pixLine(g, cx + 2, cy - st.ry, cx + 4, cy - st.ry - 3 + ay);
  // 오류 기호
  drawGlyphs(g, st.sym, cx, cy + 1.5, st.symc);
  return c;
}
function texFromCanvas(c, nearest = true) {
  const t = new THREE.CanvasTexture(c);
  if (nearest) { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; }
  return t;
}
const TEX = {};
function buildTextures() {
  for (const k of Object.keys(BUGSTYLE)) {
    TEX[k] = [texFromCanvas(bugCanvas(k, 0)), texFromCanvas(bugCanvas(k, 1))];
    // assets/ 그림이 있으면 그걸로 교체 (작은 복제는 없으면 복제 버그 그림 사용)
    const url = ASSETS[ASSET_KEY[k]] || (k === 'mini' && ASSETS.bug_clone);
    if (url) {
      const t = new THREE.Texture();
      t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
      const img = new Image();
      img.onload = () => { t.image = img; t.needsUpdate = true; };
      img.src = url;
      TEX[k] = [t, t];
      TEX[k].asset = true;
    }
  }
  // 핫픽스 아이템 (assets/item_hotfix.png 있으면 교체)
  TEX.hotfix = [texFromCanvas(hotfixCanvas(0)), texFromCanvas(hotfixCanvas(1))];
  if (ASSETS.item_hotfix) {
    const t = new THREE.Texture(); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
    const img = new Image(); img.onload = () => { t.image = img; t.needsUpdate = true; }; img.src = ASSETS.item_hotfix;
    TEX.hotfix = [t, t];
  }
  // 무한루프 껍질 링
  {
    const c = document.createElement('canvas'); c.width = c.height = 40; const g = c.getContext('2d');
    for (let a = 0; a < 64; a++) {
      const th = (a / 64) * Math.PI * 2;
      g.fillStyle = a % 4 < 2 ? '#d9c2ff' : '#6B6F68';
      g.fillRect(Math.round(20 + Math.cos(th) * 18) - 1, Math.round(20 + Math.sin(th) * 18) - 1, 2, 2);
    }
    TEX.ring = texFromCanvas(c);
  }
  // 빛나는 지점
  {
    const c = document.createElement('canvas'); c.width = c.height = 16; const g = c.getContext('2d');
    const gr = g.createRadialGradient(8, 8, 0, 8, 8, 8);
    gr.addColorStop(0, 'rgba(255,255,220,1)'); gr.addColorStop(0.35, 'rgba(255,211,77,.9)'); gr.addColorStop(1, 'rgba(255,211,77,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 16, 16);
    TEX.glow = texFromCanvas(c, false);
  }
  // 데코용 픽셀 노이즈 질감
  {
    const c = document.createElement('canvas'); c.width = c.height = 16; const g = c.getContext('2d');
    const r = mulberry32(99);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const v = Math.floor(190 + r() * 65);
      g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, y, 1, 1);
    }
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, 0, 16, 1); g.fillRect(0, 0, 1, 16);
    TEX.pix = texFromCanvas(c); TEX.pix.wrapS = TEX.pix.wrapT = THREE.RepeatWrapping;
  }
  // 창문 질감 (도시)
  {
    const c = document.createElement('canvas'); c.width = 16; c.height = 32; const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, 16, 32);
    const r = mulberry32(7);
    for (let y = 2; y < 32; y += 4) for (let x = 2; x < 16; x += 4) { g.fillStyle = r() < 0.5 ? '#9a9a9a' : '#5a5a5a'; g.fillRect(x, y, 2, 2); }
    TEX.win = texFromCanvas(c); TEX.win.wrapS = TEX.win.wrapT = THREE.RepeatWrapping;
  }
}
// 보스 코드 줄 텍스처
function codeCanvas(text, mode, head) {
  const c = document.createElement('canvas'); c.width = 512; c.height = head ? 128 : 80;
  const g = c.getContext('2d');
  const pal = {
    norm: ['rgba(18,22,18,.92)', '#9aa096', '#3a3f37'],
    err: ['rgba(70,8,16,.95)', '#FF6B7A', '#FF4D5E'],
    fake: ['rgba(46,16,20,.9)', '#a85a63', '#5a2a30'],
    fixed: ['rgba(10,40,14,.95)', '#9CFF7A', '#C6F432'],
  }[mode];
  g.fillStyle = pal[0]; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = pal[2]; g.lineWidth = 6; g.strokeRect(3, 3, c.width - 6, c.height - 6);
  g.fillStyle = pal[1];
  g.font = (head ? 'bold 56px ' : 'bold 30px ') + 'ui-monospace, Menlo, Consolas, monospace';
  g.textBaseline = 'middle';
  g.fillText(text, 18, c.height / 2 + 2, c.width - 30);
  if (mode === 'err') { // 물결 밑줄
    g.strokeStyle = '#FFD34D'; g.lineWidth = 3; g.beginPath();
    for (let x = 18; x < 490; x += 8) g.lineTo(x, c.height - 14 + ((x / 8) % 2 ? -4 : 0));
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
  return t;
}
function hotfixCanvas(frame) { // 초록 패치 패키지 (+)
  const c = document.createElement('canvas'); c.width = c.height = 24; const g = c.getContext('2d');
  g.fillStyle = '#10140c'; g.fillRect(3, 4, 18, 17);
  g.fillStyle = frame ? '#E6FF7A' : '#C6F432'; g.fillRect(4, 5, 16, 15);
  g.fillStyle = '#8fb81e'; g.fillRect(4, 17, 16, 3); g.fillRect(17, 5, 3, 15);
  g.fillStyle = '#ffffff'; g.fillRect(7, 5, 8, 4);
  g.fillStyle = '#10140c'; g.fillRect(11, 6, 2, 2);
  g.fillStyle = '#1f5a1a'; g.fillRect(10, 10, 4, 8); g.fillRect(8, 12, 8, 4); // +
  g.fillStyle = '#ffffff'; g.fillRect(11, 11, 2, 6); g.fillRect(9, 13, 6, 2);
  if (frame) { g.fillStyle = '#ffffff'; g.fillRect(1, 2, 2, 2); g.fillRect(21, 1, 2, 2); g.fillRect(22, 20, 2, 2); }
  return c;
}
// 패치 건 (오른쪽을 향함, 32×14 픽셀). assets/gun.png 있으면 교체
function gunCanvas(stripe) {
  const c = document.createElement('canvas'); c.width = 34; c.height = 16; const g = c.getContext('2d');
  const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  // 외곽선
  R(4, 2, 22, 10, '#0a0c09'); R(24, 4, 10, 6, '#0a0c09'); R(3, 9, 9, 7, '#0a0c09');
  // 손잡이 · 몸통 · 총열
  R(4, 10, 7, 6, '#2a2f28');
  R(5, 3, 20, 8, '#3a4037'); R(5, 3, 20, 1, '#5a6156');
  R(25, 5, 8, 4, '#6B6F68'); R(25, 5, 8, 1, '#8a9084');
  R(31, 5, 2, 4, stripe); // 총구
  R(6, 7, 18, 1, stripe); // 줄
  R(8, 4, 7, 2, '#0f2a10'); R(9, 4, 1, 1, stripe); R(11, 5, 1, 1, stripe); R(13, 4, 1, 1, stripe); // 작은 화면
  R(18, 4, 2, 2, '#FF4D5E');
  return c;
}
const ASSET_KEY = { basic: 'bug_basic', clone: 'bug_clone', mini: 'bug_mini', ghost: 'bug_ghost', e404: 'bug_404', loop: 'bug_loop' };
function bugImgCanvas(type) { // DOM용 (하는 법/크래시 화면)
  const url = ASSETS[ASSET_KEY[type]];
  if (url) { const img = new Image(); img.src = url; img.className = 'asset'; return img; }
  const src = bugCanvas(type, 0);
  const c = document.createElement('canvas'); c.width = c.height = 24;
  c.getContext('2d').drawImage(src, 0, 0);
  return c;
}

function findMuzzle(img) {
  const c = document.createElement('canvas'), n = 96;
  c.width = n; c.height = Math.max(1, Math.round(n * img.naturalHeight / img.naturalWidth));
  const g = c.getContext('2d'); g.drawImage(img, 0, 0, c.width, c.height);
  let best = null, bd = 1e9;
  try {
    const d = g.getImageData(0, 0, c.width, c.height).data;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
      if (d[(y * c.width + x) * 4 + 3] > 128 && x + y < bd) { bd = x + y; best = { x: (x + 1.5) / c.width, y: (y + 1.5) / c.height }; }
    }
  } catch (e) { /* 읽기 실패 시 기본값 */ }
  return best || { x: 0.12, y: 0.12 };
}
