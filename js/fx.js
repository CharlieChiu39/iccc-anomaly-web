// 特效。每一個都有用途（說明東西從哪裡來、提醒哪裡變了），
// 而且在系統設定成「減少動態效果」時全部略過，直接顯示結果。
export const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// 縮放框：一個細框從 from 一格一格跳到 to，表示「這個視窗是從這裡打開（或收回這裡）的」。
// from、to 是畫面上的位置（getBoundingClientRect 的結果）。回傳的 Promise 在框跳完時完成。
export function zoomRect(from, to, steps = 6, stepMs = 26) {
  if (calm() || !from || !to || (!from.width && !to.width)) return Promise.resolve();
  return new Promise((resolve) => {
    const box = document.createElement('div');
    box.className = 'zoom-rect';
    box.setAttribute('aria-hidden', 'true');
    document.body.append(box);
    let i = 0;
    const step = () => {
      i += 1;
      if (i > steps) { box.remove(); resolve(); return; }
      const k = i / (steps + 1);
      const mix = (a, b) => `${Math.round(a + (b - a) * k)}px`;
      box.style.left = mix(from.left, to.left);
      box.style.top = mix(from.top, to.top);
      box.style.width = mix(from.width, to.width);
      box.style.height = mix(from.height, to.height);
      setTimeout(step, stepMs);
    };
    step();
  });
}

// 打字：把一個元素裡的文字一個字一個字打出來（元素的結構先建好，這裡只控制文字出現的進度）。
// 回傳「取消」函式；取消時文字會立刻全部出現。
export function typeOut(el, charMs = 34) {
  if (calm()) return () => {};
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push({ node: walker.currentNode, text: walker.currentNode.data });
  const total = nodes.reduce((sum, n) => sum + [...n.text].length, 0);
  if (!total) return () => {};
  let shown = 0; let timer = 0;
  const paint = () => {
    let left = shown;
    for (const n of nodes) {
      const chars = [...n.text];
      n.node.data = chars.slice(0, Math.max(0, left)).join('');
      left -= chars.length;
    }
  };
  const finish = () => {
    clearTimeout(timer);
    shown = total;
    paint();
    el.style.minHeight = '';
    el.classList.remove('typing');
    el.classList.add('typed');
  };
  const step = () => {
    shown += 1;
    paint();
    if (shown >= total) finish(); else timer = setTimeout(step, charMs);
  };
  el.style.minHeight = `${el.offsetHeight}px`;     // 先佔好打完之後的高度，下面的東西才不會跟著跳
  el.classList.remove('typed');
  el.classList.add('typing');
  paint();
  timer = setTimeout(step, charMs);
  return finish;
}
