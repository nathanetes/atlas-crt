// Atlas CRT control rack: the looks and adjust tabs, quick macros, every module's
// controls, per-slider automation, saved looks and this browser's session.
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
  // rate slider position (0..1) <-> Hz, 0.02 Hz to 10 Hz on a log scale
  const toHz = (x) => 0.02 * Math.pow(500, x);
  const fromHz = (hz) => Math.log(hz / 0.02) / Math.log(500);

  function buildControl(c, parent) {
    const row = el('div', 'ctl');
    const id = 'c_' + c.k;
    const label = el('label', '', c.l);
    label.htmlFor = id;
    label.title = c.u && c.u.length >= 4 ? c.u + ' · double-click to reset' : 'Double-click to reset';
    const out = el('output');
    out.htmlFor = id;
    row.append(label, out);
    let input, autoBtn = null, panel = null, mark = null;
    if (c.opts) {
      input = el('select');
      c.opts.forEach((o) => { const op = el('option', '', o.l); op.value = String(o.v); input.append(op); });
      input.onchange = () => setParam(c.k, +input.value);
      row.append(input);
    } else {
      autoBtn = el('button', 'auto-btn', '~');
      autoBtn.type = 'button';
      autoBtn.title = 'Automate ' + c.l.toLowerCase();
      autoBtn.setAttribute('aria-pressed', 'false');
      autoBtn.onclick = () => toggleAuto(c.k);
      row.append(autoBtn);
      const track = el('div', 'track');
      input = el('input');
      input.type = 'range';
      input.min = c.min; input.max = c.max; input.step = c.step;
      input.oninput = () => setParam(c.k, +input.value);
      input.ondblclick = () => setParam(c.k, DEFAULTS[c.k]);
      mark = el('span', 'modmark');
      mark.hidden = true;
      track.append(input, mark);
      row.append(track);
      panel = buildAutoPanel(c);
      row.append(panel.box);
    }
    input.id = id;
    label.ondblclick = () => setParam(c.k, DEFAULTS[c.k]);
    parent.append(row);
    rows.set(c.k, { c, row, input, out, autoBtn, panel, mark });
  }

  function buildAutoPanel(c) {
    const box = el('div', 'auto-panel');
    box.hidden = true;
    const shape = el('select');
    shape.setAttribute('aria-label', c.l + ' automation shape');
    K.WAVES.forEach((w) => { const o = el('option', '', w); o.value = w; shape.append(o); });
    shape.onchange = () => updateAuto(c.k, { shape: shape.value });
    const rate = el('input'); rate.type = 'range'; rate.min = 0; rate.max = 1; rate.step = 0.001;
    rate.setAttribute('aria-label', c.l + ' automation rate');
    rate.oninput = () => updateAuto(c.k, { rate: toHz(+rate.value) });
    const depth = el('input'); depth.type = 'range'; depth.min = 0; depth.max = 1; depth.step = 0.01;
    depth.setAttribute('aria-label', c.l + ' automation depth');
    depth.oninput = () => updateAuto(c.k, { depth: +depth.value });
    const rateOut = el('output'), depthOut = el('output');
    const r1 = el('div', 'auto-row'); r1.append(el('span', 'dim', 'shape'), shape);
    const r2 = el('div', 'auto-row'); r2.append(el('span', 'dim', 'rate'), rate, rateOut);
    const r3 = el('div', 'auto-row'); r3.append(el('span', 'dim', 'depth'), depth, depthOut);
    box.append(r1, r2, r3);
    return { box, shape, rate, depth, rateOut, depthOut };
  }

  function paintRow(k) {
    const r = rows.get(k);
    if (!r) return;
    const v = state.params[k];
    if (r.c.opts) r.input.value = String(v);
    else { r.input.value = v; r.input.style.setProperty('--pct', pct(r.c, v)); }
    r.out.textContent = fmtVal(r.c, v);
    r.row.classList.toggle('changed', Math.abs(v - DEFAULTS[k]) > 1e-6);
    if (!r.panel) return;
    const a = state.auto[k];
    r.autoBtn.setAttribute('aria-pressed', String(!!a));
    r.panel.box.hidden = !a;
    r.mark.hidden = !a;
    r.row.classList.toggle('automated', !!a);
    if (a) {
      r.panel.shape.value = a.shape;
      r.panel.rate.value = fromHz(a.rate);
      r.panel.rate.style.setProperty('--pct', fromHz(a.rate) * 100 + '%');
      r.panel.rateOut.textContent = (a.rate < 1 ? a.rate.toFixed(2) : a.rate.toFixed(1)) + ' Hz';
      r.panel.depth.value = a.depth;
      r.panel.depth.style.setProperty('--pct', a.depth * 100 + '%');
      r.panel.depthOut.textContent = Math.round(a.depth * 100) + '%';
    }
  }

  function setParam(k, v) {
    state.params[k] = v;
    paintRow(k);
    if (state.look) { state.look = null; paintLooks(); }
    paintModules();
    persist();
  }

  // ------------------------------------------------------------ automation
  function toggleAuto(k) {
    if (state.auto[k]) delete state.auto[k];
    else state.auto[k] = { shape: 'sine', rate: 0.25, depth: 0.3, phase: Math.random(), seed: Math.random() * 100 };
    delete K.live[k];
    paintRow(k); paintAutoList(); persist();
  }
  function updateAuto(k, patch) {
    Object.assign(state.auto[k], patch);
    paintRow(k); paintAutoList(); persist();
  }
  function paintAutoList() {
    const list = $('autoList');
    list.innerHTML = '';
    const keys = Object.keys(state.auto).filter((k) => BY_KEY[k]);
    $('autoEmpty').hidden = keys.length > 0;
    $('tab-adjust').textContent = keys.length ? `adjust ~${keys.length}` : 'adjust';
    keys.forEach((k) => {
      const a = state.auto[k];
      const li = el('li');
      li.append(el('span', '', BY_KEY[k].l.toLowerCase()), el('span', 'dim', ` ${a.shape} ${a.rate < 1 ? a.rate.toFixed(2) : a.rate.toFixed(1)} Hz`));
      const x = el('button', 'mini', 'stop');
      x.type = 'button';
      x.title = 'Stop automating ' + BY_KEY[k].l.toLowerCase();
      x.onclick = () => toggleAuto(k);
      li.append(x);
      list.append(li);
    });
  }
  // move each automated slider's marker to the value it is rendering right now
  K.hooks.push(() => {
    for (const k in state.auto) {
      const r = rows.get(k);
      if (!r || !r.mark || K.live[k] === undefined) continue;
      r.mark.style.left = pct(r.c, K.live[k]);
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
  let cat = 'Terminal';
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
    state.auto = JSON.parse(JSON.stringify(look.auto || {}));
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
    state.auto = saved.auto || {};
    state.look = saved.look || null;
    const cur = PRESETS.find((p) => p.name === state.look);
    if (cur) cat = cur.cat;
  } else {
    applyLook(PRESETS.find((p) => p.name === 'Init') || { name: null, p: {} });
  const q = store('atlas.quality');
  if (q) document.querySelector(`#quality button[data-q="${q}"]`)?.click();
  const o = store('atlas.out');
  if (o) { $('outSize').value = o; K.setOut(o); }
  showPane(store('atlas.pane') === 'adjust' ? 'adjust' : 'looks');
  paintAll();
})();
