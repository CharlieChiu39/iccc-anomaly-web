// 桌面上的小視窗：可以拖曳（滑鼠、觸控、方向鍵）、可以關閉，位置記在這台瀏覽器裡。
// 螢幕窄的時候樣式會把小視窗改成由上往下排，這裡的位置就不生效。
import { h, fill, icon } from './ui.js';
import { t } from './i18n.js';
import { calm, zoomRect } from './fx.js';

const KEY = 'iccc.windows.v4';
const GRID = 12;                       // 桌面的點格是 24px，小視窗放下時對齊半格
const snap = (v) => Math.round(v / GRID) * GRID;
function loadSaved() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
function store(saved) {
  try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch { /* 無法儲存時只是不記位置 */ }
}

export function createDesk(desk) {
  let saved = loadSaved();
  const wins = new Map();
  let top = 10;
  const wide = () => window.matchMedia('(min-width: 72rem)').matches;      // 夠寬才讓小視窗自由擺放，否則由樣式整齊排列

  function availHeight() {
    const rectTop = desk.getBoundingClientRect().top;
    return Math.max(460, Math.floor(window.innerHeight - (rectTop > 0 ? rectTop : 84)));
  }

  // 把小視窗的座標限制在桌面可視範圍內，避免超出右緣或下緣
  function place(win, x, y, deskW = desk.clientWidth, deskH = availHeight(), winW = win.el.offsetWidth, winH = win.el.offsetHeight) {
    const pad = 12;
    const maxX = Math.max(pad, deskW - winW - pad);
    const maxY = Math.max(pad, deskH - winH - pad);
    win.x = Math.min(Math.max(pad, x), maxX);
    win.y = Math.min(Math.max(pad, y), maxY);
    win.el.style.transform = `translate(${Math.round(win.x)}px, ${Math.round(win.y)}px)`;
  }
  // 桌面鎖定為視窗剩餘可用高度，不產生垂直捲軸
  function fit(deskH = availHeight()) {
    if (!wide()) { desk.style.height = ''; desk.style.minHeight = ''; return; }
    const h = `${deskH}px`;
    desk.style.height = h;
    desk.style.minHeight = h;
  }
  // 放下時視需要對齊點格，自動排版則直接用精確像素座標
  function settle(win, x, y, shouldSnap = false, deskW = desk.clientWidth, deskH = availHeight(), winW = win.el.offsetWidth, winH = win.el.offsetHeight) {
    win.el.classList.add('settle');
    place(win, shouldSnap ? snap(x) : x, shouldSnap ? snap(y) : y, deskW, deskH, winW, winH);
    setTimeout(() => win.el.classList.remove('settle'), 200);
  }
  // 移到最上層。最上層的那一個標成 front，樣式只讓它的三鍵有顏色，其他小視窗的三鍵是底色
  function front(win) {
    win.el.style.zIndex = String(++top);
    wins.forEach((other) => other.el.classList.toggle('front', other === win));
  }
  function remember(win) {
    if (win.def.persist === false) return;
    saved[win.id] = { x: win.x, y: win.y };
    store(saved);
  }
  // 放回預設的位置。homed 表示「使用者沒有自己搬過」，這種小視窗在版面變動（視窗縮放、結論句換行）時會跟著調整。
  function home(win, animate = false, deskW = desk.clientWidth, deskH = availHeight()) {
    applySize(win, deskW, deskH);
    const winW = win.el.offsetWidth;
    const winH = win.el.offsetHeight;
    const [x, y] = win.def.home(deskW, deskH, winW, winH);
    win.homed = true;
    if (animate) settle(win, x, y, false, deskW, deskH, winW, winH); else place(win, x, y, deskW, deskH, winW, winH);
  }
  function rehome() {
    const deskW = desk.clientWidth;
    const deskH = availHeight();
    fit(deskH);
    if (!wide()) return;
    const targets = [];
    wins.forEach((win) => {
      if (!win.homed || win.el.classList.contains('dragging')) return;
      applySize(win, deskW, deskH);
      targets.push(win);
    });
    const moves = targets.map((win) => {
      const winW = win.el.offsetWidth;
      const winH = win.el.offsetHeight;
      const [nx, ny] = win.def.home(deskW, deskH, winW, winH);
      return { win, ox: win.x, oy: win.y, nx, ny, winW, winH };
    });
    moves.forEach(({ win, ox, oy, nx, ny, winW, winH }) => {
      win.homed = true;
      place(win, nx, ny, deskW, deskH, winW, winH);
      if (win.x !== ox || win.y !== oy) {
        const [tx, ty] = [win.x, win.y];
        place(win, ox, oy, deskW, deskH, winW, winH);
        win.el.getBoundingClientRect();
        settle(win, tx, ty, false, deskW, deskH, winW, winH);
      }
    });
  }
  // 標題列閃兩下：有新的異常公告跳出來
  function attention(win) {
    if (calm()) return;
    win.el.classList.add('attention');
    setTimeout(() => win.el.classList.remove('attention'), 900);
  }

  function bindDrag(win) {
    let grab = null;
    win.bar.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || !wide() || e.target.closest('button, a')) return;
      grab = { px: e.clientX, py: e.clientY, x: win.x, y: win.y };
      win.homed = false;
      win.bar.setPointerCapture(e.pointerId);
      win.el.classList.add('dragging');
    });
    win.bar.addEventListener('pointermove', (e) => {
      if (grab) place(win, grab.x + e.clientX - grab.px, grab.y + e.clientY - grab.py);
    });
    const drop = () => {
      if (!grab) return;
      grab = null;
      win.el.classList.remove('dragging');
      settle(win, win.x, win.y, true);
      remember(win);
      fit();
    };
    win.bar.addEventListener('pointerup', drop);
    win.bar.addEventListener('pointercancel', drop);
    win.bar.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 96 : 24;
      const move = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (!move || !wide() || e.target !== win.bar) return;
      e.preventDefault();
      win.homed = false;
      place(win, snap(win.x + move[0]), snap(win.y + move[1]));
      remember(win);
      fit();
    });
    win.el.addEventListener('pointerdown', () => front(win));
    win.el.addEventListener('focusin', () => { if (!win.el.classList.contains('front')) front(win); });
  }

  function applySize(win, deskW = desk.clientWidth, deskH = availHeight()) {
    const size = win.toggledSize ? (win.def.size === 'narrow' ? null : 'narrow') : win.def.size;
    if (size) win.el.dataset.size = size; else delete win.el.dataset.size;
    if (wide() && win.def.width !== undefined && win.def.width !== null) {
      const base = typeof win.def.width === 'function' ? win.def.width(deskW, deskH) : win.def.width;
      const w = win.toggledSize ? Math.min(deskW - 32, Math.round(base * 1.35)) : Math.round(base);
      win.el.style.width = `${w}px`;
    } else {
      win.el.style.width = '';
    }
    // 高度用版面分配到的數字固定住：內容比較多時在小視窗裡面捲動，不會把小視窗撐高、擠到別的小視窗上面。
    // tight：分到的高度低於這個數字時，樣式會把標了 .opt 的次要內容收起來（例如和右上角「放大」重複的按鈕）。
    if (wide() && !win.el.classList.contains('shaded') && win.def.height !== undefined && win.def.height !== null) {
      const baseH = typeof win.def.height === 'function' ? win.def.height(deskW, deskH) : win.def.height;
      win.el.style.height = baseH ? `${Math.round(baseH)}px` : '';
      win.el.toggleAttribute('data-tight', Boolean(baseH && win.def.tight && baseH < win.def.tight));
    } else {
      win.el.style.height = '';
      win.el.removeAttribute('data-tight');
    }
  }

  // 開啟（或更新）一個小視窗，回傳它的內容區塊讓呼叫的人放東西。
  // def: { title, icon?, size?, tone?, persist?, expand?, home(deskW, deskH, winW, winH) -> [x, y], onClose?,
  //        from?: 從畫面上哪個位置打開（縮放框的起點）, arrive?: 一開始依序出現的順序, attention?: 出現後閃標題列 }
  // from、arrive、attention 只在小視窗第一次出現時有作用。
  function open(id, def) {
    let win = wins.get(id);
    const isNew = !win;
    if (isNew) {
      const iconEl = h('span', { class: 'win-ico' });
      const titleEl = h('h2', { class: 'win-title' });
      const minBtn = h('button', { class: 'win-act', type: 'button', 'aria-expanded': 'true' }, icon('min'));
      const maxLink = h('a', { class: 'win-act', hidden: true }, icon('max'));
      const maxBtn = h('button', { class: 'win-act', type: 'button', hidden: true }, icon('max'));
      const closeBtn = h('button', { class: 'win-close', type: 'button' }, icon('close'));
      const acts = h('span', { class: 'win-acts' }, minBtn, maxLink, maxBtn, closeBtn);
      const bar = h('div', { class: 'win-bar', tabindex: '0', role: 'group' }, iconEl, titleEl, h('span', { class: 'win-grip', 'aria-hidden': 'true' }), acts);
      const body = h('div', { class: 'win-body' });
      const el = h('section', { class: 'win', 'data-win': id }, bar, body);
      win = { id, el, bar, body, iconEl, titleEl, minBtn, maxLink, maxBtn, closeBtn, def, iconName: null, x: 0, y: 0, homed: false, toggledSize: false };
      wins.set(id, win);
      desk.append(el);
      minBtn.addEventListener('click', () => {
        const shaded = win.el.classList.toggle('shaded');
        win.minBtn.setAttribute('aria-expanded', String(!shaded));
        rehome();
      });
      maxBtn.addEventListener('click', () => {
        win.toggledSize = !win.toggledSize;
        applySize(win);
        place(win, win.x, win.y);
        rehome();
      });
      closeBtn.addEventListener('click', () => close(id, true));
      bindDrag(win);
    }
    win.def = def;
    win.titleEl.textContent = def.title;
    if ((def.icon ?? null) !== win.iconName) {
      win.iconName = def.icon ?? null;
      fill(win.iconEl, def.icon ? icon(def.icon) : null);
    }
    const minLabel = t('shade_win', { name: def.title });
    win.minBtn.setAttribute('aria-label', minLabel);
    win.minBtn.setAttribute('title', minLabel);
    const expandHref = typeof def.expand === 'function' ? def.expand() : def.expand;
    if (expandHref) {
      win.maxLink.hidden = false;
      win.maxLink.setAttribute('href', expandHref);
      const maxLabel = t('max_win', { name: def.title });
      win.maxLink.setAttribute('aria-label', maxLabel);
      win.maxLink.setAttribute('title', maxLabel);
      win.maxBtn.hidden = true;
    } else {
      win.maxLink.hidden = true;
      win.maxBtn.hidden = false;
      const sizeLabel = t('size_win', { name: def.title });
      win.maxBtn.setAttribute('aria-label', sizeLabel);
      win.maxBtn.setAttribute('title', sizeLabel);
    }
    applySize(win);
    if (def.tone !== undefined && def.tone !== null) win.el.dataset.tone = def.tone; else delete win.el.dataset.tone;
    win.bar.setAttribute('aria-label', t('move_hint', { name: def.title }));
    const closeLabel = t('close_win', { name: def.title });
    win.closeBtn.setAttribute('aria-label', closeLabel);
    win.closeBtn.setAttribute('title', closeLabel);
    if (isNew) {
      front(win);
      const pos = def.persist !== false ? saved[id] : null;
      if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) place(win, pos.x, pos.y); else home(win);
      const from = typeof def.from === 'function' ? def.from() : def.from;
      if (from && wide() && !calm()) {
        win.el.classList.add('pending');
        zoomRect(from, win.el.getBoundingClientRect()).then(() => {
          win.el.classList.remove('pending');
          if (def.attention) attention(win);
        });
      } else if (def.arrive !== undefined && !calm()) {
        win.el.style.setProperty('--i', String(def.arrive));
        win.el.classList.add('arriving');
        setTimeout(() => win.el.classList.remove('arriving'), 1200);
      } else if (def.attention) {
        attention(win);
      }
    }
    return win.body;
  }

  // to：收回畫面上的哪個位置（縮放框的終點）
  function close(id, byUser = false, to = null) {
    const win = wins.get(id);
    if (!win) return;
    const rect = win.el.getBoundingClientRect();
    win.el.remove();
    wins.delete(id);
    if (byUser && win.def.persist !== false) {
      saved[id] = { ...saved[id], closed: true };
      store(saved);
    }
    if (win.el.classList.contains('front')) {       // 最上層的被關掉：改由剩下最上面的那一個接手
      let next = null;
      wins.forEach((other) => { if (!next || Number(other.el.style.zIndex) > Number(next.el.style.zIndex)) next = other; });
      next?.el.classList.add('front');
    }
    const target = to ?? (byUser ? win.def.closeTo?.() : null);
    if (target && wide()) zoomRect(rect, target);
    fit();
    if (byUser) win.def.onClose?.();
  }

  const onResize = () => {
    const deskW = desk.clientWidth;
    const deskH = availHeight();
    fit(deskH);
    const active = [];
    wins.forEach((win) => {
      applySize(win, deskW, deskH);
      if (wide()) active.push(win);
    });
    const rects = active.map((win) => {
      const winW = win.el.offsetWidth;
      const winH = win.el.offsetHeight;
      const [hx, hy] = win.homed ? win.def.home(deskW, deskH, winW, winH) : [win.x, win.y];
      return { win, hx, hy, winW, winH };
    });
    rects.forEach(({ win, hx, hy, winW, winH }) => {
      if (win.homed) win.homed = true;
      place(win, hx, hy, deskW, deskH, winW, winH);
    });
  };
  window.addEventListener('resize', onResize);

  return {
    open,
    close,
    has: (id) => wins.has(id),
    ids: () => [...wins.keys()],
    size: () => ({ w: desk.clientWidth, h: availHeight() }),
    rehome,
    isClosed: (id) => Boolean(saved[id]?.closed),
    reopen(id) { delete saved[id]; store(saved); },
    // 重新排列：忘記所有位置與關閉紀錄，回到一開始整齊的樣子
    reset() {
      saved = {};
      store(saved);
      wins.forEach((win) => {
        win.el.classList.remove('shaded');
        win.minBtn.setAttribute('aria-expanded', 'true');
        win.toggledSize = false;
        applySize(win);
        home(win, true);
      });
      fit();
    },
    destroy() { window.removeEventListener('resize', onResize); wins.clear(); },
  };
}
