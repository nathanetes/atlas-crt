// Atlas CRT export: PNG stills and real-time video recording of the processed canvas.
(function () {
  const K = window.Atlas;
  if (!K || !K.engine) return;
  const $ = (id) => document.getElementById(id);
  const canvas = $('out');
  const { src, state, toast } = K;

  // Inside the Claude viewer, saving goes through the downloads capability;
  // opened as a plain file, a normal download link works.
  const dlReady = window.claude && typeof window.claude.use === 'function'
    ? window.claude.use('downloads').catch(() => null)
    : Promise.resolve(null);

  const SAVE_ERRORS = {
    declined: 'Save cancelled.',
    too_large: 'That file is too large to save here. Try a lower output size.',
    rejected_extension: 'This file type cannot be saved here.',
    rate_limited: 'A save is already waiting for your answer.',
  };

  K.saveFile = saveFile;
  async function saveFile(blob, filename) {
    const dl = await dlReady;
    if (dl) {
      try {
        await dl.save({ filename, data: blob });
        toast('Saved ' + filename);
        return true;
      } catch (err) {
        toast(SAVE_ERRORS[err && err.code] || 'Saving is not available in this view.');
        return false;
      }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 5000);
    return true;
  }

  // ------------------------------------------------------------ stills
  $('stillBtn').onclick = () => {
    if (!src.el || K.recording) return;
    // draw one clean full-size frame (no compare split) and copy it synchronously
    K.engine.setView(null);
    K.engine.render(K.effective(), K.clockNow(), 1, { uSplit: -1 });
    canvas.toBlob((blob) => {
      if (!blob) { toast('The still could not be captured.'); return; }
      saveFile(blob, src.name + '-atlas.png');
    }, 'image/png');
    K.fitView();
  };

  // ------------------------------------------------------------ video
  function pickMime() {
    if (!window.MediaRecorder) return null;
    const list = [
      'video/mp4;codecs=avc1.640028,mp4a.40.2',
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];
    return list.find((m) => MediaRecorder.isTypeSupported(m)) || null;
  }

  const ui = {
    box: $('rec'), dot: $('recDot'), title: $('recTitle'), time: $('recTime'),
    bar: $('recBar'), note: $('recNote'), actions: $('recActions'),
  };
  let job = null;
  const fmt = (s) => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  const mb = (n) => (n / 1048576).toFixed(1) + ' MB';

  function button(label, cls, fn) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn btn-sm ' + (cls || 'btn-secondary'); b.textContent = label;
    b.onclick = fn;
    return b;
  }
  function select(id, label, opts, val) {
    const wrap = document.createElement('label');
    wrap.className = 'rec-field';
    wrap.textContent = label;
    const s = document.createElement('select');
    s.className = 'select'; s.id = id;
    opts.forEach(([v, l]) => { const o = document.createElement('option'); o.value = v; o.textContent = l; s.append(o); });
    s.value = val;
    wrap.append(s);
    return wrap;
  }

  // a clip's length comes from the file; a photo records the timeline, as long as you set it here
  function lengthField() {
    const wrap = document.createElement('label');
    wrap.className = 'rec-field';
    wrap.textContent = 'Length';
    const n = document.createElement('input');
    n.className = 'number'; n.id = 'recLen'; n.type = 'number'; n.min = 1; n.max = 600; n.step = 1;
    n.value = state.length;
    wrap.append(n, 's');
    return wrap;
  }

  function closePanel() {
    ui.box.hidden = true;
    $('recLink').hidden = true;
    job = null;
    K.recording = false;
    if (src.kind === 'video') { src.el.loop = true; if (state.playing) src.el.play().catch(() => {}); }
    K.syncTransport();
    K.fitView();
  }

  // Quick records in real time. Pro renders frame by frame through WebCodecs: it takes as long as it
  // takes, so heavy effects can't drop frames, and the tab doesn't have to stay in front.
  const pro = { on: false, codec: 'avc', fps: 30, mbps: 20, wide: false, sound: true, rate: 48000, kbps: 256 };
  const canPro = () => !!(window.VideoEncoder && window.VideoFrame);
  const codecString = (c, w, h) => (c === 'hevc' ? 'hvc1.1.6.L153.B0' : w * h > 2096704 ? 'avc1.640033' : 'avc1.640028');

  function field(label, control) {
    const wrap = document.createElement('label');
    wrap.className = 'pro-field';
    wrap.append(label, control);
    return wrap;
  }
  function chooser(opts, val, onchange) {
    const s = document.createElement('select');
    s.className = 'select';
    opts.forEach(([v, l]) => { const o = document.createElement('option'); o.value = v; o.textContent = l; s.append(o); });
    s.value = val;
    s.onchange = () => onchange(s.value);
    return s;
  }

  function paintSetup() {
    const a = ui.actions;
    a.innerHTML = '';
    const mode = document.createElement('div');
    mode.className = 'pro-mode';
    K.segmented(mode, [['quick', 'Quick'], ['pro', 'Pro']], pro.on ? 'pro' : 'quick', (v) => { pro.on = v === 'pro'; paintSetup(); });
    a.append(mode);
    if (!pro.on) {
      ui.note.textContent = src.kind === 'video'
        ? 'Plays the whole clip once in real time with the current look, sound included. Keep this tab in front while it records.'
        : 'Records the timeline once, with the effects moving. Keep this tab in front while it records.';
      a.append(select('recFps', 'FPS', [['24', '24'], ['30', '30'], ['60', '60']], '30'));
      if (src.kind !== 'video') a.append(lengthField());
    } else {
      ui.note.textContent = 'Renders every frame in full, as slowly as it needs. Nothing drops, however heavy the effects, and the tab can go to the back.';
      const grid = document.createElement('div');
      grid.className = 'pro-grid';
      grid.append(
        field('Format', chooser([['avc', 'MP4 · H.264'], ['hevc', 'MP4 · HEVC']], pro.codec, (v) => { pro.codec = v; })),
        field('Frame Rate', chooser([['24', '24 fps'], ['25', '25 fps'], ['30', '30 fps'], ['50', '50 fps'], ['60', '60 fps']], String(pro.fps), (v) => { pro.fps = +v; })),
        field('Size', chooser([['720', '720p'], ['1080', '1080p'], ['1440', '1440p'], ['2160', '4K'], ['source', 'Source']], state.out, (v) => { K.setOut(v); paintSize(); })),
        field('Aspect Ratio', chooser([['0', 'Source'], ['1.7778', '16:9'], ['0.5625', '9:16'], ['1', '1:1'], ['0.8', '4:5'], ['1.3333', '4:3'], ['2.3333', '21:9']], String(state.ratio), (v) => {
          K.setRatio(+v, state.fit); K.paintRatio(); paintSize();
        })),
        field('Fit', chooser([['fill', 'Crop to Fill'], ['fit', 'Black Bars']], state.fit, (v) => { K.setRatio(state.ratio, v); K.paintRatio(); })),
        field('Quality', chooser([['8', 'Good · 8 Mb/s'], ['20', 'High · 20 Mb/s'], ['40', 'Very High · 40 Mb/s'], ['80', 'Maximum · 80 Mb/s']], String(pro.mbps), (v) => { pro.mbps = +v; })),
        field('Color', chooser([['709', 'Rec. 709'], ['p3', 'Display P3']], pro.wide ? 'p3' : '709', (v) => { pro.wide = v === 'p3'; })),
      );
      if (src.kind === 'video') {
        grid.append(
          field('Sound', chooser([['on', 'Include'], ['off', 'Mute']], pro.sound ? 'on' : 'off', (v) => { pro.sound = v === 'on'; })),
          field('Sample Rate', chooser([['44100', '44.1 kHz'], ['48000', '48 kHz'], ['96000', '96 kHz']], String(pro.rate), (v) => { pro.rate = +v; })),
          field('Audio Bitrate', chooser([['128', '128 kb/s'], ['192', '192 kb/s'], ['256', '256 kb/s'], ['320', '320 kb/s']], String(pro.kbps), (v) => { pro.kbps = +v; })),
        );
      } else {
        grid.append(lengthField());
      }
      a.append(grid);
    }
    const spacer = document.createElement('span'); spacer.className = 'grow';
    a.append(spacer, button('Cancel', '', closePanel), button(pro.on ? 'Render' : 'Record', 'btn-primary', () => (pro.on ? renderPro() : start())));
    paintSize();
  }
  function paintSize() { ui.time.textContent = K.engine.expW + '×' + K.engine.expH; }

  $('recBtn').onclick = () => {
    if (!src.el || job) return;
    const mime = pickMime();
    if ((!mime || !canvas.captureStream) && !canPro()) {
      toast('This browser cannot record video. Use Chrome, Edge, Safari or Firefox.');
      return;
    }
    const ext = mime && mime.startsWith('video/mp4') ? 'mp4' : 'webm';
    job = { mime, ext, phase: 'setup' };
    ui.box.hidden = false;
    ui.dot.className = 'rec-dot done';
    ui.title.textContent = 'Export';
    ui.bar.style.width = '0%';
    if (!canPro()) pro.on = false;
    paintSetup();
  };

  // ------------------------------------------------------------ pro: every frame, offline
  async function encodeSound(mp4, file, seconds) {
    const bytes = await file.arrayBuffer();
    const probe = new OfflineAudioContext(2, 2, pro.rate);
    let decoded;
    try { decoded = await probe.decodeAudioData(bytes); } catch (e) { return false; }   // a clip with no sound track
    const render = new OfflineAudioContext(2, Math.ceil(seconds * pro.rate), pro.rate);
    const node = render.createBufferSource();
    node.buffer = decoded;
    node.connect(render.destination);
    node.start();
    const pcm = await render.startRendering();
    const config = { codec: 'mp4a.40.2', sampleRate: pro.rate, numberOfChannels: 2, bitrate: pro.kbps * 1000 };
    const support = await AudioEncoder.isConfigSupported(config).catch(() => ({ supported: false }));
    if (!support.supported) throw new Error('aac');
    let track = null;
    const enc = new AudioEncoder({
      output: (chunk, meta) => {
        if (!track) track = mp4.audio({ sampleRate: pro.rate, channels: 2, description: meta.decoderConfig.description, bitrate: pro.kbps * 1000 });
        mp4.add(track, chunk, 1024);
      },
      error: (e) => { job.failed = e; },
    });
    enc.configure(config);
    const left = pcm.getChannelData(0), right = pcm.getChannelData(1), step = 1024;
    for (let i = 0; i < pcm.length; i += step) {
      const n = Math.min(step, pcm.length - i), data = new Float32Array(step * 2);
      data.set(left.subarray(i, i + n), 0);
      data.set(right.subarray(i, i + n), step);
      const frame = new AudioData({ format: 'f32-planar', sampleRate: pro.rate, numberOfFrames: step, numberOfChannels: 2, timestamp: Math.round((i / pro.rate) * 1e6), data });
      enc.encode(frame);
      frame.close();
    }
    await enc.flush();
    enc.close();
    return true;
  }

  // Moves the paused clip to t and resolves once that frame can be drawn. With `presented`, it also
  // waits for the browser to show a frame from the new place: just after a seek, some browsers still
  // hand WebGL the frame from before it.
  const showVideoFrame = (t, presented = false) => new Promise((res) => {
    const v = src.el;
    let over = false;
    const finish = () => {
      if (over) return;
      over = true;
      clearTimeout(timer);
      ['seeked', 'loadeddata', 'canplay'].forEach((e) => v.removeEventListener(e, check));
      res();
    };
    const timer = setTimeout(finish, 3000);
    const ready = () => !v.seeking && v.readyState >= 2;
    const waitShown = () => {
      if (!presented || !v.requestVideoFrameCallback) { finish(); return; }
      const fallback = setTimeout(finish, 500);
      const onFrame = (now, meta) => {
        if (over) return;
        if (Math.abs(meta.mediaTime - t) < 0.25) { clearTimeout(fallback); finish(); } else v.requestVideoFrameCallback(onFrame);
      };
      v.requestVideoFrameCallback(onFrame);
    };
    function check() { if (ready()) { ['seeked', 'loadeddata', 'canplay'].forEach((e) => v.removeEventListener(e, check)); waitShown(); } }
    ['seeked', 'loadeddata', 'canplay'].forEach((e) => v.addEventListener(e, check));
    if (Math.abs(v.currentTime - t) > 1e-6) v.currentTime = t;
    check();
  });

  async function renderPro() {
    const isVideo = src.kind === 'video';
    if (!isVideo) {
      state.length = Math.min(600, Math.max(1, +$('recLen').value || state.length));
      K.changed('Timeline length');
      K.emit('layout');
    }
    const length = K.timelineLength();
    if (!isFinite(length) || length <= 0) { toast('This clip has no readable length, so it cannot be exported.'); return; }
    const E = K.engine;
    E.setView(null);
    if (pro.wide && 'drawingBufferColorSpace' in E.gl) E.gl.drawingBufferColorSpace = 'display-p3';
    const width = E.expW, height = E.expH, frames = Math.max(1, Math.round(length * pro.fps));
    const config = { codec: codecString(pro.codec, width, height), width, height, bitrate: pro.mbps * 1e6, framerate: pro.fps, latencyMode: 'quality' };
    if (pro.codec === 'avc') config.avc = { format: 'avc' }; else config.hevc = { format: 'hevc' };
    const support = await VideoEncoder.isConfigSupported(config).catch(() => ({ supported: false }));
    if (!support.supported) {
      toast(pro.codec === 'hevc' ? 'This browser cannot encode HEVC. Try H.264.' : 'This browser cannot encode that size. Try a smaller one.');
      return;
    }

    K.recording = K.offline = true;
    const wasPlaying = state.playing;
    if (isVideo) { src.el.pause(); src.el.loop = false; }
    Object.assign(job, { phase: 'rendering', cancelled: false, failed: null, ext: 'mp4', mime: 'video/mp4' });
    ui.dot.className = 'rec-dot';
    ui.title.textContent = 'Rendering';
    ui.actions.innerHTML = '';
    ui.actions.append(button('Cancel', '', () => { job.cancelled = true; }));

    const mp4 = new window.AtlasMp4();
    const scale = pro.fps * 1000;
    let track = null;
    const enc = new VideoEncoder({
      output: (chunk, meta) => {
        if (!track) track = mp4.video({ width, height, codec: pro.codec, scale, description: meta.decoderConfig.description, p3: pro.wide });
        mp4.add(track, chunk, 1000);
      },
      error: (e) => { job.failed = e; },
    });
    enc.configure(config);

    const started = performance.now();
    try {
      for (let i = 0; i < frames && !job.cancelled && !job.failed; i++) {
        const t = i / pro.fps;
        // a second seek here would leave the clip mid-seek, and the engine would draw its last frame again
        if (isVideo) await showVideoFrame(t, i === 0);
        else K.seek(t);
        if (src.kind === 'sample') src.el.draw(t);
        if (i === 0) { E.resetHistory(); E.render(K.effective(), t, i, { uSplit: -1, uTl: t }); } // fill the history with the first frame
        E.render(K.effective(), t, i, { uSplit: -1, uTl: t });
        const frame = new VideoFrame(canvas, { timestamp: Math.round(t * 1e6), duration: Math.round(1e6 / pro.fps) });
        enc.encode(frame, { keyFrame: i % (pro.fps * 2) === 0 });
        frame.close();
        while (enc.encodeQueueSize > 4) await new Promise((r) => setTimeout(r, 2));
        const pct = (i + 1) / frames;
        ui.bar.style.width = pct * 100 + '%';
        const left = ((performance.now() - started) / (i + 1)) * (frames - i - 1) / 1000;
        ui.time.textContent = (i + 1) + ' of ' + frames + ' · ' + (left < 90 ? Math.ceil(left) + ' s left' : Math.ceil(left / 60) + ' min left');
        if (i % 4 === 0) await new Promise((r) => setTimeout(r));
      }
      if (job.failed) throw job.failed;
      if (!job.cancelled) {
        await enc.flush();
        enc.close();
        if (isVideo && pro.sound && src.file) {
          ui.title.textContent = 'Encoding Sound';
          await encodeSound(mp4, src.file, length);
        }
      }
    } catch (err) {
      job.failed = err;
    }
    K.offline = K.recording = false;
    if (pro.wide && 'drawingBufferColorSpace' in E.gl) E.gl.drawingBufferColorSpace = 'srgb';
    if (isVideo) { src.el.loop = true; if (wasPlaying) src.el.play().catch(() => {}); }
    K.syncTransport();
    K.fitView();
    if (job.cancelled) { closePanel(); toast('Export cancelled.'); return; }
    if (job.failed) {
      closePanel();
      toast(String(job.failed.message) === 'aac' ? 'This browser cannot encode AAC sound. Set Sound to Mute, or use Quick.' : 'The render stopped: ' + String(job.failed.message || job.failed).slice(0, 80));
      return;
    }
    finish(mp4.finish());
  }

  // drop the frames from where the playhead was, and fill the history with the first frame instead
  function freshStart() {
    K.engine.resetHistory();
    K.engine.render(K.effective(), K.clockNow(), 0, { uSplit: -1, uTl: K.timeNow() });
  }

  async function start() {
    const fps = +$('recFps').value;
    const isVideo = src.kind === 'video';
    if (!isVideo) {
      state.length = Math.min(600, Math.max(1, +$('recLen').value || state.length));
      K.changed('Timeline length');
      K.emit('layout');
    }
    const length = K.timelineLength();
    if (!isFinite(length) || length <= 0) { toast('This clip has no readable length, so it cannot be exported.'); return; }

    K.recording = true;
    K.engine.setView(null);
    const stream = canvas.captureStream(fps);
    if (isVideo && src.audio) src.audio.dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    const bits = Math.min(40e6, Math.max(6e6, K.engine.expW * K.engine.expH * fps * 0.3));
    let rec;
    try {
      rec = new MediaRecorder(stream, { mimeType: job.mime, videoBitsPerSecond: bits, audioBitsPerSecond: 192000 });
    } catch (e) {
      stream.getTracks().forEach((t) => t.stop());
      toast('Recording could not start in this browser.');
      closePanel();
      return;
    }
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    Object.assign(job, { phase: 'recording', rec, chunks, length, isVideo, started: 0, cancelled: false });

    ui.dot.className = 'rec-dot';
    ui.title.textContent = 'Recording';
    ui.actions.innerHTML = '';
    ui.actions.append(button('Cancel', '', () => { job.cancelled = true; stop(); }));
    K.syncTransport();

    if (isVideo) {
      const v = src.el;
      v.pause(); v.loop = false;
      // the first frame has to be on screen before recording starts, or the clip opens on where the playhead was
      await showVideoFrame(0, true);
      if (!job || job.cancelled) return;
      freshStart();
      v.onended = () => { if (job && job.phase === 'recording') stop(); };
      rec.start(500);
      v.play().catch(() => { toast('The clip would not play, so recording stopped.'); job.cancelled = true; stop(); });
    } else {
      K.seek(0); // keyframes and LFOs play from the start of the timeline
      freshStart();
      rec.start(500);
    }
    job.started = performance.now();
  }

  function stop() {
    if (!job || job.phase !== 'recording') return;
    job.phase = 'finishing';
    const j = job;
    j.rec.onstop = () => {
      j.rec.stream.getVideoTracks().forEach((t) => t.stop());
      if (j.isVideo) src.el.onended = null;
      if (j.cancelled) { closePanel(); toast('Export cancelled.'); return; }
      finish(new Blob(j.chunks, { type: j.mime.split(';')[0] }));
    };
    try { j.rec.stop(); } catch (e) { closePanel(); }
  }

  function finish(blob) {
    K.recording = false;
    K.syncTransport();
    K.fitView();
    if (src.kind === 'video') { src.el.loop = true; if (state.playing) src.el.play().catch(() => {}); }
    job.phase = 'done';
    const filename = src.name + '-atlas.' + job.ext;
    ui.dot.className = 'rec-dot done';
    ui.title.textContent = 'Ready';
    ui.time.textContent = mb(blob.size);
    ui.bar.style.width = '100%';
    ui.note.textContent = filename;
    ui.actions.innerHTML = '';
    const spacer = document.createElement('span'); spacer.className = 'grow';
    $('recLink').hidden = false;
    ui.actions.append(
      spacer,
      button('Discard', '', closePanel),
      button('Save ' + job.ext.toUpperCase(), 'btn-primary', async () => {
        if (await saveFile(blob, filename)) closePanel();
      }),
    );
  }

  K.hooks.push(() => {
    if (!job || job.phase !== 'recording' || !job.started) return;
    const elapsed = job.isVideo ? src.el.currentTime : (performance.now() - job.started) / 1000;
    ui.time.textContent = fmt(elapsed) + ' / ' + fmt(job.length);
    ui.bar.style.width = Math.min(100, (elapsed / job.length) * 100) + '%';
    if (!job.isVideo && elapsed >= job.length) stop();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && job && job.phase === 'recording') {
      toast('Recording pauses while this tab is hidden. Keep it in front.');
    }
  });
})();
