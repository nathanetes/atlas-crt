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
    b.type = 'button'; b.className = 'btn' + (cls ? ' ' + cls : ''); b.textContent = label;
    b.onclick = fn;
    return b;
  }
  function select(id, label, opts, val) {
    const wrap = document.createElement('label');
    wrap.className = 'field-label';
    wrap.style.display = 'flex'; wrap.style.alignItems = 'center'; wrap.style.gap = '6px';
    wrap.textContent = label;
    const s = document.createElement('select');
    s.className = 'sel'; s.id = id;
    opts.forEach(([v, l]) => { const o = document.createElement('option'); o.value = v; o.textContent = l; s.append(o); });
    s.value = val;
    wrap.append(s);
    return wrap;
  }

  function closePanel() {
    ui.box.hidden = true;
    job = null;
    K.recording = false;
    if (src.kind === 'video') { src.el.loop = true; if (state.playing) src.el.play().catch(() => {}); }
    K.syncTransport();
    K.fitView();
  }

  $('recBtn').onclick = () => {
    if (!src.el || job) return;
    const mime = pickMime();
    if (!mime || !canvas.captureStream) {
      toast('This browser cannot record video. Use Chrome, Edge, Safari or Firefox.');
      return;
    }
    const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
    job = { mime, ext, phase: 'setup' };
    ui.box.hidden = false;
    ui.dot.className = 'rec-dot done';
    ui.title.textContent = 'export · ' + ext;
    ui.time.textContent = K.engine.expW + '×' + K.engine.expH;
    ui.bar.style.width = '0%';
    ui.note.textContent = src.kind === 'video'
      ? 'Plays the whole clip once in real time with the current look, sound included. Keep this tab in front while it records.'
      : 'Records the picture for the length you pick, with the effects moving. Keep this tab in front while it records.';
    ui.actions.innerHTML = '';
    ui.actions.append(select('recFps', 'fps', [['24', '24'], ['30', '30'], ['60', '60']], '30'));
    if (src.kind !== 'video') {
      ui.actions.append(select('recLen', 'length', [['5', '5 s'], ['10', '10 s'], ['15', '15 s'], ['30', '30 s']], '10'));
    }
    const spacer = document.createElement('span'); spacer.style.flex = '1';
    ui.actions.append(spacer, button('$ cancel', '', closePanel), button('$ record', 'primary', start));
  };

  async function start() {
    const fps = +$('recFps').value;
    const isVideo = src.kind === 'video';
    const length = isVideo ? src.el.duration : +$('recLen').value;
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
    ui.title.textContent = 'recording · ' + job.ext;
    ui.actions.innerHTML = '';
    ui.actions.append(button('$ cancel', '', () => { job.cancelled = true; stop(); }));
    K.syncTransport();

    if (isVideo) {
      const v = src.el;
      v.pause(); v.loop = false;
      await new Promise((res) => {
        const done = () => { v.removeEventListener('seeked', done); res(); };
        v.addEventListener('seeked', done);
        v.currentTime = 0;
        setTimeout(done, 1500);
      });
      v.onended = () => { if (job && job.phase === 'recording') stop(); };
      rec.start(500);
      v.play().catch(() => { toast('The clip would not play, so recording stopped.'); job.cancelled = true; stop(); });
    } else {
      K.seek(0); // keyframes play from the start of the timeline
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
    ui.title.textContent = 'ready · ' + job.ext;
    ui.time.textContent = mb(blob.size);
    ui.bar.style.width = '100%';
    ui.note.textContent = filename;
    ui.actions.innerHTML = '';
    const spacer = document.createElement('span'); spacer.style.flex = '1';
    ui.actions.append(
      spacer,
      button('$ discard', '', closePanel),
      button('$ save ' + job.ext, 'primary', async () => {
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
