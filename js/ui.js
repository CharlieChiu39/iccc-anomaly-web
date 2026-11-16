// 畫面的小零件。所有文字都用 textContent 放進去，不用 innerHTML，
// 測站名稱或數值裡就算有 HTML 標籤也只會被當成文字顯示（防止 XSS）。
import { t, levelName, num } from './i18n.js';
import { BITMAPS } from './icons.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function build(el, props, children) {
  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else el.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}
export const h = (tag, props, ...children) => build(document.createElement(tag), props, children);
export const s = (tag, props, ...children) => build(document.createElementNS(SVG_NS, tag), props, children);

// 換掉一個元素的內容。會先攤平陣列並濾掉 null／false（直接用 replaceChildren 的話 null 會被印成文字）。
// 每 10 秒重畫時，如果鍵盤焦點正停在裡面的連結或按鈕上，重畫後把焦點放回同一個，不讓使用者的位置跑掉。
const focusKey = (node) => (node.hasAttribute('data-key') ? `${node.tagName}|${node.getAttribute('data-key')}` : `${node.tagName}|${node.getAttribute('href') ?? ''}|${node.textContent}`);
export function fill(el, ...children) {
  const active = document.activeElement;
  const key = active && active !== el && el.contains(active) && active.matches('a, button') ? focusKey(active) : null;
  el.replaceChildren(...children.flat(Infinity)
    .filter((c) => c !== null && c !== undefined && c !== false)
    .map((c) => (c instanceof Node ? c : document.createTextNode(String(c)))));
  if (key) [...el.querySelectorAll('a, button')].find((node) => focusKey(node) === key)?.focus({ preventScroll: true });
  return el;
}

// 像素圖示：把 12×12 的點陣畫成一個 SVG，同一列相連的格子合併成一條
export function icon(name, size = 12) {
  let d = '';
  (BITMAPS[name] || []).forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== '#') continue;
      let w = 1;
      while (row[x + w] === '#') w += 1;
      d += `M${x} ${y}h${w}v1h-${w}z`;
      x += w - 1;
    }
  });
  return s('svg', { class: 'ico', viewBox: '0 0 12 12', width: size, height: size, 'aria-hidden': 'true', focusable: 'false' }, s('path', { d }));
}

// flash：這個狀態是剛剛才變的，閃一下讓人注意到
export function chip(level, flash = false) {
  const name = levelName(level);
  return h('span', { class: `chip${flash ? ' flash' : ''}`, 'data-level': level ?? '' }, level === 3 ? h('span', null, name) : name);
}

// 資料中斷的測項數。斷線的測站不算：整個測站都沒有資料，燈號已經是「斷線」
export function staleCount(station) {
  if (!station || station.level === 3) return 0;
  return Object.values(station.items || {}).filter((cell) => cell.stale).length;
}
// 測站燈號旁邊的小標籤：資料中斷的測項不計入燈號，燈號可能是「正常」，所以在旁邊講明還有幾項無法判斷
export function staleTag(station) {
  const n = staleCount(station);
  return n ? h('span', { class: 'tag stale', title: t('flag_stale') }, t('stale_tag', { n })) : null;
}

export function stateBlock(titleKey, hintKey, isError = false) {
  return h('div', { class: `state${isError ? ' error' : ''}`, role: isError ? 'alert' : null },
    h('strong', null, t(titleKey)), hintKey ? h('p', { class: 'muted' }, t(hintKey)) : null);
}
export function skeleton(tall = false) {
  return h('div', { class: `skeleton${tall ? ' tall' : ''}`, 'aria-busy': 'true', 'aria-label': t('loading') }, h('i'), h('i'), h('i'));
}

// 門檻有兩種：{warn, alarm}（超過就注意／異常）或 {low, high}（超出範圍就異常）
export const isRange = (th) => th && th.low !== undefined && th.high !== undefined;
export function thresholdText(th) {
  if (!th) return '';
  if (isRange(th)) return `${num(th.low)}–${num(th.high)}`;
  return [th.warn, th.alarm].filter((v) => v !== undefined).map((v) => num(v)).join(' / ');
}

// 刻度：把數值畫在自己的門檻旁邊。平常只有墨色，越過門檻的那一段才有狀態色。
// from：上一次的數值。有給的話，方塊會從舊位置滑到新位置。
export function gauge(value, th, level, from) {
  if (value === null || value === undefined || !th) return null;
  let lo; let hi; let ticks; const over = [];
  if (isRange(th)) {
    const span = th.high - th.low;
    lo = Math.min(th.low - span * 0.6, value);
    hi = Math.max(th.high + span * 0.6, value);
    ticks = [th.low, th.high];
    if (value < th.low) over.push([value, th.low, 2]);
    if (value > th.high) over.push([th.high, value, 2]);
  } else {
    const top = th.alarm ?? th.warn;
    if (top === undefined) return null;
    lo = 0;
    hi = Math.max(top * 1.45, value * 1.06);
    ticks = [th.warn, th.alarm].filter((v) => v !== undefined);
    if (th.warn !== undefined && value > th.warn) over.push([th.warn, Math.min(value, th.alarm ?? value), 1]);
    if (th.alarm !== undefined && value > th.alarm) over.push([th.alarm, value, 2]);
  }
  const at = (v) => Math.max(0, Math.min(100, ((v - lo) / (hi - lo || 1)) * 100));
  const pct = (v) => `${at(v).toFixed(2)}%`;
  const label = isRange(th)
    ? `${num(value)}; ${t('th_range')} ${thresholdText(th)}`
    : `${num(value)}; ${t('th_warn')} ${num(th.warn)}; ${t('th_alarm')} ${num(th.alarm)}`;
  const el = h('span', { class: 'gauge', role: 'img', 'aria-label': label }, h('i', { class: 'track' }));
  for (const [from, to, lv] of over) {
    const seg = h('i', { class: 'over', 'data-level': lv });
    seg.style.left = pct(from);
    seg.style.width = `${Math.max(0, parseFloat(pct(to)) - parseFloat(pct(from))).toFixed(2)}%`;
    el.append(seg);
  }
  for (const tick of ticks) {
    const mark = h('i', { class: 'tick' });
    mark.style.left = pct(tick);
    el.append(mark);
  }
  const dot = h('i', { class: 'mark', 'data-level': level ?? 0 });
  dot.style.left = pct(value);
  el.append(dot);
  if (typeof from === 'number' && from !== value) {
    const shift = (at(from) - at(value)) / 100;
    requestAnimationFrame(() => {
      if (!dot.isConnected) return;
      dot.style.transition = 'none';
      dot.style.transform = `translateX(calc(-50% + ${(shift * el.offsetWidth).toFixed(1)}px))`;
      dot.getBoundingClientRect();          // 先讓瀏覽器記住起點，再放手讓它滑回正確位置
      dot.style.transition = '';
      dot.style.transform = '';
    });
  }
  return el;
}

// 沒有資料的格子：斜線紋加文字
export const noData = (text) => h('span', { class: 'nodata' }, h('span', null, text));

// 一個測站裡「最需要注意」的測項：狀態最嚴重的；一樣嚴重時取最接近或超過門檻最多的
export function worstItem(station, standardItems) {
  let best = null;
  for (const [code, cell] of Object.entries(station.items || {})) {
    if (cell.value === null || cell.value === undefined) continue;
    const th = standardItems?.[code];
    let ratio = 0;
    if (th && isRange(th)) {
      const mid = (th.low + th.high) / 2;
      ratio = Math.abs(cell.value - mid) / ((th.high - th.low) / 2 || 1);
    } else if (th) {
      ratio = cell.value / (th.alarm ?? th.warn ?? Infinity);
    }
    const score = (cell.level ?? -1) * 1000 + ratio;
    if (!best || score > best.score) best = { code, cell, th, score };
  }
  return best;
}

// 匯出 CSV。開頭是 = + - @ 的儲存格前面加單引號，避免試算表把它當成公式執行。
export function downloadCsv(filename, rows) {
  const cell = (value) => {
    let text = value === null || value === undefined ? '' : String(value);
    if (/^[=+\-@\t\r]/.test(text) && Number.isNaN(Number(text))) text = `'${text}`;
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const body = rows.map((row) => row.map(cell).join(',')).join('\r\n');
  const blob = new Blob(['﻿', body], { type: 'text/csv;charset=utf-8' });
  const link = h('a', { href: URL.createObjectURL(blob), download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
