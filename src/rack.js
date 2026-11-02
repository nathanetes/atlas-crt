// Atlas CRT controls: the looks and adjust tabs, quick macros, every module's controls, the
// automation popover (keyframes or an LFO for any control), saved looks and this browser's session.
(function () {
  const K = window.Atlas;
  if (!K || !K.engine) return;
  const { MASTER, MACROS, GROUPS, DEFAULTS, BY_KEY, PRESETS, CATS } = window.AtlasParams;
  const Auto = window.AtlasAuto;
  const $ = (id) => document.getElementById(id);
  const { state, store, toast, el, icon, ui } = K;
  const clamp = Auto.clamp;

  // Every change ends here: the session is saved, and history records a step once it settles.
  K.changed = (label) => { persist(); K.history.note(label); };

  // ------------------------------------------------------------ tabs
  function showPane(name) {
    ['looks', 'adjust'].forEach((p) => { $('pane-' + p).hidden = p !== name; });
    store('atlas.pane', name);
  }
  const setPane = K.segmented($('rackTabs'), [['looks', 'Looks'], ['adjust', 'Adjust']], 'looks', showPane);

  // ------------------------------------------------------------ one control row
  const rows = new Map();
  K.rows = rows;
  const decimals = (c) => (c.dp !== undefined ? c.dp : c.step >= 1 ? 0 : c.step >= 0.1 ? 1 : c.step >= 0.01 ? 2 : 3);
  const fmtVal = (K.fmtVal = (c, v) => {
    if (c.opts) { const o = c.opts.find((x) => x.v === v); return o ? o.l : String(v); }
    return v.toFixed(decimals(c)) + (c.u && c.u.length < 4 ? ' ' + c.u : '');
  });
  // where a value sits on its slider, 0..1. A control with pow gives small values most of the travel.
  const share = (c, v) => {
    const u = (v - c.min) / (c.max - c.min);
    return c.pow ? Math.pow(Math.max(0, u), 1 / c.pow) : u;
  };
  const fromShare = (c, x) => c.min + (c.max - c.min) * Math.pow(x, c.pow);

  function buildControl(c, parent, group) {
    const row = el('div', 'ctl');
    const id = 'c_' + c.k;
    const label = el('label', '', c.l);
    label.htmlFor = id;
    label.title = c.u && c.u.length >= 4 ? c.u + ' · double-click to reset' : 'Double-click to reset';
    const r = { c, row, home: parent, search: (c.l + ' ' + (group || '')).toLowerCase(), sliding: false, dragKey: null };
    row.append(label);
    if (c.opts) {
      row.classList.add('is-select');
      const input = (r.input = el('select', 'select'));
      c.opts.forEach((o) => { const op = el('option', '', o.l); op.value = String(o.v); input.append(op); });
      input.onchange = () => setParam(c.k, +input.value);
      row.append(input);
    } else {
      const slide = el('div', 'slider');
      const input = (r.input = el('input'));
      input.type = 'range';
      if (c.pow) { input.min = 0; input.max = 1; input.step = 0.001; }
      else { input.min = c.min; input.max = c.max; input.step = c.step; }
      input.oninput = () => setParam(c.k, c.pow ? fromShare(c, +input.value) : +input.value);
      input.ondblclick = () => setParam(c.k, DEFAULTS[c.k]);
      // a slider drag edits one keyframe, even while the clip plays on under it
      input.addEventListener('pointerdown', () => { r.sliding = true; });
      const release = () => { r.sliding = false; r.dragKey = null; };
      input.addEventListener('pointerup', release);
      input.addEventListener('change', release);
      r.mark = el('span', 'live-mark');
      r.mark.hidden = true;
      slide.append(input, r.mark);
      r.out = el('button', 'ctl-value');
      r.out.type = 'button';
      r.out.title = 'Click to type a value';
      r.out.onclick = () => typeValue(r);
      r.modBtn = el('button', 'mod-btn');
      r.modBtn.type = 'button';
      r.modBtn.setAttribute('aria-expanded', 'false');
      r.modBtn.onclick = () => openMod(c.k, r.modBtn);
      row.append(slide, r.out, r.modBtn);
    }
    r.input.id = id;
    label.ondblclick = () => setParam(c.k, DEFAULTS[c.k]);
    parent.append(row);
    rows.set(c.k, r);
  }

  function typeValue(r) {
    const c = r.c, field = el('input', 'ctl-edit');
    field.type = 'text';
    field.inputMode = 'decimal';
    field.value = shownValue(c.k).toFixed(decimals(c));
    field.setAttribute('aria-label', c.l);
    r.out.replaceWith(field);
    field.focus();
    field.select();
    let done = false;
    const finish = (keep) => {
      if (done) return;
      done = true;
      field.replaceWith(r.out);
      const n = parseFloat(field.value);
      if (keep && Number.isFinite(n)) setParam(c.k, clamp(n, c.min, c.max));
    };
    field.onkeydown = (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') finish(true);
      else if (e.key === 'Escape') finish(false);
    };
    field.onblur = () => finish(true);
  }

  // what the slider shows: the value at the playhead for keyframes, the centre for an LFO
  function shownValue(k) {
    const a = state.auto[k], c = BY_KEY[k];
    if (!a || c.opts || a.off || a.mode === 'lfo') return state.params[k];
    return Auto.valueOf(a, state.params[k], c, K.timeNow());
  }

  function paintRow(k) {
    const r = rows.get(k);
    if (!r) return;
    paintValue(r, r.sliding ? state.params[k] : shownValue(k));
    r.row.classList.toggle('changed', Math.abs(state.params[k] - DEFAULTS[k]) > 1e-6);
    if (!r.modBtn) return;
    const a = state.auto[k], mode = a ? a.mode : '';
    r.row.dataset.auto = mode;
    r.modBtn.replaceChildren(icon(mode === 'lfo' ? 'i-lfo' : mode === 'keys' ? 'i-key-on' : 'i-key'));
    r.modBtn.title = (mode === 'lfo' ? 'LFO on ' : mode === 'keys' ? 'Keyframes on ' : 'Automate ') + r.c.l.toLowerCase();
    r.modBtn.setAttribute('aria-label', r.modBtn.title);
    r.mark.hidden = mode !== 'lfo' || a.off;
  }
  function paintValue(r, v) {
    if (r.c.opts) { r.input.value = String(v); return; }
    r.input.value = r.c.pow ? share(r.c, v) : v;
    r.input.style.setProperty('--pct', share(r.c, v) * 100 + '%');
    r.out.textContent = fmtVal(r.c, v);
  }

  function setParam(k, v) {
    state.params[k] = v;
    const r = rows.get(k), a = state.auto[k];
    if (a && a.mode === 'keys' && r.modBtn) {
      const key = r.dragKey || upsertKey(k, v);
      key.v = v;
      if (r.sliding) r.dragKey = key;
      K.live[k] = v;
      K.emit('auto', k);
    } else if (a) {
      K.emit('auto', k);
    }
    paintRow(k);
    if (state.look) { state.look = null; paintLooks(); }
    paintModules();
    K.changed(BY_KEY[k].l);
  }

  // ------------------------------------------------------------ automation data
  const KEY_FPS = 30; // keyframes land on whole frames
  const EASE_IN_OUT = [0.42, 0, 0.58, 1];
  const copyEase = (e) => (e === 'hold' ? 'hold' : [...e]);
  // the timeline's snap setting, as a step in seconds
  K.snapStep = () => (ui.snap === 'off' ? 0 : ui.snap === 'frame' ? 1 / KEY_FPS : +ui.snap);
  K.snapT = (t) => { const s = K.snapStep(); return s ? Math.round(t / s) * s : t; };

  function upsertKey(k, v, t = K.timeNow()) {
    t = Math.round(K.snapT(t) * KEY_FPS * 100) / (KEY_FPS * 100);
    const keys = state.auto[k].keys;
    let key = keys.find((x) => Math.abs(x.t - t) < 0.5 / KEY_FPS);
    if (key) { key.v = v; return key; }
    const before = keys.filter((x) => x.t < t).pop();
    key = { t, v, ease: before ? copyEase(before.ease) : copyEase(EASE_IN_OUT) };
    keys.push(key);
    keys.sort((a, b) => a.t - b.t);
    return key;
  }

  K.automate = {
    upsertKey,
    copyEase,
    EASE_IN_OUT,
    // automate k with keyframes or an LFO, or switch between them; each keeps its own data
    setMode(k, mode) {
      let a = state.auto[k];
      if (!a) a = state.auto[k] = { mode, off: false, keys: [], lfo: null };
      a.mode = mode;
      if (mode === 'keys' && !a.keys.length) upsertKey(k, state.params[k]);
      if (mode === 'lfo' && !a.lfo) a.lfo = { ...Auto.LFO, seed: 1 + Math.floor(Math.random() * 9000) / 100 };
      delete K.live[k];
      this.refresh(k, BY_KEY[k].l + (mode === 'lfo' ? ': LFO' : ': keyframes'));
    },
    // stop automating k and keep the value it was showing
    remove(k) {
      const a = state.auto[k], c = BY_KEY[k];
      if (!a) return;
      if (a.mode === 'keys' && a.keys.length) state.params[k] = +shownValue(k).toFixed(decimals(c) + 1);
      delete state.auto[k];
      delete K.live[k];
      this.refresh(k, BY_KEY[k].l + ': automation off');
    },
    // after any change to an automated control: repaint it everywhere and record it
    refresh(k, label) {
      paintRow(k);
      paintModules();
      K.emit('auto', k);
      K.changed(label);
    },
    keysChanged(k, label) {
      K.emit('auto', k);
      paintRow(k);
      K.changed(label);
    },
  };

  // every frame: each automated slider follows the value it is rendering
  K.hooks.push(() => {
    for (const k in state.auto) {
      const r = rows.get(k), a = state.auto[k], live = K.live[k];
      if (!r || !r.modBtn || live === undefined) continue;
      if (a.mode === 'lfo') {
        r.mark.style.left = `calc(7px + (100% - 14px) * ${share(r.c, live)})`;
        r.out.textContent = fmtVal(r.c, live);
      } else if (!r.sliding && live !== r.shown) {
        paintValue(r, (r.shown = live));
      }
    }
    paintLfoDot();
  });

  // ------------------------------------------------------------ popovers
  const POP_TRIGGERS = () => document.querySelectorAll('[aria-expanded="true"]');
  K.closePops = () => {
    document.querySelectorAll('.pop').forEach((p) => { p.hidden = true; });
    POP_TRIGGERS().forEach((b) => b.setAttribute('aria-expanded', 'false'));
    popK = null;
  };
  // next to the thing that opened it, or as a sheet from the bottom on a phone
  K.placePop = (pop, anchor, side) => {
    const sheet = matchMedia('(max-width: 900px)').matches && !pop.classList.contains('tools-pop');
    pop.classList.toggle('as-sheet', sheet);
    if (sheet) { pop.style.left = ''; pop.style.top = ''; return; }
    const a = anchor.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight, m = 12;
    let x, y;
    if (side === 'below') {
      x = a.right - w; y = a.bottom + 8;
    } else if (side === 'above') {
      x = a.left; y = a.top - h - 8;
    } else {
      x = a.left - w - m;
      if (x < m) x = a.right + m;
      y = a.top - 20;
    }
    pop.style.left = clamp(x, m, innerWidth - w - m) + 'px';
    pop.style.top = clamp(y, m, innerHeight - h - m) + 'px';
  };
  document.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('.pop, [aria-expanded="true"]')) K.closePops();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') K.closePops(); });

  // ------------------------------------------------------------ the automation popover
  // Choose Off, Keyframes or LFO for one control. Keyframes are shaped in the timeline; the LFO is
  // shaped here, with the same kind of controls as Ableton's LFO and Serum's warp modes.
  const modPop = $('modPop');
  let popK = null, lfoRefs = null;

  const WAVE_PATHS = {
    sine: 'M2 7Q6-3 10 7T18 7T26 7',
    triangle: 'M2 7L6 2L14 12L22 2L26 7',
    ramp: 'M2 12L10 2V12L18 2V12L26 2',
    saw: 'M2 2L10 12V2L18 12V2L26 12',
    square: 'M2 12V2H9V12H16V2H23V12H26',
    random: 'M2 9H7V3H12V11H17V5H22V8H26',
    drift: 'M2 8C6 2 9 3 12 7S18 12 21 7S24 4 26 5',
    draw: 'M3 11C8 1 9 13 14 6S20 3 25 9',
  };

  function openMod(k, anchor) {
    const same = popK === k && !modPop.hidden;
    K.closePops();
    if (same) return;
    popK = k;
    modPop.hidden = false;
    renderMod();
    anchor.setAttribute('aria-expanded', 'true');
    K.placePop(modPop, anchor);
  }
  K.openMod = openMod;

  function renderMod() {
    const k = popK, c = BY_KEY[k], a = state.auto[k];
    lfoRefs = null;
    const head = el('div', 'pop-head');
    const pin = el('button', 'icon-btn');
    pin.type = 'button';
    pin.title = 'Pin this control to the top of Adjust';
    pin.setAttribute('aria-label', pin.title);
    pin.setAttribute('aria-pressed', String(ui.pinned.includes(k)));
    pin.append(icon('i-pin'));
    pin.onclick = () => { togglePin(k); pin.setAttribute('aria-pressed', String(ui.pinned.includes(k))); };
    const close = el('button', 'icon-btn');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close');
    close.append(icon('i-x'));
    close.onclick = K.closePops;
    head.append(el('h3', 'pop-title', c.l), pin, close);
    const segHost = el('div');
    K.segmented(segHost, [['off', 'Off'], ['keys', 'Keyframes'], ['lfo', 'LFO']], a ? a.mode : 'off', (v) => {
      if (v === 'off') K.automate.remove(k); else K.automate.setMode(k, v);
      if (v === 'keys') K.showTimeline();
      renderMod();
    });
    const parts = [head, segHost];
    if (!a) parts.push(el('p', 'hint', 'Keyframes draw a path along the timeline. An LFO keeps it moving on its own.'));
    else if (a.mode === 'lfo') parts.push(...lfoBody(k, a));
    else parts.push(...keysBody(k, a));
    modPop.replaceChildren(...parts);
  }

  function keysBody(k, a) {
    const n = a.keys.length;
    const row = el('div', 'pop-row');
    const btn = (name, title, fn) => {
      const b = el('button', 'icon-btn');
      b.type = 'button'; b.title = title;
      b.setAttribute('aria-label', title);
      b.append(icon(name));
      b.onclick = fn;
      return b;
    };
    const step = (dir) => {
      const t = K.timeNow();
      const key = dir < 0 ? a.keys.filter((x) => x.t < t - 1e-3).pop() : a.keys.find((x) => x.t > t + 1e-3);
      if (key) { K.seek(key.t); K.emit('select', { k, key }); }
    };
    row.append(
      el('span', 'grow', n + (n === 1 ? ' keyframe' : ' keyframes')),
      btn('i-prev', 'Previous keyframe', () => step(-1)),
      btn('i-key-on', 'Add a keyframe at the playhead', () => {
        const key = upsertKey(k, shownValue(k));
        K.emit('select', { k, key });
        K.automate.keysChanged(k, BY_KEY[k].l + ': keyframe');
        renderMod();
      }),
      btn('i-next', 'Next keyframe', () => step(1)),
    );
    const open = el('button', 'btn btn-secondary btn-xs', 'Edit in Timeline');
    open.type = 'button';
    open.onclick = () => { K.showTimeline(); K.emit('activate', k); K.closePops(); };
    return [row, el('p', 'hint', 'Move the playhead and set the slider to key a value. Timing and curves live in the timeline.'), open];
  }

  function lfoBody(k, a) {
    const l = a.lfo, c = BY_KEY[k];
    const touched = () => { paintLfoView(); K.emit('auto', k); K.changed(c.l + ': LFO'); };

    const view = el('div', 'lfo-view' + (l.wave === 'draw' ? ' drawing' : ''));
    const NS = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(NS, 'svg');
    g.setAttribute('viewBox', '0 0 100 100');
    g.setAttribute('preserveAspectRatio', 'none');
    const mid = document.createElementNS(NS, 'path');
    mid.setAttribute('class', 'mid');
    mid.setAttribute('d', 'M0 50H100');
    const wave = document.createElementNS(NS, 'path');
    wave.setAttribute('class', 'wave');
    g.append(mid, wave);
    const dot = el('span', 'lfo-dot');
    view.append(g, dot);
    lfoRefs = { k, l, wave, dot, cycle: null };
    if (l.wave === 'draw') enableDrawing(view, l, touched);

    const chips = el('div', 'wave-grid');
    Auto.WAVES.forEach(([w, name]) => {
      const b = el('button', 'wave-chip');
      b.type = 'button';
      b.setAttribute('aria-pressed', String(l.wave === w));
      const s = document.createElementNS(NS, 'svg');
      s.setAttribute('viewBox', '0 0 28 14');
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', WAVE_PATHS[w]);
      s.append(p);
      b.append(s, el('span', '', name));
      b.onclick = () => {
        l.wave = w;
        if (w === 'draw' && !l.table) l.table = Auto.newTable();
        renderMod();
        touched();
      };
      chips.append(b);
    });

    // rate runs 0.02 to 20 Hz on a log scale
    const toHz = (x) => 0.02 * Math.pow(1000, x);
    const fromHz = (hz) => Math.log(hz / 0.02) / Math.log(1000);
    const row = (label, prop, min, max, step, fmt, to = (x) => x, from = (x) => x, tip = '') => {
      const line = el('div', 'ctl');
      const name = el('label', '', label);
      name.title = tip;
      const input = el('input');
      input.type = 'range'; input.min = min; input.max = max; input.step = step;
      input.setAttribute('aria-label', label);
      const out = el('output');
      const paint = () => {
        input.value = from(l[prop]);
        input.style.setProperty('--pct', ((from(l[prop]) - min) / (max - min)) * 100 + '%');
        out.textContent = fmt(l[prop]);
      };
      input.oninput = () => { l[prop] = to(+input.value); paint(); touched(); };
      input.ondblclick = () => { l[prop] = Auto.LFO[prop]; paint(); touched(); };
      paint();
      line.append(name, input, out);
      return line;
    };
    const pc = (v) => Math.round(v * 100) + '%';
    const motion = el('div', 'pop-group');
    motion.append(
      row('Rate', 'rate', 0, 1, 0.001, (v) => (v < 1 ? v.toFixed(2) : v.toFixed(1)) + ' Hz', toHz, fromHz, 'Cycles per second. Random takes one step per cycle.'),
      row('Depth', 'depth', 0, 1, 0.01, pc, undefined, undefined, 'How far it swings around the slider, as a share of the range'),
      row('Offset', 'offset', -1, 1, 0.01, pc, undefined, undefined, 'Moves the centre of the swing'),
    );
    const shape = el('div', 'pop-group');
    shape.append(
      row('Smooth', 'smooth', 0, 1, 0.01, pc, undefined, undefined, 'Glides between random steps, or rounds the corners of the other shapes'),
      row('Jitter', 'jitter', 0, 1, 0.01, pc, undefined, undefined, 'Drifts the timing so it never quite repeats'),
      row('Bend', 'bend', -1, 1, 0.01, (v) => v.toFixed(2), undefined, undefined, 'Leans the shape toward the start or the end of the cycle'),
      row('Symmetry', 'sym', 0.02, 0.98, 0.01, pc, undefined, undefined, 'Moves the midpoint of the cycle: the pulse width of a square'),
      row('Phase', 'phase', 0, 1, 0.01, (v) => Math.round(v * 360) + '°', undefined, undefined, 'Where in the cycle it starts'),
      row('Steps', 'steps', 0, 16, 1, (v) => (v < 2 ? 'Off' : String(v)), undefined, undefined, 'Quantizes the output to this many levels'),
    );
    const parts = [view, chips, motion, shape];
    if (l.wave === 'random' || l.wave === 'drift') {
      const dice = el('button', 'btn btn-secondary btn-xs');
      dice.type = 'button';
      dice.append(icon('i-dice'), 'New Pattern');
      dice.onclick = () => { l.seed = 1 + Math.floor(Math.random() * 9000) / 100; lfoRefs.cycle = null; touched(); };
      parts.push(dice);
    }
    paintLfoView();
    return parts;
  }

  // one cycle drawn by hand: drag across the view
  function enableDrawing(view, l, touched) {
    let last = -1;
    const paint = (e) => {
      const b = view.getBoundingClientRect(), n = l.table.length;
      const i = clamp(Math.floor(((e.clientX - b.left) / b.width) * n), 0, n - 1);
      const y = clamp(1 - ((e.clientY - b.top) / b.height) * 2, -1, 1);
      const from = last < 0 ? i : last;
      for (let j = Math.min(from, i); j <= Math.max(from, i); j++) l.table[j] = y;
      last = i;
      touched();
    };
    view.onpointerdown = (e) => {
      view.setPointerCapture(e.pointerId);
      last = -1;
      paint(e);
      view.onpointermove = paint;
      view.onpointerup = view.onpointercancel = () => { view.onpointermove = null; };
    };
  }

  const lfoWindow = (l) => (l.wave === 'draw' ? 1 : 2) / l.rate;
  function paintLfoView() {
    if (!lfoRefs) return;
    const { l, wave } = lfoRefs, span = lfoWindow(l);
    const t0 = Math.floor(K.timeNow() / span) * span - l.phase / l.rate;
    let d = '';
    for (let i = 0; i <= 200; i++) {
      const y = Auto.lfoAt(l, t0 + (i / 200) * span);
      d += (i ? 'L' : 'M') + (i / 2).toFixed(1) + ' ' + (50 - y * 42).toFixed(2);
    }
    wave.setAttribute('d', d);
    lfoRefs.cycle = t0;
  }
  function paintLfoDot() {
    if (!lfoRefs || modPop.hidden) return;
    const { l, dot } = lfoRefs, span = lfoWindow(l), t = K.timeNow();
    const t0 = Math.floor(t / span) * span - l.phase / l.rate;
    if (t0 !== lfoRefs.cycle) paintLfoView();
    const x = ((t - t0) / span) % 1;
    dot.style.left = x * 100 + '%';
    dot.style.top = 50 - Auto.lfoAt(l, t) * 42 + '%';
  }

  // ------------------------------------------------------------ quick + master + modules
  const quickRows = el('div', 'ctls'), masterRows = el('div', 'ctls');
  $('quickSec').append(quickRows);
  $('masterSec').append(masterRows);
  buildControl(MASTER[0], quickRows, 'Quick');
  MACROS.forEach((m) => buildControl(m, quickRows, 'Quick macro'));
  MASTER.slice(1).forEach((c) => buildControl(c, masterRows, 'Master'));

  const mods = new Map();
  GROUPS.forEach((g) => {
    const d = el('details', 'mod');
    d.open = (ui.modOpen || []).includes(g.id);
    const s = el('summary');
    const power = el('button', 'switch');
    power.type = 'button';
    power.setAttribute('role', 'switch');
    power.title = 'Switch ' + g.title + ' on or off';
    power.setAttribute('aria-label', power.title);
    power.onclick = (e) => {
      e.preventDefault(); e.stopPropagation();
      state.enabled[g.id] = !state.enabled[g.id];
      paintModules();
      K.changed(g.title + (state.enabled[g.id] ? ' on' : ' off'));
    };
    const reset = el('button', 'icon-btn mod-reset');
    reset.type = 'button';
    reset.title = 'Return ' + g.title + ' to its defaults';
    reset.setAttribute('aria-label', reset.title);
    reset.append(icon('i-reset'));
    reset.onclick = (e) => {
      e.preventDefault(); e.stopPropagation();
      g.controls.forEach((c) => { state.params[c.k] = DEFAULTS[c.k]; delete state.auto[c.k]; paintRow(c.k); });
      state.look = null;
      paintLooks(); paintModules();
      K.emit('auto');
      K.changed('Reset ' + g.title);
    };
    const dot = el('span', 'mod-dot');
    s.append(icon('i-chevron', 'mod-chev'), el('span', 'mod-title', g.title), dot, el('span', 'mod-spacer'), reset, power);
    const body = el('div', 'mod-body');
    body.append(el('p', 'hint', g.hint));
    g.controls.forEach((c) => buildControl(c, body, g.title));
    d.append(s, body);
    d.addEventListener('toggle', () => {
      if (searching) return;
      ui.modOpen = [...mods.values()].filter((m) => m.d.open).map((m) => m.g.id);
      K.saveUi();
    });
    $('modules').append(d);
    mods.set(g.id, { g, d, power, dot });
  });

  function paintModules() {
    for (const { g, d, power, dot } of mods.values()) {
      const on = state.enabled[g.id];
      d.classList.toggle('off', !on);
      power.setAttribute('aria-checked', String(on));
      dot.hidden = !g.controls.some((c) => state.auto[c.k]);
    }
  }
  const paintAll = () => { rows.forEach((_, k) => paintRow(k)); paintModules(); paintLooks(); K.emit('auto'); };

  // the module order, hidden modules and pinned controls from Settings
  K.modules = () => GROUPS.map((g) => ({ id: g.id, title: g.title }));
  K.layoutModules = () => {
    const ids = GROUPS.map((g) => g.id);
    // a module added since the order was saved goes where it belongs, after the one it follows
    const order = ui.modOrder.filter((id) => mods.has(id));
    ids.forEach((id, i) => { if (!order.includes(id)) order.splice(i ? order.indexOf(ids[i - 1]) + 1 : 0, 0, id); });
    ui.modOrder = order;
    order.forEach((id) => {
      const m = mods.get(id);
      $('modules').append(m.d);
      m.hideByUser = ui.modHidden.includes(id);
      m.d.hidden = m.hideByUser;
    });
    rows.forEach((r, k) => { if (!ui.pinned.includes(k)) r.home.append(r.row); });
    ui.pinned.forEach((k) => { const r = rows.get(k); if (r) $('pinned').append(r.row); });
    $('pinnedSec').hidden = !ui.pinned.length;
  };
  function togglePin(k) {
    ui.pinned = ui.pinned.includes(k) ? ui.pinned.filter((x) => x !== k) : [...ui.pinned, k];
    K.saveUi();
    K.layoutModules();
  }

  // search
  let searching = false, openBefore = [];
  $('paramSearch').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    if (q && !searching) openBefore = [...mods.values()].filter((m) => m.d.open);
    searching = !!q;
    let total = 0;
    rows.forEach((r) => {
      if (r.home === quickRows) return;
      const hit = !q || r.search.includes(q);
      r.row.hidden = !hit;
      if (hit) total++;
    });
    for (const m of mods.values()) {
      const hits = m.g.controls.some((c) => !rows.get(c.k).row.hidden && !ui.pinned.includes(c.k));
      m.d.hidden = m.hideByUser || (q && !hits);
      m.d.open = q ? hits : openBefore.includes(m);
      m.d.querySelector('.hint').hidden = !!q;
    }
    $('masterSec').hidden = !!q && !MASTER.slice(1).some((c) => !rows.get(c.k).row.hidden);
    $('searchNone').hidden = !q || total > 0;
  });

  // ------------------------------------------------------------ render settings
  const setQuality = K.segmented($('quality'), ['LO', 'SD', 'HI', '480i', 'FULL'].map((q) => [q, q]), 'SD', (q) => {
    K.setQuality(q);
    store('atlas.quality', q);
  }, 'sm');
  $('outSize').onchange = (e) => { K.setOut(e.target.value); store('atlas.out', e.target.value); };

  // ------------------------------------------------------------ saved looks
  // Looks live in this browser's storage, which belongs to one exact web address: move the site to
  // another address, or from http to https, and the browser files them apart. So they are also
  // copied to a second store and a rolling backup, the browser is asked to keep them, and Export
  // writes them to a file that doesn't depend on any of this. Never rename the 'atlas.looks' key.
  const LOOKS = 'atlas.looks', BACKUP = 'atlas.looks.backup';
  const mine = () => { const l = store(LOOKS); return Array.isArray(l) ? l : []; };

  const idb = (fn) => new Promise((res, rej) => {
    const open = indexedDB.open('atlas', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('kv');
    open.onerror = () => rej(open.error);
    open.onsuccess = () => {
      const db = open.result, tx = db.transaction('kv', 'readwrite'), req = fn(tx.objectStore('kv'));
      tx.oncomplete = () => { db.close(); res(req.result); };
      tx.onerror = () => { db.close(); rej(tx.error); };
    };
  });
  const mirror = (list) => idb((s) => s.put(list, 'looks')).catch(() => {});

  function saveMine(list) {
    const before = mine();
    if (before.length) store(BACKUP, { when: Date.now(), looks: before });
    store(LOOKS, list);
    mirror(list);
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  }
  // a browser that lost the main copy may still have a mirror; an empty list means they were deleted on purpose
  async function recoverLooks() {
    let missing = false;
    try { missing = localStorage.getItem(LOOKS) === null; } catch (e) { return; }
    if (!missing) { mirror(mine()); return; }
    const fromDb = await idb((s) => s.get('looks')).catch(() => null);
    const bak = store(BACKUP);
    const list = fromDb && fromDb.length ? fromDb : (bak && bak.looks) || [];
    if (!list.length) return;
    store(LOOKS, list);
    paintLooks();
    toast('Recovered ' + list.length + ' saved looks from this browser\'s backup.');
  }

  function keyframed(auto) {
    const out = {};
    for (const k in auto || {}) {
      const a = BY_KEY[k] && !BY_KEY[k].opts ? Auto.normalize(auto[k]) : null;
      if (a) out[k] = a;
    }
    return out;
  }
  const lookFile = (list) => new Blob([JSON.stringify({ app: 'atlas-crt', type: 'looks', version: 1, exported: new Date().toISOString(), looks: list }, null, 2)], { type: 'application/json' });
  const today = () => new Date().toISOString().slice(0, 10);

  function cleanLook(raw) {
    if (!raw || typeof raw.name !== 'string' || !raw.p || typeof raw.p !== 'object') return null;
    const p = {};
    for (const k in raw.p) if (k in DEFAULTS && Number.isFinite(raw.p[k])) p[k] = raw.p[k];
    const enabled = {};
    GROUPS.forEach((g) => { enabled[g.id] = !(raw.enabled && raw.enabled[g.id] === false); });
    const look = { name: raw.name.trim().slice(0, 40) || 'Imported look', p, enabled, auto: keyframed(raw.auto) };
    if (Number.isFinite(raw.length) && raw.length > 0) look.length = raw.length;
    return look;
  }
  // a preset saved by the ntsc-rs app, as a look: the tape on its own, with the tube out of the way
  function presetLook(preset, fileName) {
    const init = PRESETS.find((p) => p.name === 'Init').p;
    return { name: fileName.replace(/\.json$/i, ''), p: { ...init, ...window.AtlasPreset.fromPreset(preset), vhs: 1 } };
  }
  async function importLooks(file) {
    let data;
    try { data = JSON.parse(await file.text()); } catch (e) { toast('That file isn\'t a looks file.'); return; }
    const incoming = (window.AtlasPreset.isPreset(data) ? [presetLook(data, file.name)]
      : Array.isArray(data) ? data : Array.isArray(data.looks) ? data.looks : [data]).map(cleanLook).filter(Boolean);
    if (!incoming.length) { toast('No looks found in that file.'); return; }
    const list = mine();
    let added = 0;
    const same = (a, b) => JSON.stringify([a.p, a.auto]) === JSON.stringify([b.p, b.auto]);
    incoming.forEach((look) => {
      if (list.some((m) => m.name === look.name && same(m, look))) return;
      let name = look.name;
      for (let n = 2; list.some((m) => m.name === name); n++) name = look.name + ' ' + n;
      list.push({ ...look, name });
      added++;
    });
    saveMine(list);
    cat = 'Mine';
    paintLooks();
    toast(added ? 'Imported ' + added + (added === 1 ? ' look.' : ' looks.') : 'You already have those looks.');
  }

  let cat = CATS[0] || 'Mine';
  [...CATS, 'Mine'].forEach((name) => {
    const b = el('button', 'chip', name);
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
    if (look.length) state.length = look.length;
    K.live = {};
    state.look = look.name;
    K.closePops();
    paintAll();
    K.changed(look.name ? 'Look: ' + look.name : 'Reset');
  }
  K.applyLook = applyLook;

  // undo and redo land here
  K.restoreState = (s) => {
    state.params = { ...DEFAULTS, ...s.params };
    state.enabled = s.enabled;
    state.auto = keyframed(s.auto);
    state.look = s.look;
    state.length = s.length;
    K.live = {};
    K.closePops();
    paintAll();
    persist();
  };

  function paintLooks() {
    [...$('catTabs').children].forEach((b) => b.setAttribute('aria-selected', String(b.dataset.cat === cat)));
    const grid = $('presetGrid'), isMine = cat === 'Mine';
    const list = isMine ? mine() : PRESETS.filter((p) => p.cat === cat);
    grid.replaceChildren();
    $('mineTools').hidden = !isMine;
    $('exportLooks').disabled = !list.length;
    $('mineNote').textContent = 'Saved in this browser. Export a file to keep them anywhere, then Import to bring them back.';
    if (!list.length) grid.append(el('p', 'empty-note', 'Looks you save appear here, with their settings and automation.'));
    list.forEach((look) => {
      const b = el('button', 'look');
      b.type = 'button';
      b.setAttribute('aria-pressed', String(state.look === look.name));
      b.append(el('span', '', look.name));
      if (look.auto && Object.keys(look.auto).length) {
        const mark = icon('i-lfo', 'auto-mark');
        mark.setAttribute('aria-hidden', 'false');
        b.append(mark);
      }
      b.onclick = () => applyLook(look);
      if (isMine) {
        const acts = el('span', 'look-acts');
        const act = (name, title, fn) => {
          const x = el('span', 'look-act');
          x.title = title;
          x.setAttribute('role', 'button');
          x.setAttribute('aria-label', title);
          x.append(icon(name));
          x.onclick = (e) => { e.stopPropagation(); fn(); };
          return x;
        };
        acts.append(
          act('i-download', 'Export this look', () => K.saveFile(lookFile([look]), look.name.replace(/[^\w\- ]+/g, '').trim() + '.json')),
          act('i-trash', 'Delete this look', () => {
            const list = mine();
            saveMine(list.filter((m) => m.name !== look.name));
            paintLooks();
            toast('Deleted "' + look.name + '"', { label: 'Undo', run: () => { saveMine(list); paintLooks(); } });
          }),
        );
        b.append(acts);
      }
      grid.append(b);
    });
  }

  $('saveForm').onsubmit = (e) => {
    e.preventDefault();
    const name = $('presetName').value.trim();
    if (!name) { $('presetName').focus(); toast('Type a name for the look first.'); return; }
    const list = mine().filter((m) => m.name !== name);
    list.push({ name, p: { ...state.params }, enabled: { ...state.enabled }, auto: JSON.parse(JSON.stringify(state.auto)), length: state.length });
    saveMine(list);
    if (!mine().some((m) => m.name === name)) { toast('This browser blocked saving, so looks cannot be kept here.'); return; }
    $('presetName').value = '';
    state.look = name; cat = 'Mine';
    paintLooks();
    toast('Saved "' + name + '"');
  };
  $('exportLooks').onclick = () => K.saveFile(lookFile(mine()), 'atlas-looks-' + today() + '.json');
  $('importLooks').title = 'Atlas looks, or presets saved by the ntsc-rs app';
  $('importLooks').onclick = () => $('looksFile').click();
  $('looksFile').onchange = (e) => { if (e.target.files[0]) importLooks(e.target.files[0]); e.target.value = ''; };
  K.looksIO = { exportAll: () => $('exportLooks').click(), importFile: () => $('looksFile').click() };

  $('randomBtn').onclick = () => {
    const p = { ...DEFAULTS };
    GROUPS.forEach((g) => g.controls.forEach((c) => {
      if (c.opts) { if (Math.random() < 0.2) p[c.k] = c.opts[Math.floor(Math.random() * c.opts.length)].v; return; }
      if (c.tape || (c.n !== undefined && Math.random() > 0.25)) return;
      const span = c.max - c.min;
      const v = c.n !== undefined ? c.min + span * Math.pow(Math.random(), 1.8) : c.min + span * Math.random();
      p[c.k] = Math.round(v / c.step) * c.step;
    }));
    ['capture', 'invert', 'solar', 'mosh', 'vhs'].forEach((k) => { if (Math.random() > 0.2) p[k] = DEFAULTS[k]; });
    p.tint = 0;
    applyLook({ name: null, p });
  };
  $('resetBtn').onclick = () => applyLook({ name: null, p: {} });

  // ------------------------------------------------------------ this browser's session
  function persist() {
    clearTimeout(persist.t);
    persist.t = setTimeout(() => store('atlas.session.v3', {
      params: state.params, enabled: state.enabled, look: state.look, auto: state.auto, length: state.length,
    }), 300);
  }
  const saved = store('atlas.session.v3');
  if (saved && saved.params) {
    state.params = { ...DEFAULTS, ...saved.params };
    Object.assign(state.enabled, saved.enabled || {});
    state.auto = keyframed(saved.auto);
    state.look = saved.look || null;
    if (saved.length) state.length = saved.length;
  } else {
    applyLook(PRESETS.find((p) => p.name === 'Init') || { name: null, p: {} });
  }
  // open the looks tab on the active look's category
  const cur = PRESETS.find((p) => p.name === state.look);
  if (cur) cat = cur.cat;
  const q = store('atlas.quality');
  if (q) { setQuality(q); K.setQuality(q); }
  const o = store('atlas.out');
  if (o) { $('outSize').value = o; K.setOut(o); }
  const pane = store('atlas.pane') === 'adjust' ? 'adjust' : 'looks';
  setPane(pane);
  showPane(pane);
  K.layoutModules();
  paintAll();
  recoverLooks();
  K.history.reset();
})();
