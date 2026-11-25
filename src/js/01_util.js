// ---------- 공용 도구 ----------
THREE.ColorManagement.enabled = false; // 색상값을 hex 그대로 사용
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - (1 - t) * (1 - t);
function bounceOut(x) {
  const n1 = 7.5625, d1 = 2.75;
  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
  return n1 * (x -= 2.625 / d1) * x + 0.984375;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
let RNG = mulberry32(1);
const rnd = (a = 0, b = 1) => a + (b - a) * RNG();
const rint = (a, b) => Math.floor(rnd(a, b + 1));
const pick = (arr, r = RNG) => arr[Math.floor(r() * arr.length)];
function shuffle(arr, r = RNG) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }

// localStorage는 막혀 있을 수 있음 → 항상 try/catch
const Store = {
  get(k, d) { try { const v = localStorage.getItem('bughunter_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('bughunter_' + k, JSON.stringify(v)); } catch (e) { /* 저장 없이 진행 */ } },
};

const NOW = new Date();
const MMDD = String(NOW.getMonth() + 1).padStart(2, '0') + String(NOW.getDate()).padStart(2, '0');
const TODAY_KEY = NOW.getFullYear() + '-' + MMDD;
const DAILY_VER = 'v1.' + MMDD;
const DAILY_SEED = hashStr('bughunter-' + TODAY_KEY);
const IS_TOUCH = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || (navigator.maxTouchPoints > 0 && 'ontouchstart' in window);
if (IS_TOUCH) document.body.classList.add('touch');

const settings = Object.assign({ sound: true, sfx: 0.8, music: 0.6, reduceFlash: false, quality: 'auto' }, Store.get('settings', {}));
function saveSettings() { Store.set('settings', settings); }

const GRADES = ['정식 출시', '베타', '알파', '출시 연기'];
