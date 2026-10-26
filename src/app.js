// Atlas CRT app core: engine, effective parameters (automation and macros), media loading,
// render loop, transport and preview sizing. The control rack is in rack.js.
(function () {
  const { MACROS, GROUPS, DEFAULTS, BY_KEY } = window.AtlasParams;
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
    auto: {}, // key -> { shape, rate (Hz), depth (0..1 of the range), phase, seed }
  });
  let clock = 0, frame = 0, last = performance.now();

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

  K.store = store;
  function store(key, val) {
    try {
      if (val === undefined) return JSON.parse(localStorage.getItem(key) || 'null');
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) { return null; }
  }

  // ------------------------------------------------------------ automation
  // Each automated slider swings around its set value; time is the effect clock, so
  // exports repeat exactly what the preview showed.
  const frac = (x) => x - Math.floor(x);
  const rnd = (n, seed) => frac(Math.sin(n * 127.1 + seed * 311.7) * 43758.5453);
  const WAVES = {
    sine: (x) => Math.sin(x * 2 * Math.PI),
    triangle: (x) => 1 - 4 * Math.abs(frac(x + 0.25) - 0.5),
    saw: (x) => 2 * frac(x) - 1,
    square: (x) => (frac(x) < 0.5 ? 1 : -1),
    random: (x, s) => rnd(Math.floor(x), s) * 2 - 1,
    drift: (x, s) => {
      const i = Math.floor(x), f = frac(x), e = f * f * (3 - 2 * f);
      return (rnd(i, s) * (1 - e) + rnd(i + 1, s) * e) * 2 - 1;
    },
  };
  K.WAVES = Object.keys(WAVES);
  K.live = {};

  K.effective = function (time = clock) {
    const p = { ...state.params };
    const clamp = (c, v) => Math.min(c.max, Math.max(c.min, v));
    for (const k in state.auto) {
      const a = state.auto[k], c = BY_KEY[k];
      if (!c || c.opts) continue;
      p[k] = clamp(c, p[k] + (c.max - c.min) * 0.5 * a.depth * WAVES[a.shape](time * a.rate + a.phase, a.seed));
      K.live[k] = p[k];
    }
    for (const m of MACROS) {
      const f = p[m.k];
      delete p[m.k];
      if (Math.abs(f - 1) < 1e-4) continue;
      for (const k of m.keys) {
        const c = BY_KEY[k], n = c.n !== undefined ? c.n : c.min;
        p[k] = clamp(c, n + (p[k] - n) * f);
      }
    }
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

  K.setQuality = (q) => { state.quality = q; engine.setQuality(q); updateBadge(); };
  K.setOut = (o) => { state.out = o; applyOutput(); };

  // ------------------------------------------------------------ render loop
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

  syncTransport();
  loadSample();
  window.addEventListener('resize', fitView);
})();
