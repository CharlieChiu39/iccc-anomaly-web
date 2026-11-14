// 各個畫面。每個畫面回傳 { el, update(app), destroy() }：
// el 只建立一次，update 在資料更新時重畫內容（下拉選單、小視窗的位置等不會被重置）。
import { h, s, fill, icon, chip, gauge, noData, stateBlock, skeleton, thresholdText, isRange, worstItem, downloadCsv } from './ui.js';
import { t, lang, levelName, kindName, stdName, itemName, stationName, reasonName, eventLevel, num, dateTime, clock, ago, duration, paren, colon, gap, zone } from './i18n.js';
import { source, mode, grafanaUrl, demoSpanMinutes } from './data.js';
import { createDesk } from './windows.js';
import { lineChart, sparkline } from './chart.js';
import { typeOut } from './fx.js';

const ORDER = { 2: 0, 3: 1, 1: 2, 0: 3 };   // 異常 → 斷線 → 注意 → 正常
const rank = (level) => ORDER[level] ?? 4;
const sorted = (stations) => [...stations].sort((a, b) => rank(a.level) - rank(b.level) || a.name.localeCompare(b.name));
const seconds = (iso) => (Date.now() - Date.parse(iso)) / 1000;
const NOTICE_FRESH_SECONDS = 300;

// 測項的顯示名稱與單位：從目前的測站資料裡找（事件紀錄只有代號）
function itemInfo(app, code) {
  if (code === 'offline') return { name: t('item_offline'), unit: '' };
  for (const st of app.data.status?.stations ?? []) {
    const cell = st.items?.[code];
    if (cell) return { name: itemName(code, cell.name), unit: cell.unit || '' };
  }
  return { name: itemName(code, code.toUpperCase()), unit: app.stdItems?.[code]?.unit || '' };
}
const stationById = (app, id) => app.data.status?.stations.find((st) => st.id === id);
// dir：和上一次更新相比是上升（1）還是下降（-1），會在數值後面畫一個小箭頭
const valueUnit = (value, unit, dir = 0) => [h('span', { class: 'value' }, num(value)), unit ? h('span', { class: 'unit' }, unit) : null,
  dir ? h('span', { class: 'delta' }, icon(dir > 0 ? 'up' : 'down'), h('span', { class: 'visually-hidden' }, t(dir > 0 ? 'rising' : 'falling'))) : null];
// 和上一次更新比較：狀態是不是剛變、數值往哪個方向動、上一次的數值是多少
const levelChanged = (app, st) => app.fresh() && app.was.levels.has(st.id) && app.was.levels.get(st.id) !== st.level;
const lastValue = (app, st, code) => (app.fresh() ? app.was.values.get(`${st.id}/${code}`) : undefined);
function direction(app, st, code, value) {
  const old = app.was.values.get(`${st.id}/${code}`);
  return typeof old === 'number' && typeof value === 'number' && old !== value ? Math.sign(value - old) : 0;
}

// 內頁的外框：一個放到最大的視窗。標題列寫著所在位置（可以點回上一層），右上角有縮小、還原與關閉回到桌面。
function sheet(app, iconName, ...children) {
  const crumbs = h('nav', { class: 'crumbs' });
  const minEl = h('a', { class: 'win-act', href: app.link('desk') }, icon('min'));
  const maxEl = h('a', { class: 'win-act', href: app.link('desk') }, icon('max'));
  const closeEl = h('a', { class: 'win-close sheet-close', href: app.link('desk') }, icon('close'));
  const body = h('div', { class: 'sheet-body' }, children);
  const el = h('div', { class: 'page' }, h('section', { class: 'sheet' },
    h('div', { class: 'sheet-bar' }, h('span', { class: 'win-ico' }, icon(iconName)), crumbs, h('span', { class: 'win-grip', 'aria-hidden': 'true' }),
      h('span', { class: 'win-acts' }, minEl, maxEl, closeEl)),
    body));
  // trail：[[文字, 連結], ...]，最後一個是目前所在的頁面（不給連結）
  function setCrumbs(trail) {
    crumbs.setAttribute('aria-label', t('crumbs'));
    const backHref = app.link('desk');
    const backLabel = t('back_desk');
    const restoreLabel = t('restore_win');
    minEl.setAttribute('href', backHref);
    minEl.setAttribute('aria-label', backLabel);
    minEl.setAttribute('title', backLabel);
    maxEl.setAttribute('href', backHref);
    maxEl.setAttribute('aria-label', restoreLabel);
    maxEl.setAttribute('title', restoreLabel);
    closeEl.setAttribute('href', backHref);
    closeEl.setAttribute('aria-label', backLabel);
    closeEl.setAttribute('title', backLabel);
    fill(crumbs, ...trail.flatMap(([text, href], i) => [i ? icon('right') : null,
      href ? h('a', { href }, text) : h('span', { 'aria-current': 'page' }, text)]));
  }
  return { el, body, setCrumbs };
}

// 桌面背景的 CCU 像素字樣裝飾（純裝飾，aria-hidden）
const CCU_MAP = [
  '.#####....#####...##...##',
  '#######..#######..##...##',
  '##...##..##...##..##...##',
  '##.......##.......##...##',
  '##.......##.......##...##',
  '##.......##.......##...##',
  '##...##..##...##..##...##',
  '#######..#######..#######',
  '.#####....#####....#####.',
];
function deskMotif() {
  let d = '';
  CCU_MAP.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== '#') continue;
      let w = 1;
      while (row[x + w] === '#') w += 1;
      d += `M${x} ${y}h${w}v1h-${w}z`;
      x += w - 1;
    }
  });
  return s('svg', { class: 'desk-motif', viewBox: '0 0 25 9', 'aria-hidden': 'true', focusable: 'false' },
    s('path', { d, fill: 'currentColor' }));
}

function eventSentence(app, ev) {
  if (eventLevel(ev) === 3) return t('notice_offline_text');
  const info = itemInfo(app, ev.item);
  const value = ev.max_value ?? ev.start_value;
  const shown = `${num(value)}${info.unit ? ` ${info.unit}` : ''}`;
  if (ev.threshold !== null && ev.threshold !== undefined && value < ev.threshold) return t('notice_out', { item: info.name, value: shown });
  return t('notice_over', { item: info.name, value: shown, th: num(ev.threshold) });
}

function loadFailed(app) {
  return !app.data.status && app.error ? stateBlock('err_load', 'err_load_hint', true) : null;
}

// ============================================================ 首頁：桌面
export function deskView(app) {
  const verdict = h('h1', { class: 'verdict px' }, t('verdict_wait'));
  const tally = h('ul', { class: 'tally' });
  const tools = h('div', { class: 'desk-tools' });
  const el = h('div', { class: 'desk' }, deskMotif(), verdict, tally, tools);
  const desk = createDesk(el);
  const notices = new Map();      // 測站 id -> { state: 'open' | 'resolved', evs: [] }
  const dismissed = app.dismissed;
  const seenNotices = new Set();
  let openFrom = null;            // 剛從下方那排按鈕打開的小視窗（縮放框從按鈕出發）
  let noticesStarted = false;     // 第一批公告跟著桌面一起出現；之後才跳出來的會閃標題列
  let pagerStationId = null;      // 公告超過上限切換成單視窗模式時，目前停在哪一個測站
  let alive = true;
  let verdictText = ''; let stopTyping = () => {};
  let lastRowKey = '';
  let layoutMode = 'around';
  try { layoutMode = localStorage.getItem('iccc.layout') === 'tile' ? 'tile' : 'around'; } catch { /* 無法讀取就用預設 */ }
  el.dataset.layout = layoutMode;
  const PAD = 24;
  function metrics() {
    const { w, h } = desk.size();
    const gap = Math.round(Math.min(24, Math.max(16, w * 0.012)));
    const motifReserve = Math.round(Math.min(84, Math.max(36, h * 0.085)));
    const usableW = Math.max(640, w - PAD * 2);
    const noticeCount = notices.size;
    const hasNotices = noticeCount > 0;
    const headerBottom = Math.max(136, tools.offsetTop + tools.offsetHeight + gap);

    const rightW = Math.round(Math.min(540, Math.max(380, usableW * 0.36)));
    const leftAreaW = Math.max(480, usableW - rightW - gap);

    const col1W = Math.round((usableW - gap * 2) * 0.28);
    const col2W = Math.round((usableW - gap * 2) * 0.28);
    const col3W = usableW - col1W - col2W - gap * 2;
    const noticeAreaW = layoutMode === 'tile' ? (col1W + gap + col2W) : leftAreaW;

    // 依左區寬度計算最多可並排幾個通知才不擁擠（每卡至少 240px），超過就改由單一視窗內切換
    const maxNoticeCols = Math.max(2, Math.min(4, Math.floor((noticeAreaW + gap) / (264 + gap))));
    const usePager = noticeCount > maxNoticeCols;
    const noticeCols = usePager ? 1 : Math.max(2, Math.min(maxNoticeCols, noticeCount || 2));
    const noticeW = usePager
      ? Math.min(noticeAreaW, Math.max(440, Math.round(noticeAreaW * 0.68)))
      : Math.floor((noticeAreaW - gap * (noticeCols - 1)) / noticeCols);

    const leftAvailH = Math.max(300, h - headerBottom - PAD);
    const noticeH = hasNotices ? Math.round(Math.min(256, Math.max(200, (leftAvailH - gap) * 0.44))) : 0;
    const row2Y = hasNotices ? headerBottom + noticeH + gap : headerBottom;
    const infoH = hasNotices
      ? Math.round(Math.min(310, Math.max(200, leftAvailH - noticeH - gap)))
      : Math.round(Math.min(340, Math.max(220, leftAvailH * 0.62)));

    // 右欄上下兩個視窗依 54% / 46% 分配垂直高度，考量測站名稱換行高度（約 44px/列）反推列數
    const rightTop = 16;
    const rightAvailH = Math.max(400, h - rightTop - motifReserve);
    const stationsH = Math.round((rightAvailH - gap) * 0.54);
    const openH = rightAvailH - gap - stationsH;
    const stationRows = Math.max(4, Math.min(8, Math.floor((stationsH - 96) / 44)));
    const openRows = Math.max(2, Math.min(4, Math.floor((openH - 140) / 56)));

    const bottomColW = Math.floor((leftAreaW - gap) / 2);
    const bottomCol2W = leftAreaW - bottomColW - gap;

    if (layoutMode === 'tile') {
      const tileRightH = Math.max(380, h - headerBottom - motifReserve);
      const tileStationsH = Math.round((tileRightH - gap) * 0.54);
      const tileOpenH = tileRightH - gap - tileStationsH;
      return {
        w, h, gap, hasNotices, noticeCount, noticeW, noticeH, maxNoticeCols, usePager, headerBottom,
        stationRows: Math.max(4, Math.min(8, Math.floor((tileStationsH - 96) / 44))),
        openRows: Math.max(2, Math.min(4, Math.floor((tileOpenH - 140) / 56))),
        stdW: col1W, stdH: infoH, stdPos: [PAD, row2Y],
        sysW: col2W, sysH: infoH, sysPos: [PAD + col1W + gap, row2Y],
        stationsW: col3W, stationsH: tileStationsH, stationsPos: [PAD + col1W + gap + col2W + gap, headerBottom],
        openW: col3W, openH: tileOpenH, openPos: [PAD + col1W + gap + col2W + gap, headerBottom + tileStationsH + gap],
      };
    }

    return {
      w, h, gap, hasNotices, noticeCount, noticeW, noticeH, maxNoticeCols, usePager, headerBottom,
      stationRows, openRows,
      stdW: bottomColW, stdH: infoH, stdPos: [PAD, row2Y],
      sysW: bottomCol2W, sysH: infoH, sysPos: [PAD + bottomColW + gap, row2Y],
      stationsW: rightW, stationsH, stationsPos: [w - PAD - rightW, rightTop],
      openW: rightW, openH, openPos: [w - PAD - rightW, rightTop + stationsH + gap],
    };
  }

  // 左下兩視窗永遠排在上方公告視窗實際下緣 + gap 之後，避免多行換行時上下重疊
  function row2YActual() {
    const m = metrics();
    let maxNoticeH = m.noticeH;
    el.querySelectorAll('[data-win^="notice-"]').forEach((n) => {
      if (!n.classList.contains('shaded')) maxNoticeH = Math.max(maxNoticeH, n.offsetHeight);
    });
    return m.hasNotices ? m.headerBottom + maxNoticeH + m.gap : m.headerBottom;
  }
  function infoHActual() {
    const m = metrics();
    const y2 = row2YActual();
    return Math.min(320, Math.max(200, m.h - y2 - PAD));
  }
  // 右下視窗永遠貼齊「測站」實際下緣 + gap，避免多行換行時上下重疊
  function openHome() {
    const m = metrics();
    const stEl = el.querySelector('[data-win="stations"]');
    const stH = stEl ? Math.max(m.stationsH, stEl.offsetHeight) : m.stationsH;
    return [m.openPos[0], m.stationsPos[1] + stH + m.gap];
  }

  const FIXED = {
    stations: { title: 'win_stations', icon: 'stations', width: () => metrics().stationsW, height: () => metrics().stationsH, expand: () => app.link('stations'), home: () => metrics().stationsPos, body: stationsBody },
    open: { title: 'win_open', icon: 'alarm', width: () => metrics().openW, height: () => metrics().openH, expand: () => app.link('events', null, { state: (app.data.events ?? []).some((ev) => !ev.ended_at) ? 'open' : null }), home: openHome, body: openBody },
    standards: { title: 'win_standards', icon: 'standards', tight: 284, width: () => metrics().stdW, height: infoHActual, expand: () => app.link('standards'), home: () => [metrics().stdPos[0], row2YActual()], body: standardsBody },
    system: { title: 'win_system', icon: 'system', tight: 264, width: () => metrics().sysW, height: infoHActual, body: systemBody, home: () => [metrics().sysPos[0], row2YActual()] },
  };

  function drawVerdict() {
    const stations = app.data.status?.stations;
    const ready = stations && stations.some((st) => st.level !== null && st.level !== undefined);
    if (!ready) {
      stopTyping(); verdictText = '';
      verdict.removeAttribute('aria-label');
      fill(verdict, t('verdict_wait')); fill(tally);
      return;
    }
    const count = { 0: 0, 1: 0, 2: 0, 3: 0 };
    stations.forEach((st) => { if (st.level in count) count[st.level] += 1; });
    const hits = [];
    if (count[2]) hits.push([2, t('hit_alarm', { n: count[2] })]);
    if (count[3]) hits.push([3, t('hit_offline', { n: count[3] })]);
    if (!hits.length && count[1]) hits.push([1, t('hit_warn', { n: count[1] })]);
    if (!hits.length) hits.push([0, t('hit_ok')]);
    const [before, after] = t('verdict_alarm', { total: stations.length, hit: '\u0000' }).split('\u0000');
    const parts = [before];
    hits.forEach(([level, text], i) => parts.push(i ? (lang() === 'zh' ? '、' : ', ') : null, h('span', { class: 'hit', 'data-level': level }, text)));
    fill(tally, ...[2, 3, 1, 0].map((level) => h('li', null, chip(level), h('span', { class: 'value' }, count[level]))));
    // 結論句只有內容變了才重打一次（一個字一個字出現，提醒「狀態變了」）；沒變就不動它
    // 用非主要標準看的時候，先寫明這是試算：畫面上的異常數會和告警、事件紀錄不一樣
    const trial = Boolean(app.std && app.activeStd && app.std !== app.activeStd);
    const text = `${lang()}|${trial ? app.std : ''}|${before}${hits.map(([level, hit]) => `${level}:${hit}`).join('|')}${after}`;
    if (text === verdictText) return;
    stopTyping();
    verdictText = text;
    fill(verdict, trial ? h('span', { class: 'trial' }, t('trial_prefix', { name: stdName(app.std) })) : null, ...parts.filter((p) => p !== null), after);
    const sentence = [...verdict.childNodes].filter((node) => !node.classList?.contains('trial')).map((node) => node.textContent).join('');
    verdict.setAttribute('aria-label', trial ? `${t('trial_prefix', { name: stdName(app.std) })}${colon()}${sentence}` : sentence);
    stopTyping = typeOut(verdict);
  }

  // 結論句下面的一排按鈕：四個小視窗各一個，按一下打開或收起（收起的會縮回這裡）
  function drawTools() {
    fill(tools,
      h('span', { class: 'seg dock', role: 'group', 'aria-label': t('windows') }, Object.entries(FIXED).map(([id, def]) => h('button', {
        type: 'button', 'data-key': id, 'aria-pressed': String(!desk.isClosed(id)),
        onclick: (e) => {
          if (desk.isClosed(id)) { openFrom = { id, rect: e.currentTarget.getBoundingClientRect() }; desk.reopen(id); } else desk.close(id, true);
          update();
        },
      }, icon(def.icon), t(def.title)))),
      h('button', { class: 'btn', type: 'button', onclick: () => { desk.reset(); dismissed.clear(); update(); } }, t('rearrange')),
      h('button', {
        class: 'btn', type: 'button', 'data-key': 'layout',
        onclick: () => {
          layoutMode = layoutMode === 'around' ? 'tile' : 'around';
          el.dataset.layout = layoutMode;
          try { localStorage.setItem('iccc.layout', layoutMode); } catch { /* 無法儲存不影響切換 */ }
          desk.reset();
          update();
        },
      }, t(`layout_${layoutMode}`)));
  }

  function stationsBody() {
    const stations = app.data.status?.stations;
    if (!stations) return [loadFailed(app) ?? skeleton()];
    const limit = metrics().stationRows;
    const rows = sorted(stations).slice(0, limit).map((st) => {
      const worst = worstItem(st, app.stdItems);
      return h('tr', null, h('td', null, chip(st.level, levelChanged(app, st))),
        h('td', { class: 'wrap' }, h('a', { href: app.link('station', st.id) }, stationName(st))),
        h('td', { class: 'num' }, st.level === 3 || !worst ? h('span', { class: 'muted' }, st.level === 3 ? levelName(3) : t('no_value'))
          : [h('span', { class: 'muted' }, `${itemName(worst.code, worst.cell.name)} `), valueUnit(worst.cell.value, worst.cell.unit, direction(app, st, worst.code, worst.cell.value))]));
    });
    return [h('table', { class: 'grid compact' }, h('tbody', null, rows)),
      h('div', { class: 'win-foot' }, h('a', { class: 'btn', href: app.link('stations') }, t('see_all_stations', { n: stations.length })))];
  }

  function openBody() {
    const events = app.data.events;
    if (!events) return [loadFailed(app) ?? skeleton()];
    const open = events.filter((ev) => !ev.ended_at);
    const trial = Boolean(app.std && app.activeStd && app.std !== app.activeStd);
    const limit = Math.max(1, metrics().openRows - (trial ? 1 : 0));       // 試算時上面多一行說明，少列一則才放得下
    const items = open.slice(0, limit).map((ev) => h('tr', null, h('td', null, chip(eventLevel(ev))),
      h('td', { class: 'wrap' }, h('a', { href: app.link('station', ev.station_id) }, stationName(stationById(app, ev.station_id)) || ev.station_id),
        h('br'), h('span', { class: 'muted' }, eventSentence(app, ev))),
      h('td', { class: 'num muted' }, ago(seconds(ev.started_at)))));
    return [trial ? h('p', { class: 'muted small' }, t('main_note', { name: stdName(app.activeStd) })) : null,
      open.length ? h('table', { class: 'grid compact' }, h('tbody', null, items)) : h('p', { class: 'all-clear' }, icon('ok'), t('no_open')),
      open.length > limit ? h('p', { class: 'muted' }, t('more_open', { n: open.length - limit })) : null,
      h('div', { class: 'win-foot' }, h('a', { class: 'btn', href: app.link('events', null, { state: open.length ? 'open' : null }) }, t('see_events')))];
  }

  function standardsBody() {
    if (!app.data.standards) return [loadFailed(app) ?? skeleton()];
    const rows = ['pm25', 'pm10', 'ph', 'turbidity'].filter((code) => app.stdItems?.[code]).map((code) => h('tr', null,
      h('td', null, itemInfo(app, code).name), h('td', { class: 'num' }, thresholdText(app.stdItems[code]))));
    return [h('p', null, t('judged_by', { name: stdName(app.std) })),
      app.std !== app.activeStd ? h('p', { class: 'muted' }, t('main_note', { name: stdName(app.activeStd) })) : null,
      h('table', { class: 'grid compact' }, h('tbody', null, rows)),
      h('div', { class: 'win-foot opt' }, h('a', { class: 'btn', href: app.link('standards') }, t('see_standards')))];     // 空間不夠時收起來：標題列的「放大」是同一個功能
  }

  function systemBody() {
    const health = app.data.health;
    if (!health) return [loadFailed(app) ?? skeleton()];
    const running = !app.error && health.last_run && seconds(health.last_run) <= 60;
    return [h('dl', { class: 'kv' },
      h('dt', null, t('sys_source')), h('dd', null, t(`src_${health.data_source}`)),
      h('dt', null, t('sys_updated')), h('dd', null, health.last_run ? `${clock(new Date(health.last_run))}${paren(ago(seconds(health.last_run)))}` : t('detector_wait')),
      h('dt', null, t('sys_detector')), h('dd', null, running ? t('sys_running') : t('sys_stopped')),
      h('dt', null, t('sys_started')), h('dd', null, dateTime(health.started_at, true))),
    mode === 'live'
      ? h('div', { class: 'win-foot' }, h('a', { class: 'btn', href: grafanaUrl(null, app.std), rel: 'noopener noreferrer' }, t('grafana')), h('a', { class: 'btn', href: 'docs' }, t('api_docs')))
      : [h('p', { class: 'muted opt' }, t('data_credit_short')), h('p', { class: 'muted' }, t('credit'))]];       // 完整的資料來源說明在右上角的「?」裡
  }

  // 異常公告：在視窗寬度容許內每個異常／斷線測站獨立並排；超過上限時自動收斂為單一視窗內切換
  function noticeMeta(notice) {
    const evs = notice.evs;
    const primary = evs.find((e) => eventLevel(e) === 3) ?? evs[0];
    const level = eventLevel(primary);
    const resolved = notice.state === 'resolved';
    return {
      evs, primary, level, resolved,
      tone: resolved ? 0 : level,
      statusKey: resolved ? 'notice_recovered' : (level === 3 ? 'notice_offline' : 'notice_alarm'),
      statusIcon: resolved ? 'ok' : (level === 3 ? 'offline' : 'alarm'),
    };
  }

  function orderedNoticeIds() {
    return [...notices.keys()].sort((a, b) => {
      const ma = noticeMeta(notices.get(a));
      const mb = noticeMeta(notices.get(b));
      return (ma.resolved ? 9 : rank(ma.level)) - (mb.resolved ? 9 : rank(mb.level));
    });
  }

  function renderNoticeContent(stId, notice, summaryLine, footerNodes) {
    const { evs, primary, resolved, level } = noticeMeta(notice);
    // 公告的高度是固定的：夠高才列兩則，否則列一則，後面註明還有幾則
    const room = metrics().noticeH >= 214 ? 2 : 1;
    const lines = resolved
      ? [h('p', null, `${itemInfo(app, primary.item).name}${colon()}${t('notice_recovered')}`)]
      : evs.slice(0, room).map((e, i) => h('p', null, eventSentence(app, e),
        i === room - 1 && evs.length > room ? h('span', { class: 'muted small' }, paren(t('notice_more', { n: evs.length - room }))) : null));
    // 高度不夠時「開始於」只寫多久以前；文字區放不下的部分直接裁掉，按鈕永遠留在底部
    const since = room === 1 ? ago(seconds(primary.started_at)) : `${dateTime(primary.started_at)}${paren(ago(seconds(primary.started_at)))}`;
    return [
      summaryLine,
      h('div', { class: 'notice-text' },
        h('p', { class: 'notice-head' }, summaryLine ? chip(resolved ? 0 : level) : null, stationName(stationById(app, stId)) || stId),
        ...lines,
        h('p', { class: 'muted' }, t('notice_since', { t: since }))),
      h('div', { class: 'win-foot' }, ...footerNodes),
    ].filter(Boolean);
  }

  function drawNotices() {
    const events = app.data.events;
    if (!events) return;
    const open = events.filter((ev) => !ev.ended_at);
    const openIds = new Set(open.map((ev) => ev.id));
    [...dismissed].forEach((id) => { if (!openIds.has(id)) dismissed.delete(id); });
    const byStation = new Map();
    // 公告只給剛發生的（五分鐘內）。持續很久的異常留在「進行中的異常」清單裡，不一直用紅框佔著桌面
    open.filter((ev) => !dismissed.has(ev.id) && seconds(ev.started_at) <= NOTICE_FRESH_SECONDS).forEach((ev) => {
      if (!byStation.has(ev.station_id)) byStation.set(ev.station_id, []);
      byStation.get(ev.station_id).push(ev);
    });
    for (const [stId, notice] of notices) {
      if (notice.state === 'open' && !byStation.has(stId)) {
        const actuallyResolved = notice.evs.every((ev) => !openIds.has(ev.id));
        if (!actuallyResolved) { notices.delete(stId); desk.close(`notice-${stId}`); continue; }
        notice.state = 'resolved';
        setTimeout(() => {
          if (!alive) return;
          desk.close(`notice-${stId}`);
          notices.delete(stId);
          drawNotices();
          desk.rehome();
        }, 20000);
      }
    }
    for (const [stId, evs] of byStation) {
      if (notices.has(stId)) {
        const cur = notices.get(stId);
        cur.state = 'open';
        cur.evs = evs;
      } else {
        notices.set(stId, { state: 'open', evs });
      }
    }

    const ids = orderedNoticeIds();

    if (!ids.length) {
      desk.close('notice-pager');
      pagerStationId = null;
      noticesStarted = true;
      return;
    }

    const m = metrics();
    lastRowKey = `${m.stationRows}|${m.openRows}|${m.usePager ? 1 : 0}`;
    const markDismissed = (stId) => {
      const target = notices.get(stId);
      if (target) target.evs.forEach((e) => dismissed.add(e.id));
      notices.delete(stId);
      if (pagerStationId === stId) pagerStationId = null;
    };
    const dismissStation = (stId) => {
      markDismissed(stId);
      drawNotices();
      desk.rehome();
    };
    const dismissAll = () => {
      notices.forEach((n) => n.evs.forEach((e) => dismissed.add(e.id)));
      notices.clear();
      pagerStationId = null;
      desk.rehome();
    };
    const alertSourceRect = () => (verdict.querySelector('.hit') ?? verdict).getBoundingClientRect();

    if (m.usePager) {
      ids.forEach((stId) => desk.close(`notice-${stId}`));
      if (!pagerStationId || !notices.has(pagerStationId)) pagerStationId = ids[0];
      const pos = Math.max(0, ids.indexOf(pagerStationId));
      const stId = ids[pos];
      const notice = notices.get(stId);
      const meta = noticeMeta(notice);
      const isNewAlert = noticesStarted && ids.some((id) => !seenNotices.has(id));
      ids.forEach((id) => seenNotices.add(id));

      let alarmN = 0; let offlineN = 0;
      ids.forEach((id) => {
        const info = noticeMeta(notices.get(id));
        if (!info.resolved && info.level === 2) alarmN += 1;
        if (!info.resolved && info.level === 3) offlineN += 1;
      });
      const summaryParts = [];
      if (alarmN) summaryParts.push(t('hit_alarm', { n: alarmN }));
      if (offlineN) summaryParts.push(t('hit_offline', { n: offlineN }));
      const sep = lang() === 'zh' ? '、' : ', ';
      const summaryLine = summaryParts.length
        ? h('p', { class: 'muted small' }, t('notice_summary', { total: ids.length, parts: summaryParts.join(sep) }))
        : null;

      const step = (delta) => {
        pagerStationId = ids[(pos + delta + ids.length) % ids.length];
        drawNotices();
        desk.rehome();
      };

      const body = desk.open('notice-pager', {
        title: `${t(meta.statusKey)} (${pos + 1}/${ids.length})`,
        icon: meta.statusIcon,
        tone: meta.tone,
        width: () => metrics().noticeW,
        height: () => metrics().noticeH,
        persist: false,
        expand: () => app.link('station', stId),
        arrive: 4,
        attention: isNewAlert,
        from: isNewAlert ? alertSourceRect : null,
        home: () => [PAD, metrics().headerBottom],
        onClose: dismissAll,
      });
      fill(body, ...renderNoticeContent(stId, notice, summaryLine, [
        h('span', { class: 'notice-pager' },
          h('button', { class: 'btn square', type: 'button', 'aria-label': t('prev_station'), title: t('prev_station'), onclick: () => step(-1) }, icon('left')),
          h('span', { class: 'notice-pager-pos' }, t('notice_page', { i: pos + 1, n: ids.length })),
          h('button', { class: 'btn square', type: 'button', 'aria-label': t('next_station'), title: t('next_station'), onclick: () => step(1) }, icon('right'))),
        h('a', { class: 'btn primary', href: app.link('station', stId) }, t('see_station')),
        h('button', { class: 'btn', type: 'button', onclick: () => dismissStation(stId) }, t('notice_dismiss_one')),
      ]));
      noticesStarted = true;
      return;
    }

    desk.close('notice-pager');
    pagerStationId = null;
    ids.forEach((stId, idx) => {
      const notice = notices.get(stId);
      const meta = noticeMeta(notice);
      const isNewAlert = noticesStarted && !seenNotices.has(stId);
      seenNotices.add(stId);
      const body = desk.open(`notice-${stId}`, {
        title: t(meta.statusKey),
        icon: meta.statusIcon,
        tone: meta.tone,
        width: () => metrics().noticeW,
        height: () => metrics().noticeH,
        persist: false,
        expand: () => app.link('station', stId),
        arrive: 4 + idx,
        attention: isNewAlert,
        from: isNewAlert ? alertSourceRect : null,
        home: () => {
          const cur = metrics();
          const slot = Math.max(0, orderedNoticeIds().indexOf(stId));
          return [PAD + slot * (cur.noticeW + cur.gap), cur.headerBottom];
        },
        onClose: () => {
          markDismissed(stId);
          drawNotices();
          desk.rehome();
        },
      });
      fill(body, ...renderNoticeContent(stId, notice, null, [
        h('a', { class: 'btn primary', href: app.link('station', stId) }, t('see_station')),
      ]));
    });
    noticesStarted = true;
  }

  function update() {
    drawVerdict();
    drawTools();
    drawNotices();
    const m = metrics();
    lastRowKey = `${m.stationRows}|${m.openRows}|${m.usePager ? 1 : 0}`;
    Object.entries(FIXED).forEach(([id, def], i) => {
      if (desk.isClosed(id)) { desk.close(id); return; }
      const body = desk.open(id, {
        title: t(def.title), icon: def.icon, size: def.size, width: def.width, height: def.height, tight: def.tight, home: def.home, expand: def.expand, arrive: i,
        from: openFrom?.id === id ? openFrom.rect : null,
        closeTo: () => tools.querySelector(`[data-key="${id}"]`)?.getBoundingClientRect(),
        onClose: () => drawTools(),
      });
      fill(body, ...def.body().flat(Infinity).filter(Boolean));
    });
    openFrom = null;
    desk.rehome();
  }
  const onWinResize = () => {
    const m = metrics();
    const key = `${m.stationRows}|${m.openRows}|${m.usePager ? 1 : 0}`;
    if (key !== lastRowKey) update();
  };
  window.addEventListener('resize', onWinResize);
  // 結論句的高度變了（點陣字載入完成、視窗變窄而換行）時，還在預設位置的小視窗跟著往下或往上讓開
  const watcher = new ResizeObserver(() => desk.rehome());
  watcher.observe(verdict);
  return { el, update, destroy: () => { alive = false; window.removeEventListener('resize', onWinResize); watcher.disconnect(); stopTyping(); desk.destroy(); } };
}

// ============================================================ 測站清單
export function stationsView(app) {
  const body = h('div', { class: 'panel scroll-x' }, skeleton());
  const frame = sheet(app, 'stations',
    h('div', { class: 'page-head' }, h('h1', { class: 'px' }, t('stations_title')), h('p', { class: 'lede muted' }, t('stations_lede'))), body);
  let alive = true; let redraw = 0;

  // 每一列的小趨勢圖：一分鐘重新讀一次，讀到之前先用上一次的
  const sparks = new Map();       // `測站|測項` -> { at, data }
  function spark(st, worst) {
    const key = `${st.id}|${worst.code}`;
    let hit = sparks.get(key);
    if (!hit || Date.now() - hit.at > 60000) {
      hit = { at: Date.now(), data: hit?.data ?? null };
      sparks.set(key, hit);
      source.history(st.id, worst.code, 60).then((data) => {
        hit.data = data; hit.failed = false;
        clearTimeout(redraw);
        redraw = setTimeout(() => { if (alive) update(); }, 60);     // 幾個測站的資料差不多同時回來，等一下一起重畫
      }).catch(() => { hit.failed = true; });      // 讀不到就寫「暫時讀不到」，其他欄位不受影響；一分鐘後會再試
    }
    const name = itemName(worst.code, worst.cell.name);
    if (hit.data) return sparkline({ data: hit.data, th: worst.th, level: worst.cell.level, label: `${name}${paren(t(mode === 'demo' ? 'range_demo' : 'range_60'))}` });
    return hit.failed ? h('span', { class: 'muted small' }, t('spark_none')) : null;
  }

  function update() {
    frame.setCrumbs([[t('nav_desk'), app.link('desk')], [t('stations_title')]]);
    const stations = app.data.status?.stations;
    if (!stations) { fill(body, loadFailed(app) ?? skeleton()); return; }
    const rows = sorted(stations).map((st) => {
      const worst = worstItem(st, app.stdItems);
      const detail = st.level === 3
        ? [h('td', { colspan: 4 }, noData(st.data_time_utc ? t('offline_since', { t: dateTime(st.data_time_utc, true) }) : levelName(3)))]
        : !worst ? [h('td', { colspan: 4 }, noData(t('no_value')))]
          : [h('td', null, itemName(worst.code, worst.cell.name)),
            h('td', { class: 'num' }, valueUnit(worst.cell.value, worst.cell.unit, direction(app, st, worst.code, worst.cell.value))),
            h('td', null, gauge(worst.cell.value, worst.th, worst.cell.level, lastValue(app, st, worst.code)) ?? h('span', { class: 'muted small' }, t('not_judged'))),
            h('td', null, spark(st, worst))];
      return h('tr', null, h('td', null, chip(st.level, levelChanged(app, st))),
        h('td', null, h('a', { href: app.link('station', st.id) }, stationName(st))), h('td', null, kindName(st.kind)),
        detail, h('td', null, dateTime(st.data_time_utc)));
    });
    fill(body, h('table', { class: 'grid' },
      h('thead', null, h('tr', null, ['th_state', 'th_station', 'th_kind', 'th_worst'].map((k) => h('th', null, t(k))),
        h('th', { class: 'num' }, t('th_value')), h('th', null, t('th_scale')),
        h('th', null, t(mode === 'demo' ? 'th_trend_demo' : 'th_trend')), h('th', null, `${t('th_data_time')}${paren(zone())}`))),
      h('tbody', null, rows)));
  }
  return { el: frame.el, update, destroy() { alive = false; clearTimeout(redraw); } };
}

// ============================================================ 單一測站
export function stationView(app, id) {
  const head = h('div', { class: 'page-head' });
  const values = h('div', { class: 'scroll-x' }, skeleton());
  const charts = h('div', { class: 'charts' });
  const rangeBar = h('div', { class: 'toolbar' });
  const events = h('div', { class: 'scroll-x' }, skeleton());
  const frame = sheet(app, 'stations', head,
    h('section', { class: 'panel' }, h('h2', { class: 'px' }, t('station_values')), values),
    h('section', { class: 'panel' }, h('h2', { class: 'px' }, t('station_trends')), h('div', { class: 'panel-body' }, rangeBar), h('div', { class: 'panel-body' }, charts)),
    h('section', { class: 'panel' }, h('h2', { class: 'px' }, t('station_events')), events));
  let chartsKey = ''; let chartsAt = 0; let alive = true;

  // animate：第一次畫（或換了時間範圍）時線會從左畫到右；每分鐘的例行更新不重播
  async function loadCharts(st, minutes, animate) {
    const codes = Object.keys(st.items || {});
    if (!charts.children.length) fill(charts, skeleton(true));
    try {
      const all = await Promise.all(codes.map((code) => source.history(st.id, code, minutes)));
      if (!alive) return;
      const figs = all.map((data, i) => ({ data, code: codes[i] })).filter(({ data, code }) => data.points.length || app.stdItems?.[code])
        .map(({ data, code }, i) => lineChart({ title: itemInfo(app, code).name, unit: data.unit || itemInfo(app, code).unit, data, th: app.stdItems?.[code], animate, index: i }));
      fill(charts, ...(figs.length ? figs : [stateBlock('empty_points', 'empty_points_hint')]));
    } catch {
      if (alive) fill(charts, stateBlock('err_history', 'err_history_hint', true));
    }
  }

  async function update() {
    const st = stationById(app, id);
    const trail = [[t('nav_desk'), app.link('desk')], [t('stations_title'), app.link('stations')]];
    if (!app.data.status) { frame.setCrumbs([...trail, [id]]); fill(head, h('h1', { class: 'px' }, id)); fill(values, loadFailed(app) ?? skeleton()); return; }
    if (!st) {
      frame.setCrumbs([...trail, [id]]);
      fill(frame.body, h('div', { class: 'panel' }, stateBlock('not_found', 'not_found_hint', true)),
        h('p', null, h('a', { class: 'btn', href: app.link('stations') }, t('back_stations'))));
      return;
    }
    frame.setCrumbs([...trail, [stationName(st)]]);
    // 上一站／下一站：順序和測站清單相同（最嚴重的在前面），demo 時可以一站一站往下看
    const order = sorted(app.data.status.stations);
    const at = order.findIndex((other) => other.id === st.id);
    const step = (other, key, name) => (other
      ? h('a', { class: 'btn', href: app.link('station', other.id, { range: app.query.range }), title: stationName(other), 'data-key': key }, key === 'prev' ? icon(name) : null, t(`${key}_station`), key === 'next' ? icon(name) : null)
      : h('span', { class: 'btn', 'aria-disabled': 'true' }, key === 'prev' ? icon(name) : null, t(`${key}_station`), key === 'next' ? icon(name) : null));
    fill(head, h('h1', { class: 'px' }, stationName(st)), chip(st.level, levelChanged(app, st)), h('span', { class: 'spacer' }),
      h('span', { class: 'seg' }, step(order[at - 1], 'prev', 'left'), step(order[at + 1], 'next', 'right')),
      mode === 'live' ? h('a', { class: 'btn', href: grafanaUrl(st.id, app.std), rel: 'noopener noreferrer' }, t('open_grafana')) : null,
      h('p', { class: 'lede muted' }, `${kindName(st.kind)}${gap()}${t('th_data_time')} ${dateTime(st.data_time_utc, true) || t('no_value')}`));

    const rows = Object.entries(st.items || {}).map(([code, cell]) => {
      const th = app.stdItems?.[code];
      const missing = cell.value === null || cell.value === undefined;
      const flag = cell.flag ? (cell.flag.startsWith('invalid') ? t('flag_invalid') : t('flag_missing')) : '';
      return h('tr', null, h('td', null, itemName(code, cell.name)),
        missing ? h('td', { colspan: 3 }, noData(flag || t('no_value')))
          : [h('td', { class: 'num' }, valueUnit(cell.value, cell.unit, direction(app, st, code, cell.value))),
            h('td', null, cell.level === null || cell.level === undefined ? h('span', { class: 'muted small' }, t('not_judged')) : chip(cell.level)),
            h('td', null, gauge(cell.value, th, cell.level, lastValue(app, st, code)))],
        h('td', { class: 'num' }, th ? thresholdText(th) : ''), h('td', { class: 'muted' }, missing ? '' : flag));
    });
    fill(values, rows.length ? h('table', { class: 'grid' },
      h('thead', null, h('tr', null, h('th', null, t('th_item')), h('th', { class: 'num' }, t('th_value')), h('th', null, t('th_state')),
        h('th', null, t('th_scale')), h('th', { class: 'num' }, `${t('th_warn')} / ${t('th_alarm')}`), h('th', null, t('th_flag')))),
      h('tbody', null, rows)) : stateBlock('empty_points', 'empty_points_hint'));

    // 趨勢：換了時間範圍或過了一分鐘才重新讀取，不是每 10 秒都重畫
    const span = mode === 'demo' ? await demoSpanMinutes() : null;
    const minutes = span ?? ([60, 360, 1440].includes(Number(app.query.range)) ? Number(app.query.range) : 60);
    fill(rangeBar, h('span', { class: 'seg-label' }, t('range_label')),
      span ? h('span', { class: 'tag' }, `${t('range_demo')}${paren(duration(span * 60))}`)
        : h('span', { class: 'seg', role: 'group', 'aria-label': t('range_label') }, [60, 360, 1440].map((m) => h('button', {
          type: 'button', 'aria-pressed': String(m === minutes), onclick: () => app.navigate('station', id, { range: m === 60 ? null : m }),
        }, t(`range_${m}`)))));
    const key = `${st.id}|${minutes}|${app.std}`;
    if (key !== chartsKey || Date.now() - chartsAt > 60000) {
      const first = key !== chartsKey;
      if (first) fill(charts, skeleton(true));
      chartsKey = key; chartsAt = Date.now();
      loadCharts(st, minutes, first);
    }
    const stationEvents = (app.data.events ?? []).filter((ev) => ev.station_id === id);
    const note = app.std && app.activeStd && app.std !== app.activeStd
      ? h('p', { class: 'panel-note small' }, t('main_note', { name: stdName(app.activeStd) }))
      : null;
    fill(events, note, eventsTable(app, stationEvents, false));
  }
  return { el: frame.el, update, destroy() { alive = false; } };
}

// ============================================================ 事件紀錄
function orderEvents(list) {
  return [...list].sort((a, b) => (a.ended_at ? 1 : 0) - (b.ended_at ? 1 : 0) || Date.parse(b.started_at) - Date.parse(a.started_at));
}
function eventsTable(app, list, withStation = true) {
  if (!list.length) return stateBlock('empty_events', 'empty_events_hint');
  const columns = withStation ? 9 : 8;
  const ordered = orderEvents(list);
  const openCount = ordered.filter((ev) => !ev.ended_at).length;
  const rows = [];
  ordered.forEach((ev, index) => {
    // 進行中的排前面、已結束的排後面，各有一列小標題
    if (index === 0 && openCount) rows.push(h('tr', { class: 'group' }, h('th', { colspan: columns, scope: 'colgroup' }, t('group_open', { n: openCount }))));
    if (index === openCount && openCount < ordered.length) rows.push(h('tr', { class: 'group' }, h('th', { colspan: columns, scope: 'colgroup' }, t('group_closed', { n: ordered.length - openCount }))));
    const info = itemInfo(app, ev.item);
    const until = ev.ended_at ? Date.parse(ev.ended_at) : Date.now();
    const isOffline = eventLevel(ev) === 3;
    const badge = chip(eventLevel(ev));
    if (ev.ended_at) badge.classList.add('hollow');       // 已結束的用空心標籤，實心的顏色留給還在進行的
    rows.push(h('tr', { class: ev.ended_at ? null : 'open' }, h('td', null, dateTime(ev.started_at)),
      withStation ? h('td', null, h('a', { href: app.link('station', ev.station_id) }, stationName(stationById(app, ev.station_id)) || ev.station_id)) : null,
      h('td', null, info.name), h('td', null, badge),
      h('td', { class: 'num' }, isOffline ? '' : valueUnit(ev.start_value, info.unit)), h('td', { class: 'num' }, isOffline ? '' : valueUnit(ev.max_value, info.unit)),
      h('td', { class: 'num' }, isOffline ? '' : num(ev.threshold)), h('td', { class: 'num' }, duration((until - Date.parse(ev.started_at)) / 1000)),
      h('td', null, ev.ended_at ? `${dateTime(ev.ended_at)}${gap()}${reasonName(ev.end_reason)}` : h('span', { class: 'tag' }, t('ongoing')))));
  });
  return h('table', { class: 'grid' },
    h('thead', null, h('tr', null, h('th', null, `${t('th_start')}${paren(zone())}`), withStation ? h('th', null, t('th_station')) : null, h('th', null, t('th_item')), h('th', null, t('th_level')),
      h('th', { class: 'num' }, t('th_start_value')), h('th', { class: 'num' }, t('th_max_value')), h('th', { class: 'num' }, t('th_threshold')),
      h('th', { class: 'num' }, t('th_duration')), h('th', null, t('th_end')))),
    h('tbody', null, rows));
}

export function eventsView(app) {
  const stationSelect = h('select', { class: 'field', id: 'f-station', onchange: () => go() });
  const stateSelect = h('select', { class: 'field', id: 'f-state', onchange: () => go() },
    h('option', { value: '' }, t('all')), h('option', { value: 'open' }, t('state_open')), h('option', { value: 'closed' }, t('state_closed')));
  const count = h('span', { class: 'muted small', 'aria-live': 'polite' });
  const exportBtn = h('button', { class: 'btn', type: 'button', onclick: () => exportCsv() }, t('export_csv'));
  const table = h('div', { class: 'panel scroll-x' }, skeleton());
  const lede = h('p', { class: 'lede muted' });
  const frame = sheet(app, 'alarm', h('div', { class: 'page-head' }, h('h1', { class: 'px' }, t('events_title')), lede),
    h('div', { class: 'toolbar' }, h('label', { class: 'field-label', for: 'f-station' }, t('filter_station'), stationSelect),
      h('label', { class: 'field-label', for: 'f-state' }, t('filter_state'), stateSelect), count, h('span', { class: 'spacer' }), exportBtn), table);
  let shown = []; let optionsKey = '';
  const go = () => app.navigate('events', null, { station: stationSelect.value || null, state: stateSelect.value || null });

  function exportCsv() {
    const head = ['id', t('th_start'), t('th_end'), t('th_station'), 'station_id', t('th_item'), t('th_level'), t('std_label'), t('th_start_value'), t('th_max_value'), t('th_threshold'), t('th_flag')];
    const rows = orderEvents(shown).map((ev) => [ev.id, ev.started_at, ev.ended_at ?? '', stationName(stationById(app, ev.station_id)) || ev.station_id, ev.station_id,
      itemInfo(app, ev.item).name, levelName(eventLevel(ev)), ev.standard, ev.start_value ?? '', ev.max_value ?? '', ev.threshold ?? '', ev.ended_at ? reasonName(ev.end_reason) : t('ongoing')]);
    downloadCsv(`events-${new Date().toISOString().slice(0, 10)}.csv`, [head, ...rows]);
  }

  function update() {
    frame.setCrumbs([[t('nav_desk'), app.link('desk')], [t('events_title')]]);
    lede.textContent = t('events_lede', { name: stdName(app.activeStd ?? 'india') });
    const stations = app.data.status?.stations ?? [];
    const key = stations.map((st) => `${st.id}:${stationName(st)}`).join('|');
    if (key !== optionsKey) {
      optionsKey = key;
      fill(stationSelect, h('option', { value: '' }, t('all')), ...stations.map((st) => h('option', { value: st.id }, stationName(st))));
    }
    stationSelect.value = stations.some((st) => st.id === app.query.station) ? app.query.station : '';
    stateSelect.value = ['open', 'closed'].includes(app.query.state) ? app.query.state : '';
    if (!app.data.events) { fill(table, loadFailed(app) ?? skeleton()); exportBtn.disabled = true; return; }
    shown = app.data.events.filter((ev) => (!stationSelect.value || ev.station_id === stationSelect.value)
      && (!stateSelect.value || (stateSelect.value === 'open') === !ev.ended_at));
    count.textContent = t('n_events', { n: shown.length });
    exportBtn.disabled = !shown.length;
    fill(table, eventsTable(app, shown));
  }
  return { el: frame.el, update, destroy() {} };
}

// ============================================================ 判斷標準
export function standardsView(app) {
  const body = h('div', { class: 'cols' }, skeleton());
  const frame = sheet(app, 'standards',
    h('div', { class: 'page-head' }, h('h1', { class: 'px' }, t('standards_title')), h('p', { class: 'lede muted' }, t('standards_lede'))), body);
  let drawn = '';
  function update() {
    frame.setCrumbs([[t('nav_desk'), app.link('desk')], [t('standards_title')]]);
    const all = app.data.standards?.standards;
    if (!all) { fill(body, loadFailed(app) ?? skeleton()); return; }
    const key = JSON.stringify([all, app.activeStd, Boolean(app.data.status)]);
    if (key === drawn) return;
    drawn = key;
    const keys = Object.keys(all);
    const codes = [...new Set(keys.flatMap((k) => Object.keys(all[k].items)))];
    const water = new Set(['ph', 'turbidity', 'tds']);
    const groups = [['kind_air', codes.filter((c) => !water.has(c))], ['kind_water', codes.filter((c) => water.has(c))]].filter(([, list]) => list.length);
    fill(body, ...groups.map(([title, list]) => h('section', { class: 'panel scroll-x' }, h('h2', { class: 'px' }, t(title)),
      h('table', { class: 'grid' },
        h('thead', null,
          h('tr', null, h('th', { rowspan: 2 }, t('th_item')), keys.map((k) => h('th', { colspan: 2 }, `${stdName(k)}${k === app.activeStd ? `${paren(t('std_main'))}` : ''}`))),
          h('tr', null, keys.map(() => [h('th', { class: 'num' }, t('th_warn')), h('th', { class: 'num' }, t('th_alarm'))]))),
        h('tbody', null, list.map((code) => {
          const info = itemInfo(app, code);
          return h('tr', null, h('td', null, info.name, info.unit ? h('span', { class: 'unit' }, info.unit) : null),
            keys.map((k) => {
              const th = all[k].items[code];
              if (!th) return h('td', { colspan: 2 }, noData(t('not_judged')));
              if (isRange(th)) return h('td', { class: 'num', colspan: 2 }, `${t('th_range')} ${thresholdText(th)}`);
              return [h('td', { class: 'num' }, num(th.warn)), h('td', { class: 'num' }, num(th.alarm))];
            }));
        }))))));
  }
  return { el: frame.el, update, destroy() {} };
}
