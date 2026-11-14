// 資料來源有兩種，介面相同：
//   live：向 app 的 API 取即時資料（系統裡的首頁）
//   demo：播放事先錄好的資料（公開展示版，放在只能提供靜態檔案的地方）
const query = new URLSearchParams(location.search);
export const mode = location.hostname.endsWith('.github.io') || query.has('demo') ? 'demo' : 'live';

export class ApiError extends Error {
  constructor(status) { super(`HTTP ${status}`); this.status = status; }
}

async function getJSON(path, params) {
  const url = new URL(path, document.baseURI);
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
  }
  const res = await fetch(url, { cache: 'no-store', credentials: 'same-origin' });
  if (!res.ok) throw new ApiError(res.status);
  return res.json();
}

const live = {
  health: () => getJSON('api/health'),
  status: (standard) => getJSON('api/status', { standard }),
  events: (q = {}) => getJSON('api/events', { station: q.station, open: q.open, limit: q.limit ?? 200 }),
  standards: () => getJSON('api/standards'),
  history: (station, item, minutes) => getJSON('api/history', { station, item, minutes }),
};

// ---------- 展示版：循環播放錄製的資料 ----------
let recording;
export const demoPlayer = {
  paused: false,
  index: 0,
  total: 0,
  tick: 10,
  offsetSec: 0,
  pinnedIndex: null,
  markers: [],
  onChange: null,
  toggle() {
    if (!recording) return;
    if (this.paused) {
      this.paused = false;
      const now = Date.now() / 1000;
      const span = this.total * this.tick;
      this.offsetSec = this.index * this.tick - (now % span);
      this.pinnedIndex = null;
    } else {
      this.paused = true;
      this.pinnedIndex = this.index;
    }
    this.onChange?.();
  },
  seek(targetIndex) {
    if (!recording) return;
    const clamped = Math.max(0, Math.min(this.total - 1, Math.round(targetIndex)));
    this.index = clamped;
    if (this.paused) {
      this.pinnedIndex = clamped;
    } else {
      const now = Date.now() / 1000;
      const span = this.total * this.tick;
      this.offsetSec = clamped * this.tick - (now % span);
    }
    this.onChange?.();
  },
};

async function loadRecording() {
  if (!recording) {
    recording = await getJSON('demo/recording.json');
    demoPlayer.total = recording.frames.length;
    demoPlayer.tick = recording.tick_seconds;
    const std = recording.standards.active_standard;
    // 時間軸上的標記：哪一格開始有測站變成異常（2）或斷線（3），哪一格有測站恢復（0）
    const markers = [];
    let before = null;
    recording.frames.forEach((f, i) => {
      const now = new Map((f.status[std]?.stations || []).filter((s) => s.level >= 2).map((s) => [s.id, s.level]));
      if (before) {
        const fresh = [...now].filter(([id, level]) => before.get(id) !== level).map(([, level]) => level);
        const healed = [...before.keys()].some((id) => !now.has(id));
        if (fresh.length) markers.push({ i, level: Math.max(...fresh) });
        else if (healed) markers.push({ i, level: 0 });
      }
      before = now;
    });
    demoPlayer.markers = markers;
  }
  return recording;
}
// 現在播到哪一格。預設以時鐘對齊，使用者也可以暫停或拖曳時間軸跳到任意格。
function playhead(rec) {
  const tick = rec.tick_seconds;
  const now = Date.now() / 1000;
  const span = rec.frames.length * tick;
  let index;
  if (demoPlayer.paused && demoPlayer.pinnedIndex !== null) {
    index = demoPlayer.pinnedIndex;
  } else {
    const pos = (((now + demoPlayer.offsetSec) % span) + span) % span;
    index = Math.floor(pos / tick);
  }
  demoPlayer.index = index;
  return { index, frame: rec.frames[index], now, shift: now - rec.frames[index].at };
}
// 把錄製當時的時間平移到現在，「3 分鐘前開始」看起來才對
const shiftIso = (iso, shift) => (iso ? new Date(Date.parse(iso) + shift * 1000).toISOString() : iso);

const demo = {
  async health() {
    const { frame, shift } = playhead(await loadRecording());
    return { ...frame.health, data_source: 'demo', last_run: shiftIso(frame.health.last_run, shift), started_at: shiftIso(frame.health.started_at, shift) };
  },
  async status(standard) {
    const rec = await loadRecording();
    const { frame } = playhead(rec);
    return frame.status[standard] ?? frame.status[rec.standards.active_standard];
  },
  async events(q = {}) {
    const { frame, shift } = playhead(await loadRecording());
    return frame.events
      .filter((ev) => (!q.station || ev.station_id === q.station)
        && (q.open === undefined || q.open === null || (ev.ended_at === null) === q.open))
      .slice(0, q.limit ?? 200)
      .map((ev) => ({ ...ev, started_at: shiftIso(ev.started_at, shift), ended_at: shiftIso(ev.ended_at, shift) }));
  },
  async standards() { return (await loadRecording()).standards; },
  async history(station, item, minutes) {
    const rec = await loadRecording();
    const { index, now } = playhead(rec);
    const tick = rec.tick_seconds;
    const total = rec.frames.length;
    const count = Math.min(total, Math.ceil((minutes * 60) / tick));
    const points = [];
    const offline = [];
    let unit = '';
    for (let back = count - 1; back >= 0; back--) {
      const frame = rec.frames[(((index - back) % total) + total) % total];
      const at = now - back * tick;
      const st = frame.status[rec.standards.active_standard].stations.find((s) => s.id === station);
      if (!st) continue;
      if (st.online === false) {
        const last = offline[offline.length - 1];
        if (last && at - last[1] <= tick * 1.5) last[1] = at; else offline.push([at, at]);
        continue;
      }
      const cell = st.items?.[item];
      if (cell) unit = cell.unit || unit;
      if (cell && typeof cell.value === 'number') points.push([at, cell.value]);
    }
    return { station, item, unit, minutes: Math.round((count * tick) / 60), step_seconds: tick, start: now - count * tick, end: now, points, offline };
  },
};

export const source = mode === 'demo' ? demo : live;
// 展示版的趨勢圖只有錄到的那一段
export async function demoSpanMinutes() {
  const rec = await loadRecording();
  return Math.round((rec.frames.length * rec.tick_seconds) / 60);
}
// Grafana 與 app 在同一台主機的 3000 埠（只有即時版有）
export function grafanaUrl(stationId, standard) {
  const url = new URL(`${location.protocol}//${location.hostname}:3000/d/iccc-env-overview`);
  if (stationId) url.searchParams.set('var-station', stationId);
  if (standard) url.searchParams.set('var-standard', standard);
  return url.href;
}
