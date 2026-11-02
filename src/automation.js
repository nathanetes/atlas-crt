// Atlas CRT automation maths: keyframe curves and LFOs. Every value here is a pure function of the
// timeline position, so a look plays back the same in the preview and in every export.
//
// An automated control is one entry in state.auto:
//   { mode: 'keys' | 'lfo', off: bool, keys: [...], lfo: {...} }
// It keeps both sets of data, so switching between keyframes and LFO loses neither.
(function () {
  const TAU = Math.PI * 2;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const fract = (x) => x - Math.floor(x);
  const hash = (n, seed) => fract(Math.sin(n * 127.1 + seed * 311.7) * 43758.5453);
  function noise(x, seed) {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return hash(i, seed) * (1 - u) + hash(i + 1, seed) * u;
  }

  // ------------------------------------------------------------ keyframes
  // Between two keyframes the value moves along the first one's curve, a cubic Bézier from (0,0) to
  // (1,1) as in CSS easing (x is time, y is progress, so y may overshoot). 'hold' keeps the value
  // until the next keyframe.
  const bezier = (a1, a2, s) => 3 * a1 * s * (1 - s) * (1 - s) + 3 * a2 * s * s * (1 - s) + s * s * s;
  const bezierSlope = (a1, a2, s) => 3 * a1 * (1 - s) * (1 - s) + 6 * (a2 - a1) * s * (1 - s) + 3 * (1 - a2) * s * s;

  // progress at time fraction u (0..1) along a keyframe's curve
  function ease(e, u) {
    if (e === 'hold') return 0;
    const [x1, y1, x2, y2] = e;
    let lo = 0, hi = 1, s = u;
    for (let i = 0; i < 20; i++) { // x rises steadily with s while x1 and x2 stay in 0..1, so bisect for it
      s = (lo + hi) / 2;
      if (bezier(x1, x2, s) < u) lo = s; else hi = s;
    }
    return bezier(y1, y2, s);
  }
  function valueAt(keys, t) {
    if (t <= keys[0].t) return keys[0].v;
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i], b = keys[i + 1];
      if (t < b.t) return a.v + (b.v - a.v) * ease(a.ease, (t - a.t) / Math.max(b.t - a.t, 1e-6));
    }
    return keys[keys.length - 1].v;
  }

  // ------------------------------------------------------------ LFO
  // rate: cycles per second. depth: swing as a share of the control's half range. offset: moves the
  // centre by the same measure. phase: where in the cycle it starts. smooth: glide between random
  // steps (0 hard steps, 1 a continuous glide) and rounded corners on the other shapes. jitter: drifts
  // the timing. bend and sym warp the cycle, like Serum's Bend and Asym: bend leans the shape toward
  // one end, sym moves its midpoint. steps: quantizes the output to that many levels.
  const WAVES = [
    ['sine', 'Sine'], ['triangle', 'Triangle'], ['ramp', 'Ramp'], ['saw', 'Saw'],
    ['square', 'Square'], ['random', 'Random'], ['drift', 'Drift'], ['draw', 'Draw'],
  ];
  const TABLE = 32;
  const newTable = () => Array.from({ length: TABLE }, (_, i) => Math.sin((i / TABLE) * TAU));
  const LFO = { wave: 'sine', rate: 0.25, depth: 0.3, offset: 0, phase: 0, smooth: 0, jitter: 0, bend: 0, sym: 0.5, steps: 0, seed: 1, table: null };

  function warp(l, f) {
    const p = clamp(l.sym, 0.02, 0.98);
    f = f < p ? (0.5 * f) / p : 0.5 + (0.5 * (f - p)) / (1 - p);
    return l.bend ? Math.pow(f, Math.exp(l.bend * 1.6)) : f;
  }
  function cycle(l, f) {
    switch (l.wave) {
      case 'triangle': return f < 0.25 ? 4 * f : f < 0.75 ? 2 - 4 * f : 4 * f - 4;
      case 'ramp': return 2 * f - 1;
      case 'saw': return 1 - 2 * f;
      case 'square': return f < 0.5 ? 1 : -1;
      default: return Math.sin(f * TAU);
    }
  }
  // from the last step's value to this one over the first `smooth` of the step
  function glide(prev, cur, f, smooth) {
    if (smooth < 0.001) return cur;
    const u = clamp(f / smooth, 0, 1);
    return prev + (cur - prev) * u * u * (3 - 2 * u);
  }
  // the LFO's output at timeline position t, -1..1
  function lfoAt(l, t) {
    let x = t * l.rate + l.phase;
    if (l.jitter > 0) x += l.jitter * (noise(t * l.rate * 0.73 + 3.1, l.seed + 5) - 0.5);
    const n = Math.floor(x), f = x - n;
    let y;
    if (l.wave === 'random') {
      y = glide(hash(n - 1, l.seed) * 2 - 1, hash(n, l.seed) * 2 - 1, warp(l, f), l.smooth);
    } else if (l.wave === 'drift') {
      const fine = 1 - l.smooth;
      y = noise(x, l.seed) * 0.62 + noise(x * 2.1, l.seed + 1) * 0.28 * fine + noise(x * 4.3, l.seed + 2) * 0.1 * fine;
      y = clamp((y / (0.62 + 0.38 * fine) - 0.5) * 3, -1, 1);
    } else if (l.wave === 'draw') {
      const tb = l.table || (l.table = newTable()), p = warp(l, f) * tb.length, i = Math.min(tb.length - 1, Math.floor(p));
      y = glide(tb[(i + tb.length - 1) % tb.length], tb[i], p - i, l.smooth);
    } else if (l.smooth > 0) {
      const r = l.smooth * 0.2; // average over up to a fifth of a cycle either side
      y = 0;
      for (let i = -8; i <= 8; i++) y += cycle(l, warp(l, fract(f + (i / 8) * r)));
      y /= 17;
    } else {
      y = cycle(l, warp(l, f));
    }
    if (l.steps >= 2) y = (Math.round(((y + 1) / 2) * (l.steps - 1)) / (l.steps - 1)) * 2 - 1;
    return y;
  }

  // ------------------------------------------------------------ motion micro-controls
  // Every numeric control can be made to misbehave on its own, on top of any keyframes or LFO:
  // stutter jumps it between random values, jitter shakes it each frame, spikes throw it hard for
  // a moment, and drift lets it wander.
  const MICRO = { stutter: 0, stutterRate: 8, jitter: 0, spike: 0, spikeRate: 2, drift: 0, driftRate: 0.3 };
  const seedOf = (k) => { let h = 7; for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) % 9973; return h / 37; };
  function microAt(m, v, c, t) {
    const span = c.max - c.min, s = seedOf(c.k);
    if (m.stutter > 0) v += span * m.stutter * 0.5 * (hash(Math.floor(t * m.stutterRate), s) * 2 - 1);
    if (m.jitter > 0) v += span * m.jitter * 0.25 * (hash(Math.floor(t * 30), s + 1) * 2 - 1);
    if (m.spike > 0) {
      const n = Math.floor(t * m.spikeRate), f = t * m.spikeRate - n;
      if (hash(n, s + 2) < 0.4 && f < 0.3) v += span * m.spike * (hash(n, s + 3) > 0.5 ? 1 : -1);
    }
    if (m.drift > 0) v += span * m.drift * 0.5 * (noise(t * m.driftRate, s + 4) * 2 - 1);
    return clamp(v, c.min, c.max);
  }
  const cleanMicro = (m) => {
    const o = { ...MICRO };
    for (const k in MICRO) if (Number.isFinite(m && m[k])) o[k] = m[k];
    return o;
  };
  const microOn = (m) => !!m && (m.stutter > 0 || m.jitter > 0 || m.spike > 0 || m.drift > 0);

  // ------------------------------------------------------------ one automated control
  // the control's value at t, swinging around base for an LFO
  function valueOf(a, base, c, t) {
    let v = base;
    if (a.mode === 'lfo' && a.lfo) {
      v = base + (c.max - c.min) * 0.5 * (a.lfo.depth * lfoAt(a.lfo, t) + a.lfo.offset);
    } else if (a.keys.length) {
      v = valueAt(a.keys, t);
    }
    return clamp(v, c.min, c.max);
  }

  const LEGACY_WAVE = { sine: 'sine', triangle: 'triangle', saw: 'ramp', square: 'square', random: 'random', drift: 'drift' };
  const num = (v, d) => (Number.isFinite(v) ? v : d);
  function cleanLfo(l) {
    const o = { ...LFO, ...l };
    for (const k in LFO) if (typeof LFO[k] === 'number') o[k] = num(o[k], LFO[k]);
    if (!WAVES.some(([w]) => w === o.wave)) o.wave = 'sine';
    o.table = Array.isArray(l.table) && l.table.length ? l.table.map((v) => clamp(num(v, 0), -1, 1)) : null;
    return o;
  }
  // an entry from a session, a look or a file, in today's shape. Entries from v1.2 to v2.2 were a
  // bare LFO ({ shape, rate, depth, phase, seed }), and v2.3 entries only had keys.
  function normalize(a) {
    if (!a || typeof a !== 'object') return null;
    const keys = (Array.isArray(a.keys) ? a.keys : [])
      .filter((k) => k && Number.isFinite(k.t) && Number.isFinite(k.v))
      .map((k) => ({ t: k.t, v: k.v, ease: k.ease === 'hold' || (Array.isArray(k.ease) && k.ease.length === 4 && k.ease.every(Number.isFinite)) ? k.ease : [0.42, 0, 0.58, 1] }))
      .sort((x, y) => x.t - y.t);
    if (a.shape) {
      const lfo = cleanLfo({ wave: LEGACY_WAVE[a.shape] || 'sine', rate: a.rate, depth: a.depth, phase: a.phase, seed: a.seed });
      return { mode: 'lfo', off: false, keys, lfo };
    }
    const lfo = a.lfo ? cleanLfo(a.lfo) : null;
    return { mode: a.mode === 'lfo' && lfo ? 'lfo' : 'keys', off: !!a.off, keys, lfo };
  }

  window.AtlasAuto = { MICRO, microAt, cleanMicro, microOn, WAVES, LFO, TABLE, newTable, clamp, bezier, bezierSlope, ease, valueAt, lfoAt, valueOf, normalize, cleanLfo };
})();
