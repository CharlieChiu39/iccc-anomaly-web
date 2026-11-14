// 趨勢圖：一個測站一個測項一張，自己用 SVG 畫（不引用外部程式庫）。
// 線平常是墨色，只有越過門檻的那一段換成狀態色；斷線、沒有資料的時段畫斜線紋。
import { h, s, isRange, stateBlock } from './ui.js';
import { t, num, clock, dateTime, levelName, gap } from './i18n.js';

const W = 640; const H = 240;
const M = { top: 18, right: 78, bottom: 26, left: 46 };
let serial = 0;

// 和偵測程式相同的判斷方式（超過才算，剛好等於不算）
export function levelOf(value, th) {
  if (!th) return 0;
  if (th.low !== undefined && value < th.low) return 2;
  if (th.high !== undefined && value > th.high) return 2;
  if (th.alarm !== undefined && value > th.alarm) return 2;
  if (th.warn !== undefined && value > th.warn) return 1;
  return 0;
}

function niceTicks(lo, hi, count = 4) {
  const raw = (hi - lo) / count || 1;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((v) => v >= raw) || raw;
  const ticks = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-6; v += step) ticks.push(Number(v.toFixed(10)));
  return ticks;
}

// animate：線從左畫到右（只在第一次出現時用）；index：同一頁的第幾張圖，依序晚一點點開始畫
export function lineChart({ title, unit, data, th, animate = false, index = 0 }) {
  const id = `chart${++serial}`;
  const points = data.points;
  const latest = points.length ? points[points.length - 1] : null;
  const fig = h('figure', { class: `chart${animate ? ' draw' : ''}` },
    h('figcaption', null, h('strong', null, title), unit ? h('span', { class: 'unit' }, unit) : null,
      latest ? h('span', { class: 'latest' }, `${t('chart_latest')} ${num(latest[1])}`) : null));
  if (!points.length && !data.offline.length) {
    fig.append(stateBlock('empty_points', 'empty_points_hint'));
    return fig;
  }
  fig.style.setProperty('--i', String(index));

  // 尺度：一般測項從 0 開始；範圍型（pH）以正常範圍為中心
  const range = isRange(th);
  const lines = th ? (range ? [[th.low, 2], [th.high, 2]] : [[th.warn, 1], [th.alarm, 2]].filter(([v]) => v !== undefined)) : [];
  const all = [...points.map((p) => p[1]), ...lines.map(([v]) => v)];
  let lo = all.length ? Math.min(...all) : 0;
  let hi = all.length ? Math.max(...all) : 1;
  const pad = (hi - lo || Math.abs(hi) || 1) * 0.14;
  hi += pad;
  lo = range ? lo - pad : Math.min(0, lo);
  const x0 = M.left; const x1 = W - M.right; const y0 = H - M.bottom; const y1 = M.top;
  const x = (ts) => x0 + ((x1 - x0) * (ts - data.start)) / (data.end - data.start || 1);
  const y = (v) => y0 - ((y0 - y1) * (v - lo)) / (hi - lo || 1);

  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `${title}${unit ? ` (${unit})` : ''}` });

  // 越線區域：用來把同一條線裁出「注意」「異常」兩段
  const defs = s('defs');
  const clip = (name, rects) => defs.append(s('clipPath', { id: `${id}-${name}` },
    rects.map(([top, bottom]) => s('rect', { x: x0, y: top, width: x1 - x0, height: Math.max(0, bottom - top) }))));
  if (range) {
    clip('over2', [[y1 - 4, y(th.high)], [y(th.low), y0 + 4]]);
  } else if (th) {
    if (th.alarm !== undefined) clip('over2', [[y1 - 4, y(th.alarm)]]);
    if (th.warn !== undefined) clip('over1', [[th.alarm !== undefined ? y(th.alarm) : y1 - 4, y(th.warn)]]);
  }
  defs.append(s('pattern', { id: `${id}-hatch`, width: 7, height: 7, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' },
    s('line', { class: 'gap-hatch', x1: 0, y1: 0, x2: 0, y2: 7 })));
  svg.append(defs);

  // 格線與座標（退到後面，不搶線的注意力）
  for (const tick of niceTicks(lo, hi)) {
    svg.append(s('line', { class: 'gridline', x1: x0, x2: x1, y1: y(tick), y2: y(tick) }),
      s('text', { class: 'label', x: x0 - 6, y: y(tick) + 4, 'text-anchor': 'end' }, num(tick)));
  }
  svg.append(s('line', { class: 'axis', x1: x0, x2: x1, y1: y0, y2: y0 }));
  for (const [ts, anchor] of [[data.start, 'start'], [(data.start + data.end) / 2, 'middle'], [data.end, 'end']]) {
    svg.append(s('text', { class: 'label', x: x(ts), y: H - 8, 'text-anchor': anchor }, clock(new Date(ts * 1000)).slice(0, 5)));
  }

  // 斷線時段：斜線紋
  for (const [from, to] of data.offline) {
    const left = Math.max(x0, x(from - data.step_seconds / 2));
    const width = Math.max(3, Math.min(x1, x(to + data.step_seconds / 2)) - left);
    svg.append(s('rect', { class: 'gap', x: left, y: y1, width, height: y0 - y1 }, s('title', null, t('chart_offline'))),
      s('rect', { x: left, y: y1, width, height: y0 - y1, fill: `url(#${id}-hatch)` }));
  }

  // 門檻線：直接標在線的右邊，不另外做圖例
  let lastLabelY = -99;
  for (const [value, lv] of [...lines].sort((a, b) => b[0] - a[0])) {
    const ty = y(value);
    svg.append(s('line', { class: lv === 2 ? 'th-alarm' : 'th-warn', x1: x0, x2: x1, y1: ty, y2: ty }));
    const labelY = Math.max(ty + 4, lastLabelY + 13);
    lastLabelY = labelY;
    svg.append(s('text', { class: 'th-label', x: x1 + 6, y: labelY }, `${levelName(lv)} ${num(value)}`));
  }

  // 資料線：間隔太久（斷線、缺資料）就斷開，不把兩邊連起來
  const maxGap = data.step_seconds * 2.5;
  let d = '';
  points.forEach(([ts, value], i) => {
    const jump = i === 0 || ts - points[i - 1][0] > maxGap;
    d += `${jump ? 'M' : 'L'}${x(ts).toFixed(1)} ${y(value).toFixed(1)} `;
    if (jump && (i === points.length - 1 || points[i + 1][0] - ts > maxGap)) d += `h0.01 `;   // 孤立的一點也畫得出來
  });
  if (d) {
    // pathLength 把整條線的長度當成 1，「從左畫到右」的效果才不用先量線有多長
    svg.append(s('path', { class: 'line', d, pathLength: 1 }));
    for (const [name, cls] of [['over1', 'over-1'], ['over2', 'over-2']]) {
      if (!defs.querySelector(`#${id}-${name}`)) continue;
      svg.append(s('path', { class: 'line case', d, pathLength: 1, 'clip-path': `url(#${id}-${name})` }),
        s('path', { class: `line ${cls}`, d, pathLength: 1, 'clip-path': `url(#${id}-${name})` }));
    }
  }
  // 最新一點：方塊，和表格裡刻度上的方塊是同一個記號
  if (latest) svg.append(s('rect', { class: 'last', x: x(latest[0]) - 4.5, y: y(latest[1]) - 4.5, width: 9, height: 9 }));

  // 滑鼠移過或用方向鍵：顯示那個時間點的數值
  const cross = s('line', { class: 'cross', y1, y2: y0, visibility: 'hidden' });
  const dot = s('rect', { class: 'cross-dot', width: 10, height: 10, visibility: 'hidden' });
  const plot = s('rect', { class: 'plot', x: x0, y: y1, width: x1 - x0, height: y0 - y1, fill: 'transparent', tabindex: points.length ? '0' : null });
  svg.append(cross, dot, plot);
  const tip = h('div', { class: 'tip', hidden: true });
  fig.append(svg, tip);

  let current = -1;
  function show(index) {
    if (index < 0 || index >= points.length) return;
    current = index;
    const [ts, value] = points[index];
    cross.setAttribute('x1', x(ts)); cross.setAttribute('x2', x(ts));
    dot.setAttribute('x', x(ts) - 5); dot.setAttribute('y', y(value) - 5);
    cross.setAttribute('visibility', 'visible'); dot.setAttribute('visibility', 'visible');
    tip.textContent = `${dateTime(new Date(ts * 1000))}${gap()}${num(value)}${unit ? ` ${unit}` : ''}${gap()}${levelName(levelOf(value, th))}`;
    tip.hidden = false;
    const box = svg.getBoundingClientRect();
    const scale = box.width / W;
    const left = Math.min(Math.max(4, x(ts) * scale - tip.offsetWidth / 2), fig.clientWidth - tip.offsetWidth - 4);
    tip.style.left = `${left}px`;
    tip.style.top = `${svg.offsetTop + Math.max(2, y(value) * scale - tip.offsetHeight - 10)}px`;
  }
  function hide() {
    current = -1;
    cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden');
    tip.hidden = true;
  }
  plot.addEventListener('pointermove', (e) => {
    const box = svg.getBoundingClientRect();
    const ts = data.start + (((e.clientX - box.left) / box.width) * W - x0) / (x1 - x0) * (data.end - data.start);
    let best = -1; let bestGap = Infinity;
    points.forEach(([pts], i) => { const gap = Math.abs(pts - ts); if (gap < bestGap) { bestGap = gap; best = i; } });
    show(best);
  });
  plot.addEventListener('pointerleave', hide);
  plot.addEventListener('focus', () => show(points.length - 1));
  plot.addEventListener('blur', hide);
  plot.addEventListener('keydown', (e) => {
    const move = { ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity }[e.key];
    if (move === undefined) return;
    e.preventDefault();
    show(Math.min(points.length - 1, Math.max(0, (current < 0 ? points.length - 1 : current) + move)));
  });

  // 數值表：不看圖也讀得到同樣的資料
  if (points.length) {
    const rows = points.slice(-120).reverse().map(([ts, value]) => h('tr', null,
      h('td', null, dateTime(new Date(ts * 1000))), h('td', { class: 'num' }, num(value)), h('td', null, levelName(levelOf(value, th)))));
    fig.append(h('details', null, h('summary', null, t('chart_table')),
      h('div', { class: 'scroll-y' }, h('table', { class: 'grid compact' },
        h('thead', null, h('tr', null, h('th', null, t('chart_time')), h('th', { class: 'num' }, title), h('th', null, t('th_state')))),
        h('tbody', null, rows)))));
  }
  return fig;
}

// 小趨勢圖：放在表格的一格裡，只看走勢和它離門檻多遠。沒有座標軸，數值寫在旁邊的欄位。
// 高低範圍把門檻也算進去，所以線貼著底就是「離門檻還很遠」，線在門檻線上面就是「超過了」。
const SW = 132; const SH = 28;
export function sparkline({ data, th, level, label }) {
  const points = data.points;
  if (!points.length) return null;
  const padX = 2; const padY = 4; const endRoom = 8;
  const range = isRange(th);
  const lines = th ? (range ? [[th.low, 2], [th.high, 2]] : [[th.warn, 1], [th.alarm, 2]].filter(([v]) => v !== undefined)) : [];
  const values = points.map((p) => p[1]);
  const all = [...values, ...lines.map(([v]) => v)];
  let lo = Math.min(...all); let hi = Math.max(...all);
  if (hi === lo) { hi += 1; lo -= 1; }
  const x = (ts) => padX + ((SW - padX - endRoom) * (ts - data.start)) / (data.end - data.start || 1);
  const y = (v) => SH - padY - ((SH - 2 * padY) * (v - lo)) / (hi - lo);
  const latest = points[points.length - 1];
  const svg = s('svg', {
    class: 'spark', viewBox: `0 0 ${SW} ${SH}`, width: SW, height: SH, role: 'img',
    'aria-label': t('spark_label', { name: label, lo: num(Math.min(...values)), hi: num(Math.max(...values)), last: num(latest[1]) }),
  });
  for (const [from, to] of data.offline) {
    const left = Math.max(padX, x(from - data.step_seconds / 2));
    svg.append(s('rect', { class: 'gap', x: left, y: 1, width: Math.max(2, Math.min(SW - endRoom, x(to + data.step_seconds / 2)) - left), height: SH - 2 }));
  }
  for (const [value, lv] of lines) svg.append(s('line', { class: lv === 2 ? 'th-alarm' : 'th-warn', x1: padX, x2: SW - endRoom, y1: y(value), y2: y(value) }));
  const maxGap = data.step_seconds * 2.5;
  let d = '';
  points.forEach(([ts, value], i) => { d += `${i === 0 || ts - points[i - 1][0] > maxGap ? 'M' : 'L'}${x(ts).toFixed(1)} ${y(value).toFixed(1)} `; });
  svg.append(s('path', { class: 'line', d }), s('rect', { class: 'last', 'data-level': level ?? 0, x: x(latest[0]) - 3, y: y(latest[1]) - 3, width: 6, height: 6 }));
  return svg;
}
