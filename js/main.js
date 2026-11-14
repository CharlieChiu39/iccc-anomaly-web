// 進入點：上方列、系統狀態列、換頁（網址 # 後面的部分）、每 10 秒更新資料。負責：CharlieChiu39
import { t, lang, setLang, stdName, clock, ago, duration, paren, colon } from './i18n.js';
import { source, mode, demoPlayer, grafanaUrl } from './data.js';
import { h, fill, icon, chip, gauge } from './ui.js';
import { calm, zoomRect } from './fx.js';
import { deskView, stationsView, stationView, eventsView, standardsView } from './views.js';

const REFRESH_MS = 10000;
const STALE_SECONDS = 60;
const bar = document.querySelector('.bar');
const strip = document.querySelector('.strip');
const main = document.querySelector('main');
const favicon = document.querySelector('link[rel="icon"]');
const wide = () => window.matchMedia('(min-width: 72rem)').matches;

const app = {
  data: { health: null, standards: null, status: null, events: null },
  error: null,
  route: 'desk', id: null, query: {},
  std: null, activeStd: null, stdItems: null,
  // 上一次更新時各測站的狀態與數值，用來標出「剛剛變了」和數值的升降
  was: { levels: new Map(), values: new Map() },
  dismissed: new Set(),
  freshUntil: 0,
  fresh: () => performance.now() < app.freshUntil,     // 現在這次重畫是不是因為剛收到新資料
  // 產生站內連結；選了非主要標準時，連結會帶著它
  link(route, id, query = {}) {
    const params = new URLSearchParams();
    const merged = { std: app.query.std, ...query };
    Object.entries(merged).forEach(([k, v]) => { if (v !== null && v !== undefined && v !== '') params.set(k, v); });
    const path = route === 'desk' ? '' : route + (id ? `/${encodeURIComponent(id)}` : '');
    const qs = params.toString();
    return `#/${path}${qs ? `?${qs}` : ''}`;
  },
  navigate(route, id, query) { location.hash = app.link(route, id, query); },
};

// ---------- 外觀（淺色／深色／跟著系統） ----------
const THEMES = ['auto', 'light', 'dark'];
let theme = 'auto';
try { theme = THEMES.includes(localStorage.getItem('iccc.theme')) ? localStorage.getItem('iccc.theme') : 'auto'; } catch { /* 用預設 */ }
function applyTheme() {
  if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme);
}

// ---------- 上方列 ----------
// 內容沒變就不重畫：每 10 秒更新資料時，鍵盤焦點才不會被清掉
let barKey = '';
let toolsOpen = false;       // 手機上「設定」有沒有展開
function drawBar() {
  const nav = [['desk', 'nav_desk'], ['stations', 'nav_stations'], ['events', 'nav_events'], ['standards', 'nav_standards']];
  const current = app.route === 'station' ? 'stations' : app.route;
  const keys = app.data.standards ? Object.keys(app.data.standards.standards) : ['india', 'taiwan'];
  const key = JSON.stringify([lang(), current, app.std, app.activeStd, theme, keys, Boolean(app.data.standards), app.query.std ?? null, toolsOpen]);
  if (key === barKey) return;
  barKey = key;
  fill(bar,
    h('a', { class: 'brand px', href: app.link('desk') }, icon('mark'), t('site')),
    h('nav', { class: 'nav', 'aria-label': t('site') }, nav.map(([route, name]) => h('a', { href: app.link(route), 'aria-current': route === current ? 'page' : null }, t(name)))),
    // 手機上判斷標準、語言、外觀、說明收在「設定」裡，第一屏留給結論句；寬螢幕上這顆按鈕不顯示
    h('button', { class: 'btn tools-toggle', type: 'button', 'data-key': 'tools-toggle', 'aria-expanded': String(toolsOpen), 'aria-controls': 'tools',
      onclick: () => { toolsOpen = !toolsOpen; drawBar(); } }, t('settings')),
    h('div', { class: 'tools', id: 'tools', 'data-open': toolsOpen ? '' : null },
      h('span', { class: 'seg', role: 'group', 'aria-label': t('std_label') }, keys.map((std) => h('button', {
        type: 'button', 'data-key': `std-${std}`, 'aria-pressed': String(std === app.std), disabled: !app.data.standards,
        onclick: () => { app.navigate(app.route, app.id, { ...app.query, std: std === app.activeStd ? null : std }); },
      }, `${stdName(std)}${std === app.activeStd ? `${paren(t('std_main'))}` : ''}`))),
      h('span', { class: 'seg', role: 'group', 'aria-label': t('lang_label') },
        h('button', { type: 'button', 'data-key': 'lang-zh', 'aria-pressed': String(lang() === 'zh'), onclick: () => switchLang('zh') }, '中文'),
        h('button', { type: 'button', 'data-key': 'lang-en', 'aria-pressed': String(lang() === 'en'), onclick: () => switchLang('en') }, 'EN')),
      h('button', { class: 'btn', type: 'button', 'data-key': 'theme', onclick: () => {
        theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
        try { localStorage.setItem('iccc.theme', theme); } catch { /* 不記也沒關係 */ }
        applyTheme(); drawBar();
      } }, `${t('theme_label')}${colon()}${t(`theme_${theme}`)}`),
      h('button', { class: 'btn square', type: 'button', 'data-key': 'help', 'aria-label': t('help'), title: t('help'),
        onclick: (e) => openHelp(e.currentTarget.getBoundingClientRect()) }, icon('help'))));
  document.querySelector('.skip').textContent = t('skip');
}

// ---------- 系統狀態列：資料來源、最後更新、偵測程式是否還在跑、距離下次更新還有多久 ----------
// 外框只在語言或判斷標準換了才重建；每秒只改裡面的文字
let lastRefreshAt = 0;
let stripKey = '';
const parts = {};
const mmss = (sec) => {
  const s = Math.max(0, Math.round(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
function buildStrip() {
  parts.alert = h('span', { class: 'visually-hidden', role: 'alert' });          // 只在「資料變舊了」那一刻唸一次
  parts.stale = h('span', { hidden: true });
  parts.tag = h('span', { class: 'tag' });
  parts.trial = h('span', { class: 'tag trial-tag', hidden: true });      // 正在用非主要標準看畫面時的提醒
  parts.updated = h('span');
  parts.detector = h('span', { class: 'muted opt' });       // opt：手機上空間不夠時先收起來的次要資訊
  parts.cells = mode === 'live' ? Array.from({ length: REFRESH_MS / 1000 }, () => h('i')) : [];
  const beat = mode === 'live'
    ? h('button', { class: 'beat', type: 'button', 'data-key': 'beat', title: t('refresh_now'), 'aria-label': t('refresh_now'), onclick: () => refresh() },
      h('span', { class: 'opt' }, t('next_refresh')), h('span', { class: 'beat-cells', 'aria-hidden': 'true' }, parts.cells))
    : null;
  let scrubber = null;
  if (mode === 'demo') {
    parts.playBtn = h('button', {
      class: 'scrub-play', type: 'button', 'data-key': 'demo-play',
      onclick: () => demoPlayer.toggle(),
    }, icon('pause'));
    parts.scrub = h('input', {
      class: 'scrub-range', type: 'range', min: '0', max: '71', value: '0',
      'data-key': 'demo-scrub', 'aria-label': t('demo_scrub'),
      oninput: (e) => demoPlayer.seek(Number(e.currentTarget.value)),
    });
    parts.scrubTime = h('span', { class: 'num scrub-time' });
    parts.marks = h('span', { class: 'scrub-marks', 'aria-hidden': 'true' });
    parts.marksKey = '';
    scrubber = h('div', { class: 'scrubber' }, parts.playBtn, h('span', { class: 'scrub-track' }, parts.scrub, parts.marks), parts.scrubTime);
  } else {
    parts.playBtn = null; parts.scrub = null; parts.scrubTime = null;
  }
  fill(strip, parts.alert, parts.stale, parts.tag, parts.trial, parts.updated, parts.detector, h('span', { class: 'spacer' }), beat, scrubber,
    mode === 'live'
      ? [h('a', { href: grafanaUrl(null, app.std), rel: 'noopener noreferrer' }, t('grafana')), h('a', { href: 'docs' }, t('api_docs'))]
      : h('span', { class: 'muted opt' }, t('credit')));
}
function drawStrip() {
  const key = `${lang()}|${app.std}`;
  if (key !== stripKey) { stripKey = key; buildStrip(); }
  const health = app.data.health;
  const age = health?.last_run ? (Date.now() - Date.parse(health.last_run)) / 1000 : null;
  const stale = Boolean(mode === 'live' && (app.error || (age !== null && age > STALE_SECONDS)));
  strip.classList.toggle('stale', stale);
  parts.stale.hidden = !stale;
  parts.tag.hidden = stale || !health;
  parts.updated.hidden = stale;
  parts.detector.hidden = stale || !health?.last_run;
  if (stale) {
    parts.stale.textContent = app.error ? t('unreachable') : t('stale', { n: duration(age) });
  } else if (health) {
    parts.tag.textContent = t(`src_${health.data_source}`);
    parts.updated.textContent = health.last_run ? `${t('updated')} ${clock(new Date(health.last_run))}${paren(ago(age))}` : t('detector_wait');
    parts.detector.textContent = t('detector_ok');
  } else {
    parts.updated.textContent = t('loading');
  }
  const trial = Boolean(app.std && app.activeStd && app.std !== app.activeStd);
  parts.trial.hidden = !trial || stale;
  if (trial) parts.trial.textContent = t('trial_tag', { name: stdName(app.std), main: stdName(app.activeStd) });
  const spoken = stale ? t(app.error ? 'unreachable' : 'stale_alert') : '';
  if (parts.alert.textContent !== spoken) parts.alert.textContent = spoken;
  // 每過一秒亮一格，十格滿了就更新；收到新資料時歸零
  const elapsed = lastRefreshAt ? Math.min(parts.cells.length, Math.floor((Date.now() - lastRefreshAt) / 1000)) : 0;
  parts.cells.forEach((cell, i) => cell.classList.toggle('on', i < elapsed));
  if (mode === 'demo' && parts.scrub) {
    const paused = demoPlayer.paused;
    const playLabel = t(paused ? 'demo_play' : 'demo_pause');
    if (parts.playBtn.dataset.paused !== String(paused)) {
      parts.playBtn.dataset.paused = String(paused);
      fill(parts.playBtn, icon(paused ? 'play' : 'pause'));
      parts.playBtn.setAttribute('aria-label', playLabel);
      parts.playBtn.setAttribute('title', playLabel);
    }
    const max = Math.max(0, demoPlayer.total - 1);
    if (parts.scrub.max !== String(max)) parts.scrub.max = String(max);
    if (document.activeElement !== parts.scrub) parts.scrub.value = String(demoPlayer.index);
    // 時間軸下面的小記號：哪裡開始有異常、斷線、恢復，可以直接拖過去看
    const marksKey = `${max}|${demoPlayer.markers.length}`;
    if (max && marksKey !== parts.marksKey) {
      parts.marksKey = marksKey;
      fill(parts.marks, ...demoPlayer.markers.map((mark) => {
        const tick = h('i', { 'data-level': mark.level });
        tick.style.left = `${((mark.i / max) * 100).toFixed(2)}%`;
        return tick;
      }));
    }
    parts.scrubTime.textContent = demoPlayer.total ? `${mmss(demoPlayer.index * demoPlayer.tick)} / ${mmss(demoPlayer.total * demoPlayer.tick)}` : '';
  }
  // 分頁標題與分頁上的小圖示：不用切回來也看得到有沒有異常
  const stations = app.data.status?.stations ?? [];
  const alarms = stations.filter((st) => st.level === 2).length;
  document.title = `${trial ? `[${stdName(app.std)}] ` : ''}${alarms ? `(${alarms}) ` : ''}${t('site')}`;
  const worst = stale ? 3 : alarms ? 2 : stations.some((st) => st.level === 3) ? 3 : stations.some((st) => st.level === 1) ? 1 : 0;
  const href = `icons/state-${worst}.svg`;
  if (favicon && favicon.getAttribute('href') !== href) favicon.setAttribute('href', href);
}

// ---------- 說明視窗：四種狀態、刻度怎麼看、鍵盤操作 ----------
const help = h('dialog', { class: 'help' });
document.body.append(help);
help.addEventListener('click', (e) => { if (e.target === help) help.close(); });      // 點視窗外面的暗色區域也能關
function openHelp(from) {
  const keys = [['Alt + 1 – 4', 'help_key_pages'], ['Tab, ← ↑ ↓ →', 'help_key_windows'], ['← →', 'help_key_chart'], ['Esc', 'help_key_close']];
  fill(help,
    h('div', { class: 'win-bar' }, h('span', { class: 'win-ico' }, icon('help')), h('h2', { class: 'win-title' }, t('help_title')), h('span', { class: 'win-grip', 'aria-hidden': 'true' }),
      h('button', { class: 'win-close', type: 'button', 'aria-label': t('close'), onclick: () => help.close() }, icon('close'))),
    h('div', { class: 'help-body' },
      h('section', null, h('h3', { class: 'px' }, t('help_states')),
        h('dl', { class: 'kv' }, [0, 1, 2, 3].map((level) => [h('dt', null, chip(level)), h('dd', null, t(`help_state_${level}`))]))),
      h('section', null, h('h3', { class: 'px' }, t('help_gauge')),
        h('div', { class: 'help-gauge' }, gauge(75, { warn: 60, alarm: 90 }, 1)), h('p', null, t('help_gauge_text'))),
      h('section', null, h('h3', { class: 'px' }, t('help_keys')),
        h('dl', { class: 'kv' }, keys.map(([combo, text]) => [h('dt', null, h('kbd', null, combo)), h('dd', null, t(text))]))),
      mode === 'demo' ? h('section', null, h('h3', { class: 'px' }, t('help_data')), h('p', null, t('src_demo')), h('p', { class: 'muted' }, t('data_credit'))) : null));
  help.showModal();
  if (from && !calm()) {
    help.classList.add('pending');
    zoomRect(from, help.getBoundingClientRect()).then(() => help.classList.remove('pending'));
  }
}

// ---------- 換頁 ----------
const VIEWS = { desk: deskView, stations: stationsView, station: stationView, events: eventsView, standards: standardsView };
const WINDOW_OF = { stations: 'stations', station: 'stations', events: 'open', standards: 'standards' };   // 內頁對應桌面上的哪個小視窗
let view = null; let viewKey = ''; let place = '';

// 記下最近一次點的站內連結在畫面上的位置：內頁從那裡「打開」，關閉時「收回」桌面上對應的小視窗
let lastClick = null;
document.addEventListener('click', (e) => {
  const link = e.target.closest?.('a[href^="#/"]');
  if (!link) return;
  lastClick = { at: performance.now(), rect: link.getBoundingClientRect(), fromDesk: Boolean(link.closest('.desk')), sheet: link.closest('.sheet')?.getBoundingClientRect() ?? null };
}, true);
function playZoom(click, cameFrom) {
  const sheet = main.querySelector('.sheet');
  if (sheet && click.fromDesk) {
    sheet.classList.add('pending');
    zoomRect(click.rect, sheet.getBoundingClientRect()).then(() => sheet.classList.remove('pending'));
  } else if (app.route === 'desk' && click.sheet && wide()) {
    const id = WINDOW_OF[cameFrom];
    const target = main.querySelector(`[data-win="${id}"]`) ?? main.querySelector(`.dock [data-key="${id}"]`);
    if (target) zoomRect(click.sheet, target.getBoundingClientRect());
  }
}

function readHash() {
  const [path, qs = ''] = location.hash.replace(/^#\/?/, '').split('?');
  const [route = '', id = ''] = path.split('/');
  app.route = VIEWS[route] ? route : 'desk';
  app.id = app.route === 'station' ? decodeURIComponent(id) : null;
  app.query = Object.fromEntries(new URLSearchParams(qs));
}
function resolveStandard() {
  const all = app.data.standards?.standards;
  app.activeStd = app.data.health?.active_standard ?? app.data.standards?.active_standard ?? null;
  app.std = all && all[app.query.std] ? app.query.std : app.activeStd;
  app.stdItems = all && app.std ? all[app.std].items : null;
}
// 回傳是不是換到另一頁了（只是換篩選條件或語言不算）
function draw(force = false) {
  resolveStandard();
  const next = `${app.route}/${app.id ?? ''}`;
  const key = `${next}/${lang()}`;
  const moved = next !== place;
  const cameFrom = place.split('/')[0];
  const click = moved && lastClick && performance.now() - lastClick.at < 600 ? lastClick : null;
  if (force || key !== viewKey) {
    view?.destroy();
    viewKey = key; place = next;
    view = VIEWS[app.route](app, app.id);
    fill(main, view.el);
    if (moved) window.scrollTo(0, 0);
  }
  drawBar();
  drawStrip();
  view.update(app);
  if (click) playZoom(click, cameFrom);
  if (moved) lastClick = null;
  return moved;
}
function switchLang(next) {
  setLang(next);
  draw(true);
}

// ---------- 取資料 ----------
let loading = false; let again = false; let timer = 0;
async function refresh() {
  if (loading) { again = true; return; }       // 正在讀取時又被要求更新（例如剛換了判斷標準）：讀完馬上再讀一次
  clearTimeout(timer);
  loading = true;
  const before = app.data.status; const beforeStd = app.std;
  try {
    let standards = app.data.standards ?? await source.standards();
    const guessedStd = standards.standards[app.query.std] ? app.query.std : (app.data.health?.active_standard ?? standards.active_standard);
    let [health, status, events] = await Promise.all([source.health(), source.status(guessedStd), source.events({ limit: 200 })]);
    if (app.data.health && health.started_at !== app.data.health.started_at) standards = await source.standards();
    const trueStd = standards.standards[app.query.std] ? app.query.std : health.active_standard;
    if (trueStd !== guessedStd) status = await source.status(trueStd);
    app.was = { levels: new Map(), values: new Map() };
    if (before && beforeStd === trueStd) {
      before.stations.forEach((st) => {
        app.was.levels.set(st.id, st.level);
        Object.entries(st.items || {}).forEach(([code, cell]) => { if (typeof cell.value === 'number') app.was.values.set(`${st.id}/${code}`, cell.value); });
      });
    }
    app.data = { health, standards, status, events };
    app.error = null;
    app.freshUntil = performance.now() + 250;
  } catch (err) {
    app.error = err;     // 保留上一次的資料，狀態列會顯示警示
  } finally {
    loading = false;
    lastRefreshAt = Date.now();
  }
  draw();
  if (again) { again = false; refresh(); return; }
  timer = setTimeout(tick, REFRESH_MS);
}
function tick() {
  if (document.hidden || (mode === 'demo' && demoPlayer.paused)) timer = setTimeout(tick, REFRESH_MS); else refresh();
}
demoPlayer.onChange = () => refresh();

window.addEventListener('hashchange', () => {
  const before = app.query.std;
  readHash();
  const moved = draw();
  if (app.query.std !== before) refresh();      // 換了判斷標準要重新取各測站的狀態
  // 換頁後把焦點移到內容區；焦點本來就在內容裡（例如連按「下一站」）就不動它
  if (moved && app.route !== 'desk' && !main.contains(document.activeElement)) main.focus({ preventScroll: true });
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) { drawStrip(); if (!(mode === 'demo' && demoPlayer.paused)) refresh(); } });
setInterval(() => { if (!document.hidden) drawStrip(); }, 1000);

// Alt + 1～4 換頁（不用單一字母當快捷鍵，避免打字或語音輸入時誤觸）
document.addEventListener('keydown', (e) => {
  if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || help.open) return;
  const route = { 1: 'desk', 2: 'stations', 3: 'events', 4: 'standards' }[e.key];
  if (!route) return;
  e.preventDefault();
  app.navigate(route);
});

setLang(lang());
applyTheme();
readHash();
draw();
refresh();
