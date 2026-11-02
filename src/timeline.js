// Atlas CRT timeline: one lane per automated control, stacked as in Ableton's automation lanes.
// Keyframes are dragged directly on their lane, the line between two can be bent by the dot at its
// middle, and the panel on the right shapes the selected keyframe's velocity curve in full. An LFO
// lane draws what the LFO will do, and its shape is edited in the popover from rack.js.
(function () {
  const K = window.Atlas;
  if (!K || !K.engine) return;
  const { MASTER, MACROS, GROUPS, BY_KEY } = window.AtlasParams;
  const Auto = window.AtlasAuto;
  const $ = (id) => document.getElementById(id);
  const { state, ui, el, icon } = K;
  const { clamp } = Auto;

  const grid = $('tlGrid'), lanesBox = $('tlLanes'), ruler = $('tlRuler'), head = $('tlHead');
  const scroller = $('tlScroll'), spacer = $('tlSpacer'), inspect = $('tlInspect');
  const lanes = new Map(); // key -> { root, canvas, g, h, val, setMode, marquee, handles }
  const PAD = 8, RULER_H = 22, HIT = matchMedia('(pointer: coarse)').matches ? 16 : 9;
  const SIZES = { s: 46, m: 72, l: 120 };
  const MAX_ZOOM = 40;

  let zoom = 1, pps = 50, viewW = 0, lastLen = 0, drag = null, active = null, colors = {};
  const dpr = () => window.devicePixelRatio || 1;
  const sel = new Set(); // selected keyframes, all on the active lane

  const xOf = (t) => t * pps - scroller.scrollLeft;
  const tOf = (x) => (x + scroller.scrollLeft) / pps;
  const byTime = (a, b) => a.t - b.t;

  function readColors() {
    const s = getComputedStyle(document.documentElement);
    const v = (n) => s.getPropertyValue(n).trim();
    colors = { text: v('--text'), text3: v('--text-3'), hair: v('--hairline-soft'), line: v('--hairline'), surface: v('--surface'), font: v('--font') };
  }

  function measure() {
    viewW = ruler.clientWidth;
    pps = ((viewW || 1) / K.timelineLength()) * zoom;
    spacer.style.width = Math.ceil(K.timelineLength() * pps) + 'px';
  }
  function fit(c, w, h) {
    const d = dpr(), cw = Math.round(w * d), ch = Math.round(h * d);
    if (c.width !== cw) c.width = cw;
    if (c.height !== ch) c.height = ch;
    const g = c.getContext('2d');
    g.setTransform(d, 0, 0, d, 0, 0);
    return g;
  }
  // the widest grid that keeps labels apart
  const tickStep = () => [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300].find((s) => s * pps >= 58) || 600;
  const tickLabel = (t, step) => (step < 1 ? t.toFixed(step < 0.5 ? 2 : 1) : Math.floor(t / 60) + ':' + String(Math.round(t % 60)).padStart(2, '0'));

  function paintRuler() {
    if (!viewW) return;
    const g = fit(ruler, viewW, RULER_H), step = tickStep(), len = K.timelineLength();
    g.clearRect(0, 0, viewW, RULER_H);
    g.font = '10px ' + colors.font;
    g.fillStyle = colors.text3;
    g.strokeStyle = colors.line;
    g.beginPath();
    for (let i = Math.floor(tOf(0) / step); i * step <= Math.min(len, tOf(viewW)); i++) {
      const t = i * step, x = Math.round(xOf(t)) + 0.5;
      g.moveTo(x, 14); g.lineTo(x, RULER_H);
      g.fillText(tickLabel(t, step), x + 3, 11);
    }
    g.stroke();
  }

  // ------------------------------------------------------------ lanes
  const laneHeight = (k) => ui.laneH[k] || SIZES[ui.laneSize] || SIZES.m;

  function buildLane(k) {
    const c = BY_KEY[k], root = el('div', 'lane');
    const headBox = el('div', 'lane-head');
    const line = el('div', 'lane-line');
    const val = el('span', 'lane-val');
    line.append(el('span', 'lane-name', c.l), val);
    const tools = el('div', 'lane-tools');
    const segHost = el('div');
    const tool = (name, title, fn) => {
      const b = el('button', 'icon-btn');
      b.type = 'button'; b.title = title;
      b.setAttribute('aria-label', title + ': ' + c.l);
      b.append(icon(name));
      b.onclick = (e) => { e.stopPropagation(); fn(b); };
      return b;
    };
    const power = tool('i-power', 'Bypass', () => {
      state.auto[k].off = !state.auto[k].off;
      K.automate.refresh(k, c.l + (state.auto[k].off ? ': bypassed' : ': on'));
    });
    tools.append(
      segHost, el('span', 'grow'),
      tool('i-sliders', 'Edit', (b) => K.openMod(k, b)),
      power,
      tool('i-x', 'Remove', () => K.automate.remove(k)),
    );
    headBox.append(line, tools);
    headBox.onclick = () => setActive(k);
    const canvas = el('canvas', 'lane-canvas');
    const size = el('div', 'lane-size');
    root.append(headBox, canvas, size);

    const L = { k, root, canvas, val, power, handles: [], marquee: null, h: laneHeight(k) };
    L.setMode = K.segmented(segHost, [['keys', 'Keys'], ['lfo', 'LFO']], state.auto[k].mode, (v) => K.automate.setMode(k, v), 'sm');
    canvas.addEventListener('pointerdown', (e) => pressLane(e, L));
    canvas.addEventListener('pointermove', (e) => { if (drag) drag.move(e); else hover(e, L); });
    const up = (e) => { if (drag) { const d = drag; drag = null; if (d.up) d.up(e); } };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('dblclick', (e) => doubleClick(e, L));
    size.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      size.setPointerCapture(e.pointerId);
      const y0 = e.clientY, h0 = L.h;
      size.onpointermove = (ev) => {
        L.h = clamp(h0 + ev.clientY - y0, 36, 260);
        ui.laneH[k] = L.h;
        root.style.height = L.h + 'px';
        paintLane(k);
      };
      size.onpointerup = () => { size.onpointermove = null; K.saveUi(); };
    });
    root.style.height = L.h + 'px';
    return L;
  }

  function sync() {
    const ks = Object.keys(state.auto).filter((k) => BY_KEY[k] && !BY_KEY[k].opts);
    for (const [k, L] of lanes) if (!ks.includes(k)) { L.root.remove(); lanes.delete(k); }
    ks.forEach((k, i) => {
      let L = lanes.get(k);
      if (!L) { L = buildLane(k); lanes.set(k, L); lanesBox.append(L.root); }
      L.root.style.setProperty('--tint', `var(--t-${(i % 9) + 1})`);
      paintHead(L);
    });
    if (active && !lanes.has(active)) active = null;
    if (!active && ks.length) active = ks[0];
    pruneSelection();
    $('tlEmpty').hidden = ks.length > 0;
    lanes.forEach((L) => L.root.classList.toggle('active', L.k === active));
    measure();
    paintEverything();
  }
  function paintHead(L) {
    const a = state.auto[L.k];
    L.setMode(a.mode);
    L.root.classList.toggle('off', a.off);
    L.power.setAttribute('aria-pressed', String(!a.off));
  }
  function pruneSelection() {
    const keys = active && state.auto[active] ? state.auto[active].keys : [];
    for (const key of sel) if (!keys.includes(key)) sel.delete(key);
  }
  function setActive(k) {
    if (active !== k) sel.clear();
    active = k;
    lanes.forEach((L) => { L.root.classList.toggle('active', L.k === k); paintLane(L.k); });
    paintInspector();
  }

  function paintLane(k) {
    const L = lanes.get(k), a = state.auto[k], c = BY_KEY[k];
    if (!L || !a || !viewW) return;
    const H = L.h, g = fit(L.canvas, viewW, H), len = K.timelineLength();
    const yOf = (v) => PAD + (1 - (v - c.min) / (c.max - c.min)) * (H - 2 * PAD);
    const tint = getComputedStyle(L.root).getPropertyValue('--tint').trim() || colors.text;
    g.clearRect(0, 0, viewW, H);

    const step = tickStep();
    g.strokeStyle = colors.hair;
    g.beginPath();
    for (let i = Math.floor(tOf(0) / step); i * step <= Math.min(len, tOf(viewW)); i++) {
      const x = Math.round(xOf(i * step)) + 0.5;
      g.moveTo(x, 0); g.lineTo(x, H);
    }
    g.stroke();

    const base = state.params[k], isKeys = a.mode === 'keys' && a.keys.length;
    if (!isKeys) {
      g.setLineDash([3, 4]);
      g.strokeStyle = colors.line;
      g.beginPath();
      g.moveTo(0, yOf(base)); g.lineTo(viewW, yOf(base));
      g.stroke();
      g.setLineDash([]);
    }

    // the value over time, one sample a pixel, filled down to the floor of the lane
    const x0 = Math.max(0, xOf(0)), x1 = Math.min(viewW, xOf(len));
    g.beginPath();
    for (let x = x0; x <= x1; x++) {
      const y = yOf(Auto.valueOf(a, base, c, tOf(x)));
      if (x === x0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.strokeStyle = tint;
    g.lineWidth = 1.5;
    g.lineJoin = 'round';
    g.stroke();
    g.lineTo(x1, H); g.lineTo(x0, H); g.closePath();
    g.globalAlpha = 0.13;
    g.fillStyle = tint;
    g.fill();
    g.globalAlpha = 1;
    g.lineWidth = 1;

    L.handles = [];
    if (a.mode === 'keys') {
      // a dot at the middle of each line on the active lane bends that line
      if (k === active) {
        a.keys.forEach((key, i) => {
          const next = a.keys[i + 1];
          if (!next || key.ease === 'hold' || next.t > len) return;
          const xa = xOf(key.t), xb = xOf(next.t);
          if (xb - xa < 30 || xb < 0 || xa > viewW) return;
          const tm = (key.t + next.t) / 2, x = xOf(tm), y = yOf(Auto.valueAt(a.keys, tm));
          L.handles.push({ i, x, y });
          g.beginPath();
          g.arc(x, y, 2.5, 0, 6.2832);
          g.fillStyle = colors.surface;
          g.fill();
          g.strokeStyle = tint;
          g.stroke();
        });
      }
      a.keys.forEach((key) => {
        const x = xOf(Math.min(key.t, len)), y = yOf(key.v), on = sel.has(key);
        if (x < -8 || x > viewW + 8) return;
        g.beginPath();
        g.arc(x, y, on ? 5 : 4, 0, 6.2832);
        g.fillStyle = on ? tint : colors.surface;
        g.fill();
        g.lineWidth = on ? 2 : 1.5;
        g.strokeStyle = on ? colors.text : tint;
        if (key.t > len) g.setLineDash([2, 2]);
        g.stroke();
        g.setLineDash([]);
        g.lineWidth = 1;
      });
    }
    if (L.marquee) {
      const m = L.marquee;
      g.fillStyle = tint;
      g.globalAlpha = 0.12;
      g.fillRect(m.x0, 0, m.x - m.x0, H);
      g.globalAlpha = 1;
    }
  }
  function paintEverything() {
    paintRuler();
    lanes.forEach((L) => paintLane(L.k));
    paintInspector();
  }

  // ------------------------------------------------------------ working on a lane
  const pos = (e, L) => {
    const b = L.canvas.getBoundingClientRect();
    return { x: e.clientX - b.left, y: e.clientY - b.top };
  };
  function keyAt(L, a, x, y) {
    if (a.mode !== 'keys') return null;
    const c = BY_KEY[L.k], len = K.timelineLength();
    let best = null, bd = HIT * HIT;
    for (const key of a.keys) {
      const dx = xOf(Math.min(key.t, len)) - x;
      const dy = PAD + (1 - (key.v - c.min) / (c.max - c.min)) * (L.h - 2 * PAD) - y;
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = key; }
    }
    return best;
  }
  const handleAt = (L, x, y) => L.handles.find((h) => Math.hypot(h.x - x, h.y - y) < HIT);
  const valueAtY = (L, y) => {
    const c = BY_KEY[L.k], u = 1 - clamp((y - PAD) / (L.h - 2 * PAD), 0, 1);
    return roundTo(c, c.min + u * (c.max - c.min));
  };
  const roundTo = (c, v) => clamp(+(Math.round(v / c.step) * c.step).toFixed(5), c.min, c.max);

  function hover(e, L) {
    const { x, y } = pos(e, L), a = state.auto[L.k];
    L.canvas.style.cursor = keyAt(L, a, x, y) ? 'grab' : handleAt(L, x, y) ? 'ns-resize' : 'default';
  }

  function pressLane(e, L) {
    const k = L.k, a = state.auto[k], { x, y } = pos(e, L);
    L.canvas.setPointerCapture(e.pointerId);
    if (active !== k) setActive(k);
    if (a.mode === 'lfo') {
      K.seek(tOf(x));
      drag = { move: (ev) => K.seek(tOf(pos(ev, L).x)) };
      return;
    }
    const key = keyAt(L, a, x, y);
    if (key) {
      if (e.shiftKey) { if (sel.has(key)) sel.delete(key); else sel.add(key); }
      else if (!sel.has(key)) { sel.clear(); sel.add(key); }
      paintLane(k);
      paintInspector();
      moveKeys(L, a, key, x, y, e.shiftKey);
      return;
    }
    const h = handleAt(L, x, y);
    if (h) { bendLine(L, a, h.i, y); return; }
    // a click moves the playhead, a drag selects the keyframes it crosses
    let swept = false;
    drag = {
      move(ev) {
        const p = pos(ev, L);
        if (!swept && Math.abs(p.x - x) < 4) return;
        swept = true;
        L.marquee = { x0: x, x: p.x };
        paintLane(k);
      },
      up() {
        if (!swept) { K.seek(tOf(x)); sel.clear(); }
        else {
          const lo = tOf(Math.min(L.marquee.x0, L.marquee.x)), hi = tOf(Math.max(L.marquee.x0, L.marquee.x));
          if (!e.shiftKey) sel.clear();
          a.keys.forEach((q) => { if (q.t >= lo && q.t <= hi) sel.add(q); });
          L.marquee = null;
        }
        paintLane(k);
        paintInspector();
      },
    };
  }

  function moveKeys(L, a, key, x0, y0, shift) {
    const k = L.k, c = BY_KEY[k], len = K.timelineLength(), span = c.max - c.min;
    const from = new Map([...sel].map((q) => [q, { t: q.t, v: q.v }]));
    let moved = false;
    L.canvas.style.cursor = 'grabbing';
    drag = {
      move(ev) {
        const p = pos(ev, L), dx = p.x - x0, dy = p.y - y0;
        if (!moved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
        moved = true;
        const dt = dx / pps, dv = -(dy / (L.h - 2 * PAD)) * span;
        from.forEach((o, q) => {
          q.t = clamp(K.snapT(o.t + dt), 0, len);
          q.v = roundTo(c, o.v + dv);
        });
        a.keys.sort(byTime);
        if (sel.size === 1) K.seek(key.t);
        paintLane(k);
        paintInspector();
      },
      up() {
        L.canvas.style.cursor = 'grab';
        if (!moved) {
          if (!shift) K.seek(key.t);
          return;
        }
        // a keyframe dropped on another one replaces it
        a.keys = a.keys.filter((x) => sel.has(x) || ![...sel].some((q) => Math.abs(q.t - x.t) < 1e-6));
        K.automate.keysChanged(k, c.l + ': moved keyframe');
      },
    };
  }

  // how far a line bows: 0 is straight, 1 gets there early, -1 gets there late
  function tension(s) {
    const u = Math.abs(s);
    const ease = s >= 0
      ? [0.33 * (1 - u), 0.33 + 0.42 * u, 0.67 - 0.37 * u, 0.67 + 0.33 * u]
      : [0.33 + 0.37 * u, 0.33 - 0.33 * u, 0.67 + 0.33 * u, 0.67 - 0.42 * u];
    return ease.map((v) => +v.toFixed(3));
  }
  function bendLine(L, a, i, y0) {
    const k = L.k, key = a.keys[i], next = a.keys[i + 1], rising = next.v >= key.v;
    const s0 = clamp(Auto.ease(key.ease, 0.5) * 2 - 1, -1, 1);
    drag = {
      move(ev) {
        const dy = pos(ev, L).y - y0;
        key.ease = tension(clamp(s0 + (rising ? -dy : dy) / 50, -1, 1));
        paintLane(k);
        paintInspector();
      },
      up() { K.automate.keysChanged(k, BY_KEY[k].l + ': curve'); },
    };
  }

  function doubleClick(e, L) {
    const k = L.k, a = state.auto[k], { x, y } = pos(e, L);
    if (a.mode !== 'keys') return;
    const key = keyAt(L, a, x, y);
    if (key) {
      removeKeys(k, new Set([key]));
    } else {
      const added = K.automate.upsertKey(k, valueAtY(L, y), tOf(x));
      sel.clear();
      sel.add(added);
      K.automate.keysChanged(k, BY_KEY[k].l + ': keyframe');
    }
  }
  function removeKeys(k, set) {
    const a = state.auto[k];
    if (a.keys.length === set.size) state.params[k] = a.keys[0].v; // the slider keeps the last value
    a.keys = a.keys.filter((q) => !set.has(q));
    set.forEach((q) => sel.delete(q));
    K.automate.keysChanged(k, BY_KEY[k].l + ': deleted keyframe');
  }

  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input:not([type=range]), select, textarea, dialog') || e.metaKey || e.ctrlKey) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && sel.size && active) {
      e.preventDefault();
      removeKeys(active, new Set(sel));
    } else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !e.target.closest('input')) {
      e.preventDefault();
      const dir = e.key === 'ArrowLeft' ? -1 : 1, frames = dir * (e.shiftKey ? 10 : 1) / 30;
      if (sel.size && active) {
        const c = state.auto[active];
        sel.forEach((q) => { q.t = clamp(q.t + frames, 0, K.timelineLength()); });
        c.keys.sort(byTime);
        K.automate.keysChanged(active, BY_KEY[active].l + ': moved keyframe');
      } else {
        K.seek(K.timeNow() + frames);
      }
    } else if (e.key === 'Home') {
      K.seek(0);
    }
  });

  // ------------------------------------------------------------ the velocity curve of a keyframe
  const EASES = [
    ['Ease in-out', [0.42, 0, 0.58, 1]],
    ['Linear', [0, 0, 1, 1]],
    ['Ease in', [0.42, 0, 1, 1]],
    ['Ease out', [0, 0, 0.58, 1]],
    ['Snap', [0.9, 0, 0.1, 1]],
    ['Overshoot', [0.3, 1.35, 0.6, 1]],
    ['Hold', 'hold'],
  ];
  const easeName = (e) => (EASES.find(([, x]) => String(x) === String(e)) || ['Custom'])[0];
  const Y_LO = -0.4, Y_HI = 1.4; // progress shown, with room to overshoot
  const cx = (x) => x * 100, cy = (y) => ((Y_HI - y) / (Y_HI - Y_LO)) * 100;
  const svg = (tag, attrs) => {
    const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const a in attrs) e.setAttribute(a, attrs[a]);
    return e;
  };

  const curve = (() => {
    const box = el('div', 'ins-ease');
    const select = el('select', 'select');
    select.setAttribute('aria-label', 'Keyframe curve');
    [...EASES.map(([n]) => n), 'Custom'].forEach((n) => { const o = el('option', '', n); o.value = n; o.disabled = n === 'Custom'; select.append(o); });
    const plot = el('div', 'kf-plot');
    const s = svg('svg', { viewBox: '0 0 100 100', preserveAspectRatio: 'none', 'aria-hidden': 'true' });
    const arm1 = svg('line', { class: 'kf-arm' }), arm2 = svg('line', { class: 'kf-arm' });
    const speed = svg('path', { class: 'kf-speed' }), value = svg('path', { class: 'kf-value' });
    s.append(svg('rect', { class: 'kf-box', x: 0, y: cy(1), width: 100, height: cy(0) - cy(1) }), arm1, arm2, speed, value);
    const h1 = el('span', 'kf-handle'), h2 = el('span', 'kf-handle');
    plot.append(s, h1, h2);
    const legend = el('p', 'kf-legend');
    legend.append(el('span', '', 'Value'), el('span', '', 'Speed'));
    box.append(select, plot, legend);

    const targets = () => [...sel];
    function paint() {
      const key = targets()[0];
      if (!key) return;
      const e = key.ease, hold = e === 'hold';
      select.value = easeName(e);
      h1.hidden = h2.hidden = hold;
      arm1.style.display = arm2.style.display = hold ? 'none' : '';
      if (hold) {
        value.setAttribute('d', `M0 ${cy(0)} H100 V${cy(1)}`);
        speed.setAttribute('d', `M0 ${cy(0)} H100`);
        return;
      }
      const [x1, y1, x2, y2] = e, pts = [];
      for (let i = 0; i <= 64; i++) {
        const u = i / 64;
        pts.push([Auto.bezier(x1, x2, u), Auto.bezier(y1, y2, u), Auto.bezierSlope(y1, y2, u) / Math.max(Auto.bezierSlope(x1, x2, u), 1e-3)]);
      }
      const peak = Math.max(1e-6, ...pts.map((p) => Math.abs(p[2])));
      const line = (fn) => 'M' + pts.map((p) => cx(p[0]).toFixed(2) + ' ' + cy(fn(p)).toFixed(2)).join(' L');
      value.setAttribute('d', line((p) => p[1]));
      speed.setAttribute('d', line((p) => p[2] / peak));
      const arm = (a, x0, y0, x, y) => { a.setAttribute('x1', cx(x0)); a.setAttribute('y1', cy(y0)); a.setAttribute('x2', cx(x)); a.setAttribute('y2', cy(y)); };
      arm(arm1, 0, 0, x1, y1);
      arm(arm2, 1, 1, x2, y2);
      const place = (h, x, y) => { h.style.left = cx(x) + '%'; h.style.top = cy(y) + '%'; };
      place(h1, x1, y1);
      place(h2, x2, y2);
    }
    const commit = () => { paint(); paintLane(active); K.automate.keysChanged(active, BY_KEY[active].l + ': curve'); };
    select.onchange = () => {
      const preset = EASES.find(([n]) => n === select.value);
      if (!preset) return;
      targets().forEach((q) => { q.ease = K.automate.copyEase(preset[1]); });
      commit();
    };
    const grab = (h, which) => {
      h.onpointerdown = (e) => {
        e.preventDefault();
        h.setPointerCapture(e.pointerId);
        h.onpointermove = (ev) => {
          const b = plot.getBoundingClientRect();
          const x = clamp((ev.clientX - b.left) / b.width, 0, 1);
          const y = clamp(Y_HI - ((ev.clientY - b.top) / b.height) * (Y_HI - Y_LO), Y_LO, Y_HI);
          targets().forEach((q) => {
            const ease = [...(q.ease === 'hold' ? K.automate.EASE_IN_OUT : q.ease)];
            ease[which * 2] = +x.toFixed(2);
            ease[which * 2 + 1] = +y.toFixed(2);
            q.ease = ease;
          });
          paint();
          paintLane(active);
        };
        h.onpointerup = h.onpointercancel = () => { h.onpointermove = null; commit(); };
      };
    };
    grab(h1, 0);
    grab(h2, 1);
    return { box, paint };
  })();

  // ------------------------------------------------------------ the panel on the right
  function field(label, value, step, onSet) {
    const box = el('label', 'ins-field');
    const input = el('input', 'number');
    input.type = 'number'; input.step = step; input.value = value;
    input.onchange = () => { if (Number.isFinite(+input.value)) onSet(+input.value); };
    box.append(label, input);
    return box;
  }
  function tips() {
    const t = el('div', 'ins-tip');
    ['Double-click a lane to add a keyframe, or a keyframe to delete it.',
      'Drag a keyframe to move it. Drag the small dot on a line to bend it.',
      'Drag across a lane to select several. Shift-click adds to them.',
      'Press Delete to remove them, and ← → to nudge a frame.',
      'Scroll sideways to move along. Hold ⌘ and scroll to zoom.',
    ].forEach((line) => t.append(el('span', '', line)));
    return t;
  }
  function paintInspector() {
    const a = active && state.auto[active], c = active && BY_KEY[active];
    if (!a) { inspect.replaceChildren(tips()); return; }
    if (a.mode === 'lfo') {
      const l = a.lfo, name = (Auto.WAVES.find(([w]) => w === l.wave) || [])[1];
      const edit = el('button', 'btn btn-secondary btn-xs', 'Edit LFO');
      edit.type = 'button';
      edit.onclick = () => K.openMod(active, edit);
      inspect.replaceChildren(
        el('h3', 'ins-title', c.l),
        el('p', 'hint', `${name} LFO at ${l.rate < 1 ? l.rate.toFixed(2) : l.rate.toFixed(1)} Hz, ${Math.round(l.depth * 100)}% depth. It swings around the slider's value.`),
        edit,
      );
      return;
    }
    if (!sel.size) {
      inspect.replaceChildren(el('h3', 'ins-title', c.l), el('p', 'hint', a.keys.length + (a.keys.length === 1 ? ' keyframe. ' : ' keyframes. ') + 'Select one to shape its curve.'), tips());
      return;
    }
    const keys = [...sel].sort(byTime), key = keys[0], next = a.keys[a.keys.indexOf(key) + 1];
    const parts = [el('h3', 'ins-title', c.l)];
    if (keys.length === 1) {
      const fields = el('div', 'ins-fields');
      fields.append(
        field('Time (s)', +key.t.toFixed(3), 0.01, (v) => {
          key.t = clamp(v, 0, K.timelineLength());
          a.keys.sort(byTime);
          K.automate.keysChanged(active, c.l + ': moved keyframe');
        }),
        field('Value', +key.v.toFixed(4), c.step, (v) => {
          key.v = clamp(v, c.min, c.max);
          K.automate.keysChanged(active, c.l + ': keyframe value');
        }),
      );
      parts.push(fields);
      if (next) {
        parts.push(el('p', 'hint', `To ${K.fmtVal(c, next.v)} over ${(next.t - key.t).toFixed(2)} s`), curve.box);
      } else {
        parts.push(el('p', 'hint', 'Last keyframe: the value holds from here to the end.'));
      }
    } else {
      parts.push(el('p', 'hint', keys.length + ' keyframes selected. Drag any of them to move them together, or set a curve for all of them.'), curve.box);
    }
    inspect.replaceChildren(...parts);
    curve.paint();
  }

  // ------------------------------------------------------------ add a parameter
  const pick = $('pickPop'), addBtn = $('tlAdd');
  const PICK_GROUPS = [
    { id: 'quick', title: 'Quick', controls: [...MASTER, ...MACROS] },
    ...GROUPS,
  ].map((g) => ({ id: g.id, title: g.title, controls: g.controls.filter((c) => !c.opts) }));
  let pickCat = PICK_GROUPS[1].id;
  function paintPicker() {
    const q = $('pickSearch').value.trim().toLowerCase();
    $('pickCats').replaceChildren(...PICK_GROUPS.map((g) => {
      const b = el('button', 'cat');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(!q && g.id === pickCat));
      b.append(el('span', '', g.title), el('small', '', String(g.controls.length)));
      b.onclick = () => { $('pickSearch').value = ''; pickCat = g.id; paintPicker(); };
      return b;
    }));
    const list = q
      ? PICK_GROUPS.flatMap((g) => g.controls.map((c) => ({ c, g }))).filter(({ c, g }) => (c.l + ' ' + g.title).toLowerCase().includes(q))
      : PICK_GROUPS.find((g) => g.id === pickCat).controls.map((c) => ({ c }));
    $('pickList').replaceChildren(...list.map(({ c, g }) => {
      const b = el('button', 'pick-item');
      b.type = 'button';
      const on = !!state.auto[c.k];
      b.disabled = on;
      b.append(el('span', '', c.l), el('small', '', on ? 'In timeline' : g ? g.title : ''));
      b.onclick = () => { K.closePops(); K.automate.setMode(c.k, 'keys'); setActive(c.k); };
      return b;
    }));
  }
  addBtn.onclick = () => {
    const open = pick.hidden;
    K.closePops();
    if (!open) return;
    pick.hidden = false;
    $('pickSearch').value = '';
    paintPicker();
    addBtn.setAttribute('aria-expanded', 'true');
    K.placePop(pick, addBtn, ui.tlPos === 'top' ? 'below' : 'above');
    $('pickSearch').focus();
  };
  $('pickSearch').addEventListener('input', paintPicker);

  // ------------------------------------------------------------ bar, zoom and scrolling
  const lenField = $('tlLen');
  function paintLength() {
    $('tlLenField').hidden = K.src.kind === 'video';
    lenField.value = Math.round(state.length * 100) / 100;
  }
  lenField.onchange = () => {
    state.length = clamp(+lenField.value || state.length, 1, 600);
    lenField.value = state.length;
    measure();
    paintEverything();
    K.changed('Timeline length');
  };
  $('tlSnap').value = ui.snap;
  $('tlSnap').onchange = (e) => { ui.snap = e.target.value; K.saveUi(); };

  const setZoom = (z, atX) => {
    const px = atX === undefined ? viewW / 2 : atX, t = tOf(px);
    zoom = clamp(z, 1, MAX_ZOOM);
    measure();
    scroller.scrollLeft = t * pps - px;
    $('tlZoom').value = Math.log(zoom) / Math.log(MAX_ZOOM);
    $('tlZoom').style.setProperty('--pct', $('tlZoom').value * 100 + '%');
    paintEverything();
  };
  $('tlZoom').oninput = (e) => setZoom(Math.pow(MAX_ZOOM, +e.target.value));
  grid.addEventListener('wheel', (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const b = ruler.getBoundingClientRect();
      setZoom(zoom * Math.exp(-e.deltaY * 0.01), e.clientX - b.left);
    } else if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      e.preventDefault();
      scroller.scrollLeft += e.deltaX;
    }
  }, { passive: false });
  let scrollQueued = false;
  scroller.addEventListener('scroll', () => {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(() => {
      scrollQueued = false;
      paintRuler();
      lanes.forEach((L) => paintLane(L.k));
    });
  });

  ruler.addEventListener('pointerdown', (e) => {
    ruler.setPointerCapture(e.pointerId);
    const seek = (ev) => K.seek(tOf(ev.clientX - ruler.getBoundingClientRect().left));
    seek(e);
    ruler.onpointermove = seek;
    ruler.onpointerup = ruler.onpointercancel = () => { ruler.onpointermove = null; };
  });

  K.segmented($('tlHeights'), [['s', 'S'], ['m', 'M'], ['l', 'L']], ui.laneSize, (v) => {
    ui.laneSize = v;
    ui.laneH = {};
    K.saveUi();
    lanes.forEach((L) => { L.h = laneHeight(L.k); L.root.style.height = L.h + 'px'; });
    paintEverything();
  }, 'sm');

  K.showTimeline = () => {
    if (ui.tlPos !== 'hidden') return;
    ui.tlPos = ui.tlLast || 'bottom';
    K.applyLayout();
  };
  $('tlHide').onclick = () => { ui.tlLast = ui.tlPos; ui.tlPos = 'hidden'; K.applyLayout(); };
  $('tlShow').onclick = K.showTimeline;

  // ------------------------------------------------------------ keeping up
  K.on('auto', (k) => {
    const L = k && lanes.get(k);
    if (L && state.auto[k]) {
      paintHead(L);
      paintLane(k);
      paintInspector();
    } else {
      sync();
    }
  });
  K.on('select', ({ k, key }) => { setActive(k); sel.clear(); sel.add(key); paintLane(k); paintInspector(); });
  K.on('activate', (k) => { setActive(k); const L = lanes.get(k); if (L) L.root.scrollIntoView({ block: 'nearest' }); });
  K.on('source', () => { paintLength(); });
  K.on('theme', () => { readColors(); paintEverything(); });
  K.on('layout', () => { measure(); paintEverything(); });
  new ResizeObserver(() => { measure(); paintEverything(); }).observe(grid);

  // every frame: the playhead, following it off the edge of the view, and each lane's live value
  K.hooks.push(() => {
    if (ui.tlPos === 'hidden') return;
    const len = K.timelineLength();
    if (len !== lastLen) { lastLen = len; measure(); paintLength(); paintEverything(); }
    if (!viewW) { measure(); paintEverything(); if (!viewW) return; }
    const t = K.timeNow();
    let x = xOf(t);
    if (state.playing && zoom > 1 && !drag && (x > viewW - 16 || x < 0)) {
      scroller.scrollLeft = t * pps - 24;
      x = xOf(t);
    }
    head.hidden = x < 0 || x > viewW;
    head.style.transform = `translateX(${ruler.offsetLeft + x}px)`;
    lanes.forEach((L, k) => {
      const v = K.live[k] !== undefined ? K.live[k] : state.params[k];
      if (v !== L.shown) { L.shown = v; L.val.textContent = K.fmtVal(BY_KEY[k], v); }
    });
  });

  readColors();
  paintLength();
  sync();
})();
