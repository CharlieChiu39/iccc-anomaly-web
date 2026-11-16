// 中英文對照。介面文字、狀態、測項都用代號查表，不直接顯示 API 回傳的中文。
const TEXT = {
  zh: {
    site: '智慧校園管理平台｜異常偵測',
    skip: '跳到主要內容',
    nav_desk: '桌面', nav_stations: '測站', nav_events: '事件紀錄', nav_standards: '判斷標準',
    std_label: '判斷標準', std_main: '主要', india: '印度', taiwan: '台灣',
    lang_label: '語言', theme_label: '外觀', theme_auto: '跟著系統', theme_light: '淺色', theme_dark: '深色',
    level_0: '正常', level_1: '注意', level_2: '異常', level_3: '斷線', level_none: '尚無資料',
    kind_air: '空品', kind_water: '水質',
    item_turbidity: '濁度', item_offline: '連線',
    // 狀態列
    src_replay: '重播資料（示範）', src_station: '測站即時資料', src_demo: '公開展示版：播放錄製資料，不是即時量測',
    updated: '最後更新', ago_s: '{n} 秒前', ago_m: '{n} 分鐘前', ago_h: '{n} 小時前', ago_d: '{n} 天前', just_now: '剛剛',
    detector_ok: '偵測程式運作中', detector_wait: '偵測程式啟動中，還沒有完成第一輪',
    stale: '偵測程式已經 {n} 沒有更新，下面的資料可能不是最新狀態',
    unreachable: '連不上偵測程式，下面顯示的是最後一次收到的資料',
    grafana: 'Grafana 儀表板', api_docs: 'API 說明頁',
    // 首頁
    verdict_alarm: '{total} 個測站，{hit}', verdict_all_ok: '{total} 個測站，{hit}',
    hit_alarm: '{n} 個異常', hit_offline: '{n} 個斷線', hit_warn: '{n} 個注意', hit_ok: '全部正常',
    hit_stale: '{n} 個測項資料中斷', hit_ok_rest: '其他正常', tally_stale: '資料中斷的測項', stale_tag: '{n} 項資料中斷',
    verdict_wait: '正在讀取測站狀態',
    win_stations: '測站', win_open: '進行中的異常', win_standards: '判斷標準', win_system: '系統狀態',
    windows: '小視窗', rearrange: '重新排列', layout_around: '換個排法', layout_tile: '換個排法', settings: '設定', close: '關閉', close_win: '關閉「{name}」小視窗', min_win: '收合「{name}」小視窗', max_win: '放大「{name}」成完整頁面', shade_win: '收摺或展開「{name}」小視窗', size_win: '切換「{name}」小視窗寬度', restore_win: '還原成桌面小視窗', move_hint: '{name}：按住拖曳，或用方向鍵移動',
    notice_more: '另有 {n} 則', trial_prefix: '若改用「{name}」標準試算', trial_tag: '試算中：{name}標準。告警與事件紀錄仍依「{main}」',
    group_open: '進行中（{n}）', group_closed: '已結束（{n}）', mark_alarm: '這裡有新的異常', mark_offline: '這裡有測站斷線', mark_ok: '這裡恢復正常', demo_play: '播放錄製資料', demo_pause: '暫停播放', demo_scrub: '錄製時間軸',
    see_all_stations: '查看全部 {n} 個測站', see_events: '查看事件紀錄', see_standards: '查看完整門檻表', see_station: '查看測站',
    no_open: '目前沒有進行中的異常。', more_open: '另外還有 {n} 則進行中',
    notice_alarm: '異常', notice_offline: '斷線', notice_recovered: '已恢復',
    notice_page: '第 {i} / {n} 站', notice_summary: '共 {total} 站有狀況：{parts}', notice_dismiss_one: '略過此站',
    notice_over: '{item} {value}，超過門檻 {th}', notice_out: '{item} {value}，超出範圍', notice_offline_text: '超過設定時間沒有新資料', notice_since: '開始於 {t}',
    judged_by: '目前依「{name}」判斷', main_note: '告警與事件紀錄用的是主要標準「{name}」',
    sys_source: '資料來源', sys_updated: '最後更新', sys_detector: '偵測程式', sys_started: '啟動時間', sys_running: '運作中', sys_stopped: '沒有回應',
    // 表格
    th_state: '狀態', th_station: '測站', th_kind: '類型', th_worst: '最需要注意的測項', th_scale: '離門檻多遠', th_data_time: '資料時間',
    th_item: '測項', th_value: '數值', th_flag: '備註', th_warn: '注意門檻', th_alarm: '異常門檻', th_range: '正常範圍',
    th_start: '開始時間', th_level: '等級', th_start_value: '開始值', th_max_value: '最大值', th_threshold: '門檻', th_duration: '持續', th_end: '結束',
    flag_missing: '缺值', flag_invalid: '不合理值，未判斷', flag_stale: '資料中斷：太久沒有有效數值，目前無法判斷', no_value: '沒有資料', not_judged: '這套標準沒有訂門檻',
    offline_since: '最後收到資料：{t}',
    // 內頁
    stations_title: '測站', stations_lede: '依嚴重程度排列。數值右邊的刻度是它和門檻的距離。',
    station_values: '最新數值', station_trends: '趨勢', station_events: '這個測站的事件', back_stations: '回到測站清單',
    range_label: '時間範圍', range_60: '1 小時', range_360: '6 小時', range_1440: '24 小時', range_demo: '錄製的這一段',
    open_grafana: '在 Grafana 看這個測站',
    events_title: '事件紀錄', events_lede: '進行中的排在最上面。事件依主要標準「{name}」記錄。',
    filter_station: '測站', filter_state: '狀態', all: '全部', state_open: '進行中', state_closed: '已結束',
    export_csv: '匯出 CSV', n_events: '共 {n} 筆', ongoing: '進行中',
    reason_恢復: '恢復', reason_資料中斷: '資料中斷', reason_系統重新啟動: '系統重新啟動',
    standards_title: '判斷標準', standards_lede: '同一筆數值分別用兩套標準判斷。超過「注意門檻」是注意，超過「異常門檻」是異常；pH 這類測項超出正常範圍就是異常。',
    // 圖
    chart_latest: '最新', chart_table: '看數值表', chart_time: '時間', chart_offline: '斷線，沒有資料',
    th_trend: '過去 1 小時', th_trend_demo: '錄製的這一段', spark_label: '{name}：最低 {lo}，最高 {hi}，最新 {last}', spark_none: '暫時讀不到',
    rising: '比上次高', falling: '比上次低', prev_station: '上一站', next_station: '下一站',
    // 外框、狀態列、說明
    crumbs: '所在位置', back_desk: '關閉，回到桌面',
    next_refresh: '下次更新', refresh_now: '立即更新', stale_alert: '偵測程式沒有在更新，畫面上的資料可能不是最新狀態',
    help: '說明', help_title: '怎麼看這個畫面',
    help_states: '四種狀態',
    help_state_0: '所有測項都在門檻以內。', help_state_1: '有測項超過「注意門檻」，還沒到異常。',
    help_state_2: '有測項超過「異常門檻」，或超出正常範圍。系統會記錄成事件並發出告警。', help_state_3: '超過設定的時間沒有收到新資料。',
    help_gauge: '數值旁邊的刻度',
    help_gauge_text: '兩條直線是門檻：左邊是注意，右邊是異常。方塊是目前的數值，越過門檻的那一段才會上色；方塊離直線越遠，就是離門檻越遠。',
    help_keys: '鍵盤操作',
    help_key_pages: '換頁：桌面、測站、事件紀錄、判斷標準', help_key_windows: '選到小視窗的標題列後，用方向鍵移動（加 Shift 移得比較遠）',
    help_key_chart: '選到趨勢圖後，一點一點看數值', help_key_close: '關閉這個說明',
    help_data: '資料來源',
    // 狀態
    loading: '讀取中', empty_events: '沒有符合條件的事件', empty_events_hint: '換一個篩選條件，或等系統記錄到新的事件。',
    empty_points: '這段時間沒有資料', empty_points_hint: '測站可能斷線，或系統剛啟動還沒有累積資料。',
    err_history: '趨勢暫時無法取得', err_history_hint: 'Prometheus 沒有回應。其他資料不受影響，稍後會自動重試。',
    err_load: '讀不到資料', err_load_hint: '偵測程式沒有回應。請確認 app 容器還在執行，頁面會自動重試。',
    not_found: '找不到這個測站', not_found_hint: '代號可能打錯，或這個測站已經停用。',
    noscript: '這個頁面需要開啟 JavaScript 才能顯示即時資料。',
    credit: '課程專題作品', data_credit_short: '資料：ICCC-Platform 空氣污染資料集（CC BY-NC-SA 3.0 IGO）', data_credit: '空品資料來自 ICCC-Platform 的印度與尼泊爾空氣污染資料集（CC BY-NC-SA 3.0 IGO），水質為自製測試資料。',
  },
  en: {
    site: 'Smart Campus Platform | Anomaly Detection',
    skip: 'Skip to main content',
    nav_desk: 'Desk', nav_stations: 'Stations', nav_events: 'Events', nav_standards: 'Standards',
    std_label: 'Standard', std_main: 'primary', india: 'India', taiwan: 'Taiwan',
    lang_label: 'Language', theme_label: 'Theme', theme_auto: 'System', theme_light: 'Light', theme_dark: 'Dark',
    level_0: 'Normal', level_1: 'Watch', level_2: 'Alarm', level_3: 'Offline', level_none: 'No data yet',
    kind_air: 'Air', kind_water: 'Water',
    item_turbidity: 'Turbidity', item_offline: 'Connection',
    src_replay: 'Replayed data (demo)', src_station: 'Live station data', src_demo: 'Public demo: playing a recording, not live measurements',
    updated: 'Last update', ago_s: '{n} s ago', ago_m: '{n} min ago', ago_h: '{n} h ago', ago_d: '{n} d ago', just_now: 'just now',
    detector_ok: 'Detector running', detector_wait: 'Detector starting, first round not finished',
    stale: 'The detector has not updated for {n}; the data below may be out of date',
    unreachable: 'Cannot reach the detector; showing the last data received',
    grafana: 'Grafana dashboard', api_docs: 'API docs',
    verdict_alarm: '{total} stations, {hit}', verdict_all_ok: '{total} stations, {hit}',
    hit_alarm: '{n} in alarm', hit_offline: '{n} offline', hit_warn: '{n} on watch', hit_ok: 'all normal',
    hit_stale: '{n} items with a data gap', hit_ok_rest: 'the rest normal', tally_stale: 'Items with a data gap', stale_tag: '{n} data gap(s)',
    verdict_wait: 'Reading station status',
    win_stations: 'Stations', win_open: 'Open anomalies', win_standards: 'Standards', win_system: 'System',
    windows: 'Windows', rearrange: 'Tidy up', layout_around: 'Switch layout', layout_tile: 'Switch layout', settings: 'Settings', close: 'Close', close_win: 'Close the {name} window', min_win: 'Minimize the {name} window', max_win: 'Expand {name} to full page', shade_win: 'Fold or unfold the {name} window', size_win: 'Toggle width of the {name} window', restore_win: 'Restore to desk window', move_hint: '{name}: drag, or move with the arrow keys',
    notice_more: '{n} more', trial_prefix: 'If judged by the {name} standard', trial_tag: 'What-if view: {name} standard. Alerts and the event log still follow {main}',
    group_open: 'Open ({n})', group_closed: 'Ended ({n})', mark_alarm: 'A new alarm starts here', mark_offline: 'A station goes offline here', mark_ok: 'Back to normal here', demo_play: 'Play recording', demo_pause: 'Pause playback', demo_scrub: 'Recording timeline',
    see_all_stations: 'See all {n} stations', see_events: 'See the event log', see_standards: 'See all thresholds', see_station: 'See station',
    no_open: 'No open anomalies right now.', more_open: '{n} more open',
    notice_alarm: 'Alarm', notice_offline: 'Offline', notice_recovered: 'Recovered',
    notice_page: '{i} / {n} stations', notice_summary: '{total} stations affected: {parts}', notice_dismiss_one: 'Dismiss',
    notice_over: '{item} {value}, over the threshold {th}', notice_out: '{item} {value}, out of range', notice_offline_text: 'No new data within the set time', notice_since: 'Since {t}',
    judged_by: 'Judged by the {name} standard', main_note: 'Alerts and the event log use the primary standard, {name}',
    sys_source: 'Data source', sys_updated: 'Last update', sys_detector: 'Detector', sys_started: 'Started', sys_running: 'Running', sys_stopped: 'Not responding',
    th_state: 'State', th_station: 'Station', th_kind: 'Type', th_worst: 'Item to watch', th_scale: 'Distance to threshold', th_data_time: 'Data time',
    th_item: 'Item', th_value: 'Value', th_flag: 'Note', th_warn: 'Watch at', th_alarm: 'Alarm at', th_range: 'Normal range',
    th_start: 'Started', th_level: 'Level', th_start_value: 'Start value', th_max_value: 'Peak', th_threshold: 'Threshold', th_duration: 'Lasted', th_end: 'Ended',
    flag_missing: 'Missing', flag_invalid: 'Invalid value, not judged', flag_stale: 'Data gap: no valid value for too long, cannot be judged', no_value: 'No data', not_judged: 'No threshold in this standard',
    offline_since: 'Last data received: {t}',
    stations_title: 'Stations', stations_lede: 'Sorted by severity. The scale beside each value shows its distance to the threshold.',
    station_values: 'Latest values', station_trends: 'Trends', station_events: 'Events at this station', back_stations: 'Back to stations',
    range_label: 'Range', range_60: '1 hour', range_360: '6 hours', range_1440: '24 hours', range_demo: 'The recorded span',
    open_grafana: 'Open this station in Grafana',
    events_title: 'Events', events_lede: 'Open events come first. Events are recorded under the primary standard, {name}.',
    filter_station: 'Station', filter_state: 'State', all: 'All', state_open: 'Open', state_closed: 'Ended',
    export_csv: 'Export CSV', n_events: '{n} events', ongoing: 'Open',
    reason_恢復: 'Recovered', reason_資料中斷: 'No valid data', reason_系統重新啟動: 'System restarted',
    standards_title: 'Standards', standards_lede: 'Each reading is judged twice, once per standard. Above "Watch at" is Watch, above "Alarm at" is Alarm; items such as pH alarm when outside the normal range.',
    chart_latest: 'Latest', chart_table: 'Show values', chart_time: 'Time', chart_offline: 'Offline, no data',
    th_trend: 'Last hour', th_trend_demo: 'Recorded span', spark_label: '{name}: low {lo}, high {hi}, latest {last}', spark_none: 'Unavailable',
    rising: 'up since the last update', falling: 'down since the last update', prev_station: 'Previous', next_station: 'Next',
    crumbs: 'You are here', back_desk: 'Close and go back to the desk',
    next_refresh: 'Next update', refresh_now: 'Update now', stale_alert: 'The detector is not updating; the data on screen may be out of date',
    help: 'Help', help_title: 'How to read this screen',
    help_states: 'The four states',
    help_state_0: 'Every item is within its thresholds.', help_state_1: 'An item is above "Watch at" but not yet in alarm.',
    help_state_2: 'An item is above "Alarm at", or outside its normal range. The system records an event and sends an alert.', help_state_3: 'No new data arrived within the set time.',
    help_gauge: 'The scale beside each value',
    help_gauge_text: 'The two lines are the thresholds: watch on the left, alarm on the right. The square is the current value, and only the part past a threshold is coloured; the further the square is from a line, the further the value is from that threshold.',
    help_keys: 'Keyboard',
    help_key_pages: 'Switch page: Desk, Stations, Events, Standards', help_key_windows: 'Focus a window title bar, then move it with the arrow keys (Shift moves further)',
    help_key_chart: 'Focus a trend chart, then step through its values', help_key_close: 'Close this help',
    help_data: 'Data source',
    loading: 'Loading', empty_events: 'No events match', empty_events_hint: 'Change the filter, or wait for the system to record a new event.',
    empty_points: 'No data in this range', empty_points_hint: 'The station may be offline, or the system has just started.',
    err_history: 'Trend unavailable for now', err_history_hint: 'Prometheus is not responding. Other data is unaffected; this will retry.',
    err_load: 'Cannot load data', err_load_hint: 'The detector is not responding. Check that the app container is running; this page retries by itself.',
    not_found: 'Station not found', not_found_hint: 'The id may be mistyped, or the station is disabled.',
    noscript: 'This page needs JavaScript to show live data.',
    credit: 'Course project', data_credit_short: 'Data: ICCC-Platform air pollution dataset (CC BY-NC-SA 3.0 IGO)', data_credit: 'Air data from the ICCC-Platform India and Nepal air pollution dataset (CC BY-NC-SA 3.0 IGO); water data is self-made test data.',
  },
};

let current = 'zh';
try { current = localStorage.getItem('iccc.lang') === 'en' ? 'en' : 'zh'; } catch { /* 無法讀取就用預設 */ }

export const lang = () => current;
export function setLang(next) {
  current = next === 'en' ? 'en' : 'zh';
  try { localStorage.setItem('iccc.lang', current); } catch { /* 無法儲存不影響使用 */ }
  document.documentElement.lang = current === 'en' ? 'en' : 'zh-Hant';
}
export function t(key, vars) {
  const text = TEXT[current][key] ?? TEXT.zh[key] ?? key;
  return vars ? text.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`)) : text;
}
export const levelName = (level) => (level === null || level === undefined ? t('level_none') : t(`level_${level}`));
export const kindName = (kind) => t(`kind_${kind}`);
export const stdName = (key) => t(key);
// 測項名稱：只有「濁度」需要翻譯，其餘（AQI、PM2.5、pH…）兩種語言相同，用 API 給的名稱
export const itemName = (code, fallback) => (TEXT[current][`item_${code}`] ?? fallback ?? code);
export const stationName = (s) => (s ? (current === 'en' ? (s.name_en || s.name) : s.name) : '');
export const reasonName = (reason) => (reason ? (TEXT[current][`reason_${reason}`] ?? reason) : '');
// 事件紀錄裡的等級是中文字串（異常／斷線），換成狀態代碼
export const eventLevel = (ev) => (ev.item === 'offline' || ev.level === '斷線' ? 3 : 2);

// 標點：中文用全形，英文用半形
export const paren = (text) => (current === 'en' ? ` (${text})` : `（${text}）`);
export const colon = () => (current === 'en' ? ': ' : '：');
export const gap = () => (current === 'en' ? '  ' : '　');

const locale = () => (current === 'en' ? 'en-GB' : 'zh-TW');
export function num(value, digits = 1) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  return new Intl.NumberFormat(locale(), { maximumFractionDigits: digits }).format(value);
}
// 時間用觀看者的時區顯示，並標出時區
// 觀看者的時區簡稱（例如 GMT+8）：表格的時間欄只在表頭寫一次，不用每一列都重複
export function zone() {
  return new Intl.DateTimeFormat(locale(), { timeZoneName: 'short' }).formatToParts(new Date()).find((part) => part.type === 'timeZoneName')?.value ?? '';
}
export function dateTime(iso, withZone = false) {
  if (!iso) return '';
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(locale(), {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
    year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
    timeZoneName: withZone ? 'short' : undefined,
  }).format(d);
}
export function clock(date) {
  return new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(date);
}
export function ago(seconds) {
  if (seconds < 5) return t('just_now');
  if (seconds < 90) return t('ago_s', { n: Math.round(seconds) });
  if (seconds < 5400) return t('ago_m', { n: Math.round(seconds / 60) });
  if (seconds < 129600) return t('ago_h', { n: Math.round(seconds / 3600) });
  return t('ago_d', { n: Math.round(seconds / 86400) });
}
export function duration(seconds) {
  const s = Math.max(0, Math.round(seconds));
  const zh = current === 'zh';
  if (s < 60) return zh ? `${s} 秒` : `${s} s`;
  if (s < 3600) return zh ? `${Math.floor(s / 60)} 分 ${s % 60} 秒` : `${Math.floor(s / 60)} min ${s % 60} s`;
  if (s < 86400) return zh ? `${Math.floor(s / 3600)} 小時 ${Math.floor((s % 3600) / 60)} 分` : `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`;
  return zh ? `${Math.floor(s / 86400)} 天 ${Math.floor((s % 86400) / 3600)} 小時` : `${Math.floor(s / 86400)} d ${Math.floor((s % 86400) / 3600)} h`;
}
