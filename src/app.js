// Atlas CRT app: media loading, render loop, transport, control rack, looks.
(function () {
  const { MASTER, GROUPS, DEFAULTS, PRESETS } = window.AtlasParams;
  const $ = (id) => document.getElementById(id);
  const canvas = $('out');
  const K = (window.Atlas = {});

  let engine;
  try {
    engine = new window.AtlasEngine(canvas);
  } catch (err) {
    $('app').innerHTML = '<div class="fatal"><h2>ATLAS CRT NEEDS WEBGL2</h2><p>' +
      'This browser could not start the GPU renderer. Open the page in a current Chrome, Edge, Safari or Firefox.</p>' +
      '<p style="color:var(--muted);font-family:var(--font-mono);font-size:12px"></p></div>';
    $('app').querySelector('p:last-child').textContent = String(err.message || err).slice(0, 400);
    return;
  }
  K.engine = engine;

  const state = (K.state = {
    params: { ...DEFAULTS },
    enabled: Object.fromEntries(GROUPS.map((g) => [g.id, true])),
    look: null,
    quality: 'SD',
    out: '1080',
    split: 0.5,
    compare: false,
    playing: true,
  });

  // ------------------------------------------------------------ helpers
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { t.hidden = true; }, 3200);
  }
  K.toast = toast;

  const fmtTime = (s) => {
    s = Math.max(0, s || 0);
    return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  };

  function store(key, val) {
    try {
      if (val === undefined) return JSON.parse(localStorage.getItem(key) || 'null');
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) { return null; }
  }

  K.effective = function () {
    const p = { ...state.params };
    const dirt = 1 - p.clean;
    for (const g of GROUPS) {
      for (const c of g.controls) {
        if (!state.enabled[g.id] && c.n !== undefined) p[c.k] = c.n;
        else if (c.dirt) p[c.k] *= dirt;
      }
    }
    delete p.clean;
    return p;
  };

  // ------------------------------------------------------------ sources
  const src = (K.src = { kind: null, el: null, name: 'atlas', w: 0, h: 0, url: null, audio: null });
  let actx = null;

  function testCard() {
    const c = document.createElement('canvas');
    c.width = 1280; c.height = 720;
    const g = c.getContext('2d');
    const bars = ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0'];
    const rev = ['#0000c0', '#131313', '#c000c0', '#131313', '#00c0c0', '#131313', '#c0c0c0'];
    c.draw = (t) => {
      const W = 1280, H = 720, bw = W / 7;
      bars.forEach((b, i) => { g.fillStyle = b; g.fillRect(i * bw, 0, bw + 1, H * 0.62); });
      rev.forEach((b, i) => { g.fillStyle = b; g.fillRect(i * bw, H * 0.62, bw + 1, H * 0.08); });
      const ramp = g.createLinearGradient(0, 0, W, 0);
      ramp.addColorStop(0, '#000'); ramp.addColorStop(1, '#fff');
      g.fillStyle = ramp; g.fillRect(0, H * 0.7, W * 0.62, H * 0.3);
      g.fillStyle = '#ffffff'; g.fillRect(W * 0.62, H * 0.7, W * 0.13, H * 0.3);
      g.fillStyle = '#000'; g.fillRect(W * 0.75, H * 0.7, W * 0.25, H * 0.3);
      // fine verticals to show bleed and the mask
      g.fillStyle = '#fff';
      for (let x = 0; x < 80; x += 4) g.fillRect(W * 0.8 + x * 2, H * 0.74, 2, H * 0.12);
      // moving ball for persistence and shake
      const bx = W / 2 + Math.sin(t * 1.3) * W * 0.34, by = H * 0.34 + Math.cos(t * 2.1) * H * 0.12;
      g.beginPath(); g.arc(bx, by, 34, 0, Math.PI * 2);
      g.fillStyle = '#fff6e0'; g.fill();
      // title plate
      g.fillStyle = 'rgba(0,0,0,0.78)'; g.fillRect(W * 0.28, H * 0.42, W * 0.44, H * 0.17);
      g.fillStyle = '#ffffff';
      g.font = '96px "VT323", "Courier New", monospace';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('ATLAS CRT', W / 2, H * 0.48);
      g.font = '34px "VT323", "Courier New", monospace';
      const f = Math.floor(t * 30);
      const tc = [Math.floor(f / 108000), Math.floor(f / 1800) % 60, Math.floor(f / 30) % 60, f % 30].map((n) => String(n).padStart(2, '0')).join(':');
      g.fillStyle = '#3dff72'; g.fillText(tc, W / 2, H * 0.555);
    };
    c.draw(0);
    return c;
  }

  function releaseSource() {
    if (src.kind === 'video') { src.el.pause(); src.el.removeAttribute('src'); src.el.load(); }
    if (src.url) URL.revokeObjectURL(src.url);
    src.url = null; src.audio = null;
  }

  function useSource(kind, el, w, h, name) {
    Object.assign(src, { kind, el, w, h, name });
    engine.setSource(el, w, h, kind !== 'image');
    applyOutput();
    state.playing = true;
    syncTransport();
    updateBadge();
  }

  function loadSample() {
    releaseSource();
    useSource('sample', testCard(), 1280, 720, 'test-card');
  }

  function loadImage(file) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      releaseSource();
      src.url = url;
      let el = img, w = img.naturalWidth, h = img.naturalHeight;
      const cap = Math.min(4096, engine.maxTex);
      if (Math.max(w, h) > cap) {
        const s = cap / Math.max(w, h);
        el = document.createElement('canvas');
        el.width = Math.round(w * s); el.height = Math.round(h * s);
        el.getContext('2d').drawImage(img, 0, 0, el.width, el.height);
        w = el.width; h = el.height;
      }
      useSource('image', el, w, h, baseName(file.name));
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast('That image could not be opened. Try a JPG, PNG or WebP.'); };
    img.src = url;
  }

  function loadVideo(file) {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.playsInline = true; v.loop = true; v.preload = 'auto';
    v.onloadedmetadata = () => {
      releaseSource();
      src.url = url;
      src.audio = audioFor(v);
      useSource('video', v, v.videoWidth, v.videoHeight, baseName(file.name));
      v.play().catch(() => { state.playing = false; syncTransport(); });
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      toast('This browser cannot decode that video. Try an MP4 (H.264) or WebM file.');
    };
    v.src = url;
  }

  function audioFor(video) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const node = actx.createMediaElementSource(video);
      const gain = actx.createGain();
      const dest = actx.createMediaStreamDestination();
      node.connect(gain).connect(actx.destination);
      node.connect(dest);
      gain.gain.value = $('muteBtn').getAttribute('aria-pressed') === 'true' ? 0 : 1;
      if (actx.state === 'suspended') actx.resume().catch(() => {});
      return { gain, dest };
    } catch (e) {
      return null;
    }
  }

  const baseName = (n) => (n.replace(/\.[^.]+$/, '').replace(/[^\w\- ]+/g, '').trim() || 'atlas').slice(0, 60);

  function loadFile(file) {
    if (!file) return;
    if (K.recording) { toast('Finish or cancel the export first.'); return; }
    if (file.type.startsWith('video/')) loadVideo(file);
    else if (file.type.startsWith('image/')) loadImage(file);
    else toast('Atlas opens images and videos. "' + file.name + '" is neither.');
  }

  $('openBtn').onclick = () => $('file').click();
  $('file').onchange = (e) => { loadFile(e.target.files[0]); e.target.value = ''; };

  const vp = $('viewport');
  let dragDepth = 0;
  vp.addEventListener('dragenter', (e) => { e.preventDefault(); dragDepth++; $('drop').hidden = false; });
  vp.addEventListener('dragover', (e) => e.preventDefault());
  vp.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; $('drop').hidden = true; } });
  vp.addEventListener('drop', (e) => {
    e.preventDefault(); dragDepth = 0; $('drop').hidden = true;
    loadFile(e.dataTransfer.files[0]);
  });
  document.addEventListener('pointerdown', () => { if (actx && actx.state === 'suspended') actx.resume().catch(() => {}); });

  // ------------------------------------------------------------ output + raster
  function applyOutput() {
    if (!src.w) return;
    const aspect = src.w / src.h;
    let w, h;
    if (state.out === 'source') {
      const cap = Math.min(4096, engine.maxTex);
      const s = Math.min(1, cap / Math.max(src.w, src.h));
      w = src.w * s; h = src.h * s;
    } else {
      const short = +state.out;
      if (aspect >= 1) { h = short; w = short * aspect; } else { w = short; h = short / aspect; }
    }
    engine.setOutput(w, h);
    fitView();
    updateBadge();
  }

  // title bar: program and source on the left, raster state on the right
  function updateBadge() {
    const r = engine.raster;
    if (!r) return;
    $('srcName').textContent = 'preview · ' + (src.kind === 'sample' ? 'test card' : src.name);
    $('badge').textContent = `${state.quality} ${r.w}×${r.h} → ${engine.expW}×${engine.expH}`;
  }

  document.querySelectorAll('#quality button').forEach((b) => {
    b.onclick = () => {
      state.quality = b.dataset.q;
      document.querySelectorAll('#quality button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      engine.setQuality(state.quality);
      updateBadge();
      store('atlas.quality', state.quality);
    };
  });
  $('outSize').onchange = (e) => { state.out = e.target.value; applyOutput(); store('atlas.out', state.out); };

  // ------------------------------------------------------------ render loop
  let clock = 0, frame = 0, last = performance.now();
  K.clockNow = () => clock;
  K.hooks = [];
  function tick(now) {
    requestAnimationFrame(tick);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!src.el) return;
    const running = state.playing || K.recording;
    if (running) { clock += dt; frame++; }
    if (src.kind === 'sample' && running) src.el.draw(clock);
    const split = state.compare && !K.recording ? state.split : -1;
    engine.render(K.effective(), clock, frame, { uSplit: split });
    K.hooks.forEach((fn) => fn(now));
    updateTime();
  }
  requestAnimationFrame(tick);

  // ------------------------------------------------------------ transport
  function syncTransport() {
    $('playBtn').textContent = state.playing ? 'pause' : 'play';
    $('scrub').disabled = src.kind !== 'video';
    $('muteBtn').disabled = src.kind !== 'video';
  }
  K.syncTransport = syncTransport;

  function togglePlay() {
    if (K.recording) return;
    state.playing = !state.playing;
    if (src.kind === 'video') {
      if (state.playing) src.el.play().catch(() => { state.playing = false; syncTransport(); });
      else src.el.pause();
    }
    syncTransport();
  }
  $('playBtn').onclick = togglePlay;

  let scrubbing = false;
  $('scrub').addEventListener('input', (e) => {
    if (src.kind !== 'video' || !src.el.duration) return;
    scrubbing = true;
    src.el.currentTime = (e.target.value / 1000) * src.el.duration;
    paintScrub();
  });
  $('scrub').addEventListener('change', () => { scrubbing = false; });

  function paintScrub() {
    const s = $('scrub');
    s.style.setProperty('--pct', (s.value / 10) + '%');
  }
  function updateTime() {
    if (src.kind === 'video' && src.el.duration) {
      if (!scrubbing) $('scrub').value = Math.round((src.el.currentTime / src.el.duration) * 1000);
      $('time').textContent = fmtTime(src.el.currentTime) + ' / ' + fmtTime(src.el.duration);
    } else {
      $('scrub').value = 0;
      $('time').textContent = src.kind === 'image' ? 'still' : 'live';
    }
    paintScrub();
  }

  $('muteBtn').onclick = () => {
    const b = $('muteBtn');
    const muted = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', String(muted));
    b.textContent = muted ? 'muted' : 'sound';
    if (src.audio) src.audio.gain.gain.value = muted ? 0 : 1;
    else if (src.kind === 'video') src.el.muted = muted;
  };

  // compare split
  function placeSplit() {
    const line = $('split');
    line.hidden = !state.compare;
    if (!state.compare) return;
    const c = canvas.getBoundingClientRect(), v = vp.getBoundingClientRect();
    line.style.left = (c.left - v.left + vp.scrollLeft + c.width * state.split) + 'px';
    line.style.top = (c.top - v.top + vp.scrollTop) + 'px';
    line.style.height = c.height + 'px';
    line.style.bottom = 'auto';
  }
  K.hooks.push(placeSplit);
  function setCompare(on) {
    state.compare = on;
    $('compareBtn').setAttribute('aria-pressed', String(on));
    placeSplit();
  }
  $('compareBtn').onclick = () => setCompare(!state.compare);
  canvas.addEventListener('pointerdown', (e) => {
    if (!state.compare) return;
    canvas.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const r = canvas.getBoundingClientRect();
      state.split = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
    };
    move(e);
    canvas.onpointermove = move;
    canvas.onpointerup = () => { canvas.onpointermove = null; };
  });

  // Preview sizing. Fitted to the window, the canvas renders at screen resolution
  // so the mask never aliases; at 100% and while exporting it renders at full size.
  function fitView() {
    if (!engine.expW) return;
    const zoomed = vp.classList.contains('zoomed');
    const dpr = window.devicePixelRatio || 1;
    let cw, ch;
    if (zoomed) {
      cw = engine.expW / dpr; ch = engine.expH / dpr;
    } else {
      // stacked phone layout: the preview sizes itself, so fit to the screen instead
      const stacked = matchMedia('(max-width: 900px)').matches;
      const aw = Math.max(60, vp.clientWidth - 32);
      const ah = Math.max(60, stacked ? window.innerHeight * 0.62 : vp.clientHeight - 32);
      const s = Math.min(aw / engine.expW, ah / engine.expH);
      cw = engine.expW * s; ch = engine.expH * s;
    }
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    if (!K.recording) engine.setView(zoomed ? null : Math.ceil(cw * dpr));
    placeSplit();
  }
  K.fitView = fitView;
  new ResizeObserver(() => fitView()).observe(vp);

  $('zoomBtn').onclick = () => {
    const on = !vp.classList.contains('zoomed');
    vp.classList.toggle('zoomed', on);
    $('zoomBtn').setAttribute('aria-pressed', String(on));
    fitView();
  };
  $('fsBtn').onclick = () => {
    const req = vp.requestFullscreen || vp.webkitRequestFullscreen;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (req) Promise.resolve(req.call(vp)).catch(() => toast('Fullscreen is not available here.'));
    else toast('Fullscreen is not available here.');
  };

  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input[type=text], select, textarea') || e.metaKey || e.ctrlKey) return;
    if (e.code === 'Space' && !e.target.closest('button, input')) { e.preventDefault(); togglePlay(); }
    else if (e.key === 'c' || e.key === 'C') setCompare(!state.compare);
    else if (e.key === 'z' || e.key === 'Z') $('zoomBtn').click();
  });

  // ------------------------------------------------------------ control rack
  const rows = new Map();
  const decimals = (c) => (c.step >= 1 ? 0 : c.step >= 0.1 ? 1 : c.step >= 0.01 ? 2 : 3);
  function fmtVal(c, v) {
    if (c.opts) { const o = c.opts.find((x) => x.v === v); return o ? o.l : String(v); }
    return v.toFixed(decimals(c)) + (c.u ? ' ' + c.u : '');
  }

  function buildControl(c, parent) {
    const row = document.createElement('div');
    row.className = 'ctl';
    const id = 'c_' + c.k;
    const label = document.createElement('label');
    label.htmlFor = id;
    label.textContent = c.l;
    label.title = 'Double-click to reset';
    const out = document.createElement('output');
    out.htmlFor = id;
    let input;
    if (c.opts) {
      input = document.createElement('select');
      c.opts.forEach((o) => {
        const op = document.createElement('option');
        op.value = String(o.v); op.textContent = o.l;
        input.append(op);
      });
      input.onchange = () => setParam(c.k, +input.value);
    } else {
      input = document.createElement('input');
      input.type = 'range';
      input.min = c.min; input.max = c.max; input.step = c.step;
      input.oninput = () => setParam(c.k, +input.value);
      input.ondblclick = () => setParam(c.k, DEFAULTS[c.k]);
    }
    input.id = id;
    label.ondblclick = () => setParam(c.k, DEFAULTS[c.k]);
    row.append(label, out, input);
    parent.append(row);
    rows.set(c.k, { c, row, input, out });
  }

  function paintRow(k) {
    const r = rows.get(k);
    if (!r) return;
    const v = state.params[k];
    if (r.c.opts) r.input.value = String(v);
    else {
      r.input.value = v;
      r.input.style.setProperty('--pct', ((v - r.c.min) / (r.c.max - r.c.min)) * 100 + '%');
    }
    r.out.textContent = fmtVal(r.c, v);
    r.row.classList.toggle('changed', Math.abs(v - DEFAULTS[k]) > 1e-6);
  }

  function setParam(k, v) {
    state.params[k] = v;
    paintRow(k);
    if (state.look) { state.look = null; paintLooks(); }
    paintModules();
    persist();
  }

  MASTER.forEach((c) => buildControl(c, $('masterSec')));

  const mods = new Map();
  const CHEV = '<span class="mod-chev" aria-hidden="true"></span>';
  GROUPS.forEach((g, i) => {
    const d = document.createElement('details');
    d.className = 'mod';
    d.open = i < 2 || g.id === 'screen';
    const s = document.createElement('summary');
    s.innerHTML = CHEV + '<span class="mod-led" aria-hidden="true"></span><span class="mod-title"></span>';
    s.querySelector('.mod-title').textContent = g.title;
    const power = document.createElement('button');
    power.type = 'button'; power.className = 'mini'; power.textContent = 'on';
    power.title = 'Switch this module on or off';
    power.onclick = (e) => {
      e.preventDefault(); e.stopPropagation();
      state.enabled[g.id] = !state.enabled[g.id];
      paintModules(); persist();
    };
    const reset = document.createElement('button');
    reset.type = 'button'; reset.className = 'mini'; reset.textContent = 'reset';
    reset.title = 'Return this module to its defaults';
    reset.onclick = (e) => {
      e.preventDefault(); e.stopPropagation();
      g.controls.forEach((c) => { state.params[c.k] = DEFAULTS[c.k]; paintRow(c.k); });
      state.look = null; paintLooks(); paintModules(); persist();
    };
    s.append(power, reset);
    const body = document.createElement('div');
    body.className = 'mod-body';
    const hint = document.createElement('p');
    hint.className = 'mod-hint'; hint.textContent = g.hint;
    body.append(hint);
    g.controls.forEach((c) => buildControl(c, body));
    d.append(s, body);
    $('modules').append(d);
    mods.set(g.id, { g, d, power });
  });

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
  const paintAll = () => { rows.forEach((_, k) => paintRow(k)); paintModules(); paintLooks(); };

  // ------------------------------------------------------------ looks
  let cat = 'Terminal';
  const CATS = ['Terminal', 'Camera', 'TV', 'Glitch', 'Mine'];
  const mine = () => store('atlas.looks') || [];
  CATS.forEach((name) => {
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('role', 'tab'); b.textContent = name.toLowerCase(); b.dataset.cat = name;
    b.onclick = () => { cat = name; paintLooks(); };
    $('catTabs').append(b);
  });

  function applyLook(look) {
    state.params = { ...DEFAULTS, ...look.p };
    state.enabled = Object.fromEntries(GROUPS.map((g) => [g.id, look.enabled ? look.enabled[g.id] !== false : true]));
    state.look = look.name;
    paintAll(); persist();
  }
  K.applyLook = applyLook;

  function paintLooks() {
    [...$('catTabs').children].forEach((b) => b.setAttribute('aria-selected', String(b.dataset.cat === cat)));
    const grid = $('presetGrid');
    grid.innerHTML = '';
    const list = cat === 'Mine' ? mine() : PRESETS.filter((p) => p.cat === cat);
    if (!list.length) {
      const p = document.createElement('p');
      p.className = 'empty-note';
      p.textContent = 'Looks you save appear here. They keep settings only, in this browser.';
      grid.append(p);
    }
    list.forEach((look) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'preset';
      b.setAttribute('aria-pressed', String(state.look === look.name));
      const span = document.createElement('span');
      span.textContent = look.name;
      b.append(span);
      b.onclick = () => applyLook(look);
      if (cat === 'Mine') {
        const x = document.createElement('span');
        x.className = 'x'; x.textContent = '×'; x.title = 'Delete this look';
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
    list.push({ name, p: { ...state.params }, enabled: { ...state.enabled } });
    if (store('atlas.looks', list) === null && !mine().length) { toast('This browser blocked saving. Looks cannot be kept here.'); return; }
    $('presetName').value = '';
    state.look = name; cat = 'Mine';
    paintLooks();
    toast('Saved "' + name + '"');
  };
  $('presetName').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('savePreset').click(); });

  $('randomBtn').onclick = () => {
    const p = { ...DEFAULTS };
    GROUPS.forEach((g) => g.controls.forEach((c) => {
      if (c.opts) { if (Math.random() < 0.25) p[c.k] = c.opts[Math.floor(Math.random() * c.opts.length)].v; return; }
      if (c.n !== undefined && Math.random() > 0.3) return;
      const span = c.max - c.min;
      const v = c.n !== undefined ? c.min + span * Math.pow(Math.random(), 1.6) : c.min + span * Math.random();
      p[c.k] = Math.round(v / c.step) * c.step;
    }));
    p.capture = Math.random() < 0.25 ? p.capture : 0;
    applyLook({ name: null, p });
  };
  $('resetBtn').onclick = () => applyLook({ name: null, p: {} });

  // ------------------------------------------------------------ persistence (this browser only)
  function persist() {
    clearTimeout(persist.t);
    persist.t = setTimeout(() => store('atlas.session.v2', { params: state.params, enabled: state.enabled, look: state.look }), 300);
  }
  const saved = store('atlas.session.v2');
  if (saved && saved.params) {
    state.params = { ...DEFAULTS, ...saved.params };
    Object.assign(state.enabled, saved.enabled || {});
    state.look = saved.look || null;
  } else {
    applyLook(PRESETS.find((p) => p.name === 'Terminal Glow'));
  }
  const q = store('atlas.quality');
  if (q && q !== 'SD') document.querySelector(`#quality button[data-q="${q}"]`)?.click();
  const o = store('atlas.out');
  if (o) { state.out = o; $('outSize').value = o; }

  paintAll();
  syncTransport();
  loadSample();
  window.addEventListener('resize', fitView);
})();
