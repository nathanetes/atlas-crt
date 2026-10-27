// Atlas CRT control rack: the looks and adjust tabs, quick macros, every module's
// controls, per-slider keyframes with a curve editor, saved looks and this browser's session.
(function () {
  const K = window.Atlas;
  if (!K || !K.engine) return;
  const { MASTER, MACROS, GROUPS, DEFAULTS, BY_KEY, PRESETS, CATS } = window.AtlasParams;
  const $ = (id) => document.getElementById(id);
  const { state, store, toast } = K;
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };

  // ------------------------------------------------------------ tabs
  function showPane(name) {
    ['looks', 'adjust'].forEach((p) => {
      $('pane-' + p).hidden = p !== name;
      $('tab-' + p).setAttribute('aria-selected', String(p === name));
    });
    store('atlas.pane', name);
  }
  $('tab-looks').onclick = () => showPane('looks');
  $('tab-adjust').onclick = () => showPane('adjust');

  // ------------------------------------------------------------ one control row
  const rows = new Map();
  const decimals = (c) => (c.step >= 1 ? 0 : c.step >= 0.1 ? 1 : c.step >= 0.01 ? 2 : 3);
  const fmtVal = (c, v) => {
    if (c.opts) { const o = c.opts.find((x) => x.v === v); return o ? o.l : String(v); }
    return v.toFixed(decimals(c)) + (c.u && c.u.length < 4 ? ' ' + c.u : '');
  };
  const pct = (c, v) => ((v - c.min) / (c.max - c.min)) * 100 + '%';

  function buildControl(c, parent) {
    const row = el('div', 'ctl');
    const id = 'c_' + c.k;
    const label = el('label', '', c.l);
    label.htmlFor = id;
    label.title = c.u && c.u.length >= 4 ? c.u + ' · double-click to reset' : 'Double-click to reset';
    const out = el('output');
    out.htmlFor = id;
    row.append(label, out);
    let input, keyBtn = null, kf = null;
    if (c.opts) {
      input = el('select');
      c.opts.forEach((o) => { const op = el('option', '', o.l); op.value = String(o.v); input.append(op); });
      input.onchange = () => setParam(c.k, +input.value);
      row.append(input);
    } else {
      keyBtn = el('button', 'key-btn', '◆');
      keyBtn.type = 'button';
      keyBtn.title = 'Keyframe ' + c.l.toLowerCase();
      keyBtn.setAttribute('aria-pressed', 'false');
      keyBtn.onclick = () => toggleKeys(c.k);
      row.append(keyBtn);
      input = el('input');
      input.type = 'range';
      input.min = c.min; input.max = c.max; input.step = c.step;
      input.oninput = () => setParam(c.k, +input.value);
      input.ondblclick = () => setParam(c.k, DEFAULTS[c.k]);
      row.append(input);
      kf = buildKeyPanel(c);
      row.append(kf.box);
      // a slider drag edits one keyframe, even while the clip plays on under it
      input.addEventListener('pointerdown', () => { kf.sliding = true; });
      const release = () => { kf.sliding = false; kf.dragKey = null; };
      input.addEventListener('pointerup', release);
      input.addEventListener('change', release);
    }
    input.id = id;
    label.ondblclick = () => setParam(c.k, DEFAULTS[c.k]);
    parent.append(row);
    rows.set(c.k, { c, row, input, out, keyBtn, kf });
  }

  function paintRow(k) {
    const r = rows.get(k);
    if (!r) return;
    const a = state.auto[k];
    paintValue(r, a && !(r.kf && r.kf.sliding) ? liveValue(k) : state.params[k]);
    r.row.classList.toggle('changed', Math.abs(state.params[k] - DEFAULTS[k]) > 1e-6);
    if (!r.kf) return;
    r.keyBtn.setAttribute('aria-pressed', String(!!a));
    r.kf.box.hidden = !a;
    r.row.classList.toggle('automated', !!a);
    if (a) paintKeys(k);
  }
  function paintValue(r, v) {
    if (r.c.opts) r.input.value = String(v);
    else { r.input.value = v; r.input.style.setProperty('--pct', pct(r.c, v)); }
    r.out.textContent = fmtVal(r.c, v);
  }

  function setParam(k, v) {
    state.params[k] = v;
    const r = rows.get(k);
    if (state.auto[k] && r && r.kf) {
      const key = r.kf.dragKey || upsertKey(k, v);
      key.v = v;
      if (r.kf.sliding) r.kf.dragKey = key;
      r.kf.sel = key;
      K.live[k] = v;
      paintAutoList();
    }
    paintRow(k);
    if (state.look) { state.look = null; paintLooks(); }
    paintModules();
    persist();
  }

  // ------------------------------------------------------------ keyframes
  // Each keyframed control has a lane: its keyframes on the timeline and the playhead. Moving the
  // slider sets a keyframe at the playhead. The curve under the lane shapes the move out of the
  // selected keyframe: drag its two handles (a cubic Bézier, as in CSS easing) or pick a preset.
  // The solid line is the value over the move, the dashed one its speed.
  const KEY_FPS = 30; // keyframes land on whole frames
  const snapT = (t) => Math.round(t * KEY_FPS) / KEY_FPS;
  const EASES = [
    ['ease in-out', [0.42, 0, 0.58, 1]],
    ['linear', [0, 0, 1, 1]],
    ['ease in', [0.42, 0, 1, 1]],
    ['ease out', [0, 0, 0.58, 1]],
    ['snap', [0.9, 0, 0.1, 1]],
    ['overshoot', [0.3, 1.35, 0.6, 1]],
    ['hold', 'hold'],
  ];
  const copyEase = (e) => (e === 'hold' ? 'hold' : [...e]);
  const easeName = (e) => (EASES.find(([, x]) => String(x) === String(e)) || ['custom'])[0];
  const Y_LO = -0.4, Y_HI = 1.4; // progress shown by the curve editor, room to overshoot
  const cx = (x) => x * 100, cy = (y) => ((Y_HI - y) / (Y_HI - Y_LO)) * 100;
  const svg = (tag, attrs) => {
    const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const a in attrs) e.setAttribute(a, attrs[a]);
    return e;
  };
  const fmtT = (t) => t.toFixed(2) + ' s';

  function buildKeyPanel(c) {
    const kf = { box: el('div', 'kf'), sel: null, dragKey: null, sliding: false, grabbing: false, len: 0 };
    kf.box.hidden = true;
    const btn = (text, title, fn) => { const b = el('button', 'mini', text); b.type = 'button'; b.title = title; b.onclick = fn; return b; };
    const nav = el('div', 'kf-nav');
    kf.info = el('output', 'kf-info');
    nav.append(
      btn('<', 'Previous keyframe', () => stepKey(c.k, -1)),
      btn('key', 'Set a keyframe at the playhead', () => { selectKey(c.k, upsertKey(c.k, liveValue(c.k))); persist(); }),
      btn('>', 'Next keyframe', () => stepKey(c.k, 1)),
      btn('del', 'Delete the selected keyframe', () => deleteKey(c.k)),
      kf.info,
    );
    kf.lane = el('div', 'kf-lane');
    kf.lane.title = 'Click to move the playhead';
    kf.head = el('span', 'kf-head');
    kf.lane.append(kf.head);
    kf.lane.onpointerdown = (e) => {
      if (e.target !== kf.lane) return;
      kf.lane.setPointerCapture(e.pointerId);
      const seek = (ev) => { const b = kf.lane.getBoundingClientRect(); K.seek(((ev.clientX - b.left) / b.width) * K.timelineLength()); };
      seek(e);
      kf.lane.onpointermove = seek;
      kf.lane.onpointerup = kf.lane.onpointercancel = () => { kf.lane.onpointermove = null; };
    };

    kf.curve = el('div', 'kf-curve');
    const easeRow = el('div', 'kf-ease');
    kf.ease = el('select');
    kf.ease.setAttribute('aria-label', c.l + ' keyframe curve');
    [...EASES.map(([n]) => n), 'custom'].forEach((n) => { const o = el('option', '', n); o.value = n; o.disabled = n === 'custom'; kf.ease.append(o); });
    kf.ease.onchange = () => {
      const e = EASES.find(([n]) => n === kf.ease.value);
      if (!e || !kf.sel) return;
      kf.sel.ease = copyEase(e[1]);
      paintCurve(c.k); persist();
    };
    kf.span = el('output', 'kf-span');
    easeRow.append(kf.ease, kf.span);
    kf.plot = el('div', 'kf-plot');
    const g = svg('svg', { viewBox: '0 0 100 100', preserveAspectRatio: 'none', 'aria-hidden': 'true' });
    const ns = { 'vector-effect': 'non-scaling-stroke', fill: 'none' };
    g.append(
      svg('rect', { ...ns, class: 'kf-box', x: 0, y: cy(1), width: 100, height: cy(0) - cy(1) }),
      (kf.arm1 = svg('line', { ...ns, class: 'kf-arm' })),
      (kf.arm2 = svg('line', { ...ns, class: 'kf-arm' })),
      (kf.speed = svg('path', { ...ns, class: 'kf-speed' })),
      (kf.value = svg('path', { ...ns, class: 'kf-value' })),
    );
    kf.h1 = el('span', 'kf-handle');
    kf.h2 = el('span', 'kf-handle');
    kf.h1.onpointerdown = (e) => grabHandle(e, c.k, 0);
    kf.h2.onpointerdown = (e) => grabHandle(e, c.k, 1);
    kf.plot.append(g, kf.h1, kf.h2);
    const legend = el('p', 'kf-legend');
    legend.append(el('span', 'kf-l-value', 'value'), el('span', 'kf-l-speed', 'speed'));
    kf.curve.append(easeRow, kf.plot, legend);
    kf.end = el('p', 'mod-hint', 'Last keyframe: the value holds from here to the end.');
    kf.box.append(nav, kf.lane, kf.curve, kf.end);
    return kf;
  }

  // the value a keyframed control has at the playhead
  function liveValue(k) {
    const c = BY_KEY[k], keys = state.auto[k].keys;
    const v = keys.length ? K.valueAt(keys, K.timeNow()) : state.params[k];
    return Math.min(c.max, Math.max(c.min, v));
  }
  function upsertKey(k, v) {
    const keys = state.auto[k].keys, t = snapT(K.timeNow());
    let key = keys.find((x) => Math.abs(x.t - t) < 0.5 / KEY_FPS);
    if (key) { key.v = v; return key; }
    const before = keys.filter((x) => x.t < t).pop();
    key = { t, v, ease: before ? copyEase(before.ease) : copyEase(EASES[0][1]) };
    keys.push(key);
    keys.sort((a, b) => a.t - b.t);
    return key;
  }
  function selectKey(k, key) {
    rows.get(k).kf.sel = key;
    paintRow(k); paintAutoList();
  }
  function stepKey(k, dir) {
    const keys = state.auto[k].keys, t = K.timeNow();
    const key = dir < 0 ? keys.filter((x) => x.t < t - 1e-3).pop() : keys.find((x) => x.t > t + 1e-3);
    if (!key) return;
    K.seek(key.t);
    selectKey(k, key);
  }
  function deleteKey(k) {
    const kf = rows.get(k).kf, keys = state.auto[k].keys, i = keys.indexOf(kf.sel);
    if (i < 0) return;
    if (keys.length === 1) { toggleKeys(k); return; }
    keys.splice(i, 1);
    kf.sel = keys[Math.max(0, i - 1)];
    paintRow(k); paintAutoList(); persist();
  }
  function toggleKeys(k) {
    const r = rows.get(k);
    if (state.auto[k]) {
      const v = liveValue(k);
      state.params[k] = +v.toFixed(decimals(r.c) + 1); // keep the value it was showing
      delete state.auto[k];
      r.kf.sel = null;
    } else {
      state.auto[k] = { keys: [] };
      r.kf.sel = upsertKey(k, state.params[k]);
    }
    delete K.live[k];
    paintRow(k); paintAutoList(); persist();
  }

  function paintKeys(k) {
    const r = rows.get(k), kf = r.kf, keys = state.auto[k].keys;
    if (!keys.includes(kf.sel)) kf.sel = keys[0] || null;
    const len = (kf.len = K.timelineLength());
    kf.lane.querySelectorAll('.kf-key').forEach((d) => d.remove());
    keys.forEach((key) => {
      const d = el('button', 'kf-key');
      d.type = 'button';
      const past = key.t > len + 1e-3; // set on a longer clip; it stays until moved back
      d.classList.toggle('past', past);
      d.style.left = Math.min(key.t / len, 1) * 100 + '%';
      d.title = fmtVal(r.c, key.v) + ' at ' + fmtT(key.t) + (past ? ', past the end of this clip' : '') + ' · drag to move';
      d.setAttribute('aria-label', 'Keyframe at ' + fmtT(key.t));
      d.setAttribute('aria-pressed', String(key === kf.sel));
      d.onpointerdown = (e) => grabKey(e, k, key);
      d.onclick = () => {
        if (kf.justMoved) { kf.justMoved = false; return; }
        K.seek(key.t);
        selectKey(k, key);
      };
      kf.lane.append(d);
    });
    paintInfo(k);
    paintCurve(k);
  }
  function paintInfo(k) {
    const kf = rows.get(k).kf, keys = state.auto[k].keys;
    kf.info.textContent = kf.sel ? `${keys.indexOf(kf.sel) + 1}/${keys.length} · ${fmtT(kf.sel.t)}` : '';
  }
  function paintCurve(k) {
    const r = rows.get(k), kf = r.kf, keys = state.auto[k].keys;
    const key = kf.sel, next = key && keys[keys.indexOf(key) + 1];
    kf.curve.hidden = !next;
    kf.end.hidden = !key || !!next;
    if (!next) return;
    const e = key.ease, hold = e === 'hold';
    kf.ease.value = easeName(e);
    kf.span.textContent = `${fmtVal(r.c, key.v)} → ${fmtVal(r.c, next.v)} · ${fmtT(next.t - key.t)}`;
    kf.h1.hidden = kf.h2.hidden = hold;
    [kf.arm1, kf.arm2].forEach((a) => { a.style.display = hold ? 'none' : ''; });
    if (hold) {
      kf.value.setAttribute('d', `M0 ${cy(0)} H100 V${cy(1)}`);
      kf.speed.setAttribute('d', `M0 ${cy(0)} H100`);
      return;
    }
    const [x1, y1, x2, y2] = e;
    const bez = (a1, a2, s) => 3 * a1 * s * (1 - s) * (1 - s) + 3 * a2 * s * s * (1 - s) + s * s * s;
    const slope = (a1, a2, s) => 3 * a1 * (1 - s) * (1 - s) + 6 * (a2 - a1) * s * (1 - s) + 3 * (1 - a2) * s * s;
    const pts = [];
    for (let i = 0; i <= 64; i++) {
      const s = i / 64;
      pts.push([bez(x1, x2, s), bez(y1, y2, s), slope(y1, y2, s) / Math.max(slope(x1, x2, s), 1e-3)]);
    }
    const peak = Math.max(1e-6, ...pts.map((p) => Math.abs(p[2])));
    const line = (fn) => 'M' + pts.map((p) => cx(p[0]).toFixed(2) + ' ' + cy(fn(p)).toFixed(2)).join(' L');
    kf.value.setAttribute('d', line((p) => p[1]));
    kf.speed.setAttribute('d', line((p) => p[2] / peak));
    const arm = (a, x0, y0, x, y) => { a.setAttribute('x1', cx(x0)); a.setAttribute('y1', cy(y0)); a.setAttribute('x2', cx(x)); a.setAttribute('y2', cy(y)); };
    arm(kf.arm1, 0, 0, x1, y1);
    arm(kf.arm2, 1, 1, x2, y2);
    const place = (h, x, y) => { h.style.left = cx(x) + '%'; h.style.top = cy(y) + '%'; };
    place(kf.h1, x1, y1);
    place(kf.h2, x2, y2);
  }

  // drag a keyframe along the lane to retime it
  function grabKey(e, k, key) {
    const kf = rows.get(k).kf, d = e.currentTarget, x0 = e.clientX, len = K.timelineLength();
    d.setPointerCapture(e.pointerId);
    d.onpointermove = (ev) => {
      if (!kf.grabbing && Math.abs(ev.clientX - x0) < 4) return;
      kf.grabbing = true;
      const b = kf.lane.getBoundingClientRect();
      key.t = snapT(Math.min(len, Math.max(0, ((ev.clientX - b.left) / b.width) * len)));
      state.auto[k].keys.sort((a, c) => a.t - c.t);
      d.style.left = (key.t / len) * 100 + '%';
      kf.sel = key;
      K.seek(key.t);
      paintInfo(k); paintCurve(k);
    };
    d.onpointerup = d.onpointercancel = () => {
      d.onpointermove = null;
      if (!kf.grabbing) return;
      kf.grabbing = false;
      kf.justMoved = true; // swallow the click that may follow this drag, and only that one
      setTimeout(() => { kf.justMoved = false; });
      // a keyframe dropped on another one replaces it
      const a = state.auto[k];
      a.keys = a.keys.filter((x) => x === key || Math.abs(x.t - key.t) > 1e-6);
      paintRow(k); paintAutoList(); persist();
    };
  }
  // drag a curve handle to reshape the move out of the selected keyframe
  function grabHandle(e, k, which) {
    e.preventDefault();
    const kf = rows.get(k).kf, h = e.currentTarget;
    h.setPointerCapture(e.pointerId);
    h.onpointermove = (ev) => {
      const b = kf.plot.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (ev.clientX - b.left) / b.width));
      const y = Math.min(Y_HI, Math.max(Y_LO, Y_HI - ((ev.clientY - b.top) / b.height) * (Y_HI - Y_LO)));
      const ease = [...kf.sel.ease];
      ease[which * 2] = +x.toFixed(2);
      ease[which * 2 + 1] = +y.toFixed(2);
      kf.sel.ease = ease;
      paintCurve(k); persist();
    };
    h.onpointerup = h.onpointercancel = () => { h.onpointermove = null; };
  }

  function paintAutoList() {
    const list = $('autoList');
    list.innerHTML = '';
    const ks = Object.keys(state.auto).filter((k) => BY_KEY[k]);
    $('autoEmpty').hidden = ks.length > 0;
    $('tab-adjust').textContent = ks.length ? `adjust ◆${ks.length}` : 'adjust';
    ks.forEach((k) => {
      const n = state.auto[k].keys.length;
      const li = el('li');
      li.append(el('span', '', BY_KEY[k].l.toLowerCase()), el('span', 'dim', ` ${n} keyframe${n === 1 ? '' : 's'}`));
      const x = el('button', 'mini', 'stop');
      x.type = 'button';
      x.title = 'Stop keyframing ' + BY_KEY[k].l.toLowerCase() + ' and keep its current value';
      x.onclick = () => toggleKeys(k);
      li.append(x);
      list.append(li);
    });
  }
  // every frame: move each lane's playhead, and each keyframed slider to the value it is rendering
  K.hooks.push(() => {
    const t = K.timeNow(), len = K.timelineLength();
    for (const k in state.auto) {
      const r = rows.get(k);
      if (!r || !r.kf) continue;
      const kf = r.kf;
      if (kf.len !== len && !kf.grabbing) paintKeys(k);
      kf.head.style.left = (t / len) * 100 + '%';
      if (!kf.sliding && K.live[k] !== undefined && K.live[k] !== kf.shown) paintValue(r, (kf.shown = K.live[k]));
    }
  });

  // ------------------------------------------------------------ quick + master + modules
  buildControl(MASTER[0], $('quickSec'));
  MACROS.forEach((m) => buildControl(m, $('quickSec')));
  MASTER.slice(1).forEach((c) => buildControl(c, $('masterSec')));

  const mods = new Map();
  GROUPS.forEach((g) => {
    const d = el('details', 'mod');
    const s = el('summary');
    s.append(el('span', 'mod-chev'), el('span', 'mod-led'), el('span', 'mod-title', g.title));
    const power = el('button', 'mini', 'on');
    power.type = 'button';
    power.title = 'Switch this module on or off';
    power.onclick = (e) => {
      e.preventDefault(); e.stopPropagation();
      state.enabled[g.id] = !state.enabled[g.id];
      paintModules(); persist();
    };
    const reset = el('button', 'mini', 'reset');
    reset.type = 'button';
    reset.title = 'Return this module to its defaults';
    reset.onclick = (e) => {
      e.preventDefault(); e.stopPropagation();
      g.controls.forEach((c) => { state.params[c.k] = DEFAULTS[c.k]; delete state.auto[c.k]; paintRow(c.k); });
      state.look = null; paintLooks(); paintModules(); paintAutoList(); persist();
    };
    s.append(power, reset);
    const body = el('div', 'mod-body');
    body.append(el('p', 'mod-hint', g.hint));
    g.controls.forEach((c) => buildControl(c, body));
    d.append(s, body);
    $('modules').append(d);
    mods.set(g.id, { g, d, power });
  });
  $('rackState').textContent = GROUPS.length + ' modules';

  function paintModules() {
    for (const { g, d, power } of mods.values()) {
      const on = state.enabled[g.id];
      const active = g.controls.some((c) => c.n !== undefined && Math.abs(state.params[c.k] - c.n) > 1e-6);
      d.classList.toggle('on', on && active);
      d.classList.toggle('off', !on);
      power.textContent = on ? 'on' : 'off';
      power.setAttribute('aria-pressed', String(on));
    }
  }
  const paintAll = () => { rows.forEach((_, k) => paintRow(k)); paintModules(); paintLooks(); paintAutoList(); };

  // ------------------------------------------------------------ render settings
  document.querySelectorAll('#quality button').forEach((b) => {
    b.onclick = () => {
      document.querySelectorAll('#quality button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      K.setQuality(b.dataset.q);
      store('atlas.quality', b.dataset.q);
    };
  });
  $('outSize').onchange = (e) => { K.setOut(e.target.value); store('atlas.out', e.target.value); };

  // ------------------------------------------------------------ looks
  let cat = CATS[0] || 'Mine';
  const mine = () => store('atlas.looks') || [];
  [...CATS, 'Mine'].forEach((name) => {
    const b = el('button', '', name.toLowerCase());
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.dataset.cat = name;
    b.onclick = () => { cat = name; paintLooks(); };
    $('catTabs').append(b);
  });

  function applyLook(look) {
    state.params = { ...DEFAULTS, ...look.p };
    state.enabled = Object.fromEntries(GROUPS.map((g) => [g.id, look.enabled ? look.enabled[g.id] !== false : true]));
    state.auto = keyframed(look.auto);
    K.live = {};
    state.look = look.name;
    paintAll(); persist();
  }
  K.applyLook = applyLook;

  function paintLooks() {
    [...$('catTabs').children].forEach((b) => b.setAttribute('aria-selected', String(b.dataset.cat === cat)));
    const grid = $('presetGrid');
    grid.innerHTML = '';
    const list = cat === 'Mine' ? mine() : PRESETS.filter((p) => p.cat === cat);
    if (!list.length) grid.append(el('p', 'empty-note', 'Looks you save appear here. They keep settings and automation only, in this browser.'));
    list.forEach((look) => {
      const b = el('button', 'preset');
      b.type = 'button';
      b.setAttribute('aria-pressed', String(state.look === look.name));
      b.append(el('span', '', look.name));
      b.onclick = () => applyLook(look);
      if (cat === 'Mine') {
        const x = el('span', 'x', '×');
        x.title = 'Delete this look';
        x.onclick = (e) => {
          e.stopPropagation();
          store('atlas.looks', mine().filter((m) => m.name !== look.name));
          paintLooks();
        };
        b.append(x);
      }
      grid.append(b);
    });
  }

  $('savePreset').onclick = () => {
    const name = $('presetName').value.trim();
    if (!name) { $('presetName').focus(); toast('Type a name for the look first.'); return; }
    const list = mine().filter((m) => m.name !== name);
    list.push({ name, p: { ...state.params }, enabled: { ...state.enabled }, auto: JSON.parse(JSON.stringify(state.auto)) });
    store('atlas.looks', list);
    if (!mine().some((m) => m.name === name)) { toast('This browser blocked saving, so looks cannot be kept here.'); return; }
    $('presetName').value = '';
    state.look = name; cat = 'Mine';
    paintLooks();
    toast('Saved "' + name + '"');
  };
  $('presetName').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('savePreset').click(); });

  $('randomBtn').onclick = () => {
    const p = { ...DEFAULTS };
    GROUPS.forEach((g) => g.controls.forEach((c) => {
      if (c.opts) { if (Math.random() < 0.2) p[c.k] = c.opts[Math.floor(Math.random() * c.opts.length)].v; return; }
      if (c.n !== undefined && Math.random() > 0.25) return;
      const span = c.max - c.min;
      const v = c.n !== undefined ? c.min + span * Math.pow(Math.random(), 1.8) : c.min + span * Math.random();
      p[c.k] = Math.round(v / c.step) * c.step;
    }));
    ['capture', 'invert', 'solar', 'mosh'].forEach((k) => { if (Math.random() > 0.2) p[k] = DEFAULTS[k]; });
    p.tint = 0;
    applyLook({ name: null, p });
  };
  $('resetBtn').onclick = () => applyLook({ name: null, p: {} });

  // keep only keyframed controls (the older waveform automation has no keyframes and is dropped)
  function keyframed(auto) {
    const out = {};
    for (const k in auto || {}) {
      const a = auto[k];
      if (BY_KEY[k] && !BY_KEY[k].opts && a && Array.isArray(a.keys) && a.keys.length) out[k] = JSON.parse(JSON.stringify(a));
    }
    return out;
  }

  // ------------------------------------------------------------ this browser's session
  function persist() {
    clearTimeout(persist.t);
    persist.t = setTimeout(() => store('atlas.session.v3', {
      params: state.params, enabled: state.enabled, look: state.look, auto: state.auto,
    }), 300);
  }
  const saved = store('atlas.session.v3');
  if (saved && saved.params) {
    state.params = { ...DEFAULTS, ...saved.params };
    Object.assign(state.enabled, saved.enabled || {});
    state.auto = keyframed(saved.auto);
    state.look = saved.look || null;
  } else {
    applyLook(PRESETS.find((p) => p.name === 'Init') || { name: null, p: {} });
  }
  // open the looks tab on the active look's category
  const cur = PRESETS.find((p) => p.name === state.look);
  if (cur) cat = cur.cat;
  const q = store('atlas.quality');
  if (q) document.querySelector(`#quality button[data-q="${q}"]`)?.click();
  const o = store('atlas.out');
  if (o) { $('outSize').value = o; K.setOut(o); }
  showPane(store('atlas.pane') === 'adjust' ? 'adjust' : 'looks');
  paintAll();
})();
