// src/ 여러 파일 + assets/ 그림 → dist/index.html 하나로 합치기
// 사용: node build.js        (출품용)
//       node build.js --dev  (테스트용 window.__BH 노출)
const fs = require('fs');
const path = require('path');
const dev = process.argv.includes('--dev');
const src = (p) => fs.readFileSync(path.join(__dirname, 'src', p), 'utf8');

// 게임 안에 넣는 그림 목록: assets/<이름>.png 가 있으면 줄여서 넣고, 없으면 코드로 그린 그림 사용
// (assets/README.md 참고)
const ASSET_SPEC = {
  bug_basic: { size: 96 }, bug_clone: { size: 96 }, bug_mini: { size: 96 },
  bug_ghost: { size: 96 }, bug_404: { size: 96 }, bug_loop: { size: 96 },
  logo: { width: 900 }, item_hotfix: { size: 96 }, gun: { width: 640 }, gun_refactor: { width: 640 }, gun_sniper: { width: 640 },
  bug_throw: { size: 96 }, proj_missile: { size: 64 }, proj_packet: { size: 64 },
  portrait_dot: { size: 128 }, portrait_rex: { size: 128 }, portrait_pin: { size: 128 },
  // 캐릭터 자세 그림: 여백을 자르지 않음 (기본·움찔·고통의 위치가 어긋나지 않게)
  char_dot: { width: 230, keep: true }, char_dot_flinch: { width: 230, keep: true }, char_dot_hurt: { width: 230, keep: true },
  char_rex: { width: 230, keep: true }, char_rex_flinch: { width: 230, keep: true }, char_rex_hurt: { width: 230, keep: true },
  char_pin: { width: 230, keep: true }, char_pin_flinch: { width: 230, keep: true }, char_pin_hurt: { width: 230, keep: true },
  cover: { width: 800 }, cover_side: { width: 360 }, cover_forest: { width: 800 }, cover_city: { width: 800 }, cover_subway: { width: 800 }, cover_physics: { width: 800 }, cover_boss: { width: 800 },
};

async function loadAssets() {
  const dir = path.join(__dirname, 'assets');
  const out = {};
  let sharp = null;
  try { sharp = require('sharp'); } catch (e) { console.warn('sharp 없음: 그림을 줄이지 않고 그대로 넣습니다 (npm install 필요)'); }
  for (const [name, spec] of Object.entries(ASSET_SPEC)) {
    const f = ['png', 'webp'].map((x) => path.join(dir, `${name}.${x}`)).find((p) => fs.existsSync(p));
    if (!f) continue;
    let buf = fs.readFileSync(f), mime = f.endsWith('.webp') ? 'image/webp' : 'image/png';
    if (sharp) {
      let img = spec.keep ? sharp(buf) : sharp(buf).trim({ threshold: 1 }); // 투명 여백 잘라내기
      img = spec.size
        ? img.resize(spec.size, spec.size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        : img.resize({ width: spec.width, withoutEnlargement: true });
      buf = await img.png({ palette: true, quality: 90, compressionLevel: 9 }).toBuffer();
      mime = 'image/png';
    }
    out[name] = `data:${mime};base64,${buf.toString('base64')}`;
    console.log(`  그림 ${name}: ${(buf.length / 1024).toFixed(1)} KB`);
  }
  // 효과음 파일 (그대로 넣음, 짧게!)
  for (const name of ['sfx_shot', 'sfx_spread']) {
    for (const [ext, mime] of [['mp3', 'audio/mpeg'], ['ogg', 'audio/ogg'], ['wav', 'audio/wav']]) {
      const f = path.join(dir, `${name}.${ext}`);
      if (!fs.existsSync(f)) continue;
      const buf = fs.readFileSync(f);
      out[name] = `data:${mime};base64,${buf.toString('base64')}`;
      console.log(`  소리 ${name}: ${(buf.length / 1024).toFixed(1)} KB` + (buf.length > 150 * 1024 ? '  ← 너무 큼, 1초 이하로 잘라 주세요' : ''));
      break;
    }
  }
  return out;
}

(async () => {
  const assets = await loadAssets();
  const three = fs.readFileSync(path.join(__dirname, 'node_modules/three/build/three.min.js'), 'utf8')
    .replace(/console\.warn\('Scripts "build\/three\.js"[^)]*\)/, 'void 0'); // r150+ 안내 경고 제거
  const jsDir = path.join(__dirname, 'src', 'js');
  const parts = fs.readdirSync(jsDir).filter((f) => f.endsWith('.js')).sort().map((f) => `// ==== ${f} ====\n` + fs.readFileSync(path.join(jsDir, f), 'utf8'));
  const game = `(function(){'use strict';\nconst ASSETS=${JSON.stringify(assets)};\n${parts.join('\n')}\n${dev ? 'window.__BH={Game,Boss,World,UI,FX,SND,MUS};' : ''}\n})();`;
  const css = src('style.css').replace(/\s*\n\s*/g, '\n');

  // </script> 가 문자열 안에 있으면 HTML이 깨지므로 방지
  const safe = (s) => s.replace(/<\/script/gi, '<\\/script');
  const html = src('index.html')
    .replace('/*__CSS__*/', () => css)
    .replace('/*__THREE__*/', () => safe(three))
    .replace('/*__GAME__*/', () => safe(game));

  fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
  const out = path.join(__dirname, 'dist', dev ? 'index.dev.html' : 'index.html');
  fs.writeFileSync(out, html);
  const kb = Buffer.byteLength(html) / 1024;
  console.log(`${path.relative(__dirname, out)}  ${kb.toFixed(0)} KB  (제한 4096 KB, 목표 1536 KB)`);
  if (kb > 4096) { console.error('오류: 4MB 초과!'); process.exitCode = 1; }
  else if (kb > 1536) console.warn('주의: 목표 1.5MB 초과');
  if (/(src|href)=["']https?:/i.test(html.replace(three, ''))) console.warn('경고: 외부 URL 참조 발견');
})();
