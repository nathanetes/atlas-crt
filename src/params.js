// Atlas CRT controls, quick macros and factory looks.
// Control fields: k key, l label, min/max/step, d default, n value when the module
// is switched off, u unit, opts for stepped choices, dirt = eased by Signal Clean.
(function () {
  const pick = (labels) => labels.map((l, v) => ({ v, l }));
  const steps = (vals, unit) => vals.map(v => ({ v, l: v + unit }));
  const amt = (k, l, d = 0, extra = {}) => ({ k, l, min: 0, max: 1, step: 0.01, d, n: 0, ...extra });

  const MASTER = [
    { k: 'mix', l: 'Intensity', min: 0, max: 1, step: 0.01, d: 1 },
    { k: 'clean', l: 'Signal Clean', min: 0, max: 1, step: 0.01, d: 0 },
  ];

  // Quick macros scale whole families of controls away from (or toward) neutral.
  const MACROS = [
    { k: 'mTube', l: 'Tube', keys: ['phosphor', 'scanlines', 'maskScale', 'curve', 'vignette', 'fisheye'] },
    { k: 'mGlow', l: 'Glow', keys: ['glow', 'postGlow', 'halation', 'spectral', 'pbloom'] },
    { k: 'mMoire', l: 'Moiré', keys: ['moire', 'rainbow', 'capture'] },
    { k: 'mColor', l: 'Color', keys: ['preSat', 'preTemp', 'preTint', 'preHue', 'chroma', 'hueDrift', 'bleed', 'rgbSplit', 'conv', 'hue', 'sat', 'temp', 'tintGM', 'shAmt', 'hiAmt', 'gmap', 'cross', 'solar', 'grunge'] },
    { k: 'mGrime', l: 'Grime', keys: ['shake', 'tear', 'roll', 'flash', 'dropout', 'hum', 'echo', 'headSwitch', 'topLine', 'rf', 'grain', 'film', 'dust', 'weave', 'sync', 'ripple', 'flicker'] },
    { k: 'mCorrupt', l: 'Corrupt', keys: ['mosh', 'blockGlitch', 'slices', 'smear', 'compress', 'crush', 'bend', 'waves'] },
  ].map((m) => ({ ...m, min: 0, max: 2, step: 0.01, d: 1 }));

  const GROUPS = [
    {
      id: 'pregrade', title: 'Pre Grade', hint: 'Grades the source before it reaches the tube, so the signal, beams and glow all work on the graded picture.',
      controls: [
        { k: 'preExp', l: 'Exposure', min: -3, max: 3, step: 0.01, d: 0, n: 0, u: 'EV' },
        { k: 'preBright', l: 'Brightness', min: -0.5, max: 0.5, step: 0.005, d: 0, n: 0 },
        { k: 'preContrast', l: 'Contrast', min: 0, max: 2.5, step: 0.01, d: 1, n: 1 },
        { k: 'preSat', l: 'Saturation', min: 0, max: 2, step: 0.01, d: 1, n: 1 },
        { k: 'preTemp', l: 'Temperature', min: -1, max: 1, step: 0.01, d: 0, n: 0 },
        { k: 'preTint', l: 'Tint', min: -1, max: 1, step: 0.01, d: 0, n: 0 },
        { k: 'preHue', l: 'Hue Shift', min: -180, max: 180, step: 1, d: 0, n: 0, u: '°' },
      ],
    },
    {
      id: 'color', title: 'Color Signal', hint: 'Composite decode: gain, chroma, bleed and glow in the signal path.',
      controls: [
        { k: 'composite', l: 'Signal Path', d: 0, n: 0, opts: pick(['RGB', 'S-Video', 'Composite']) },
        { k: 'lumaBW', l: 'Luma Bandwidth', d: 0, n: 0, opts: pick(['Full', 'S-VHS · 400 TVL', 'Broadcast · 330 TVL', 'Betamax · 250 TVL', 'VHS · 240 TVL']) },
        { k: 'gain', l: 'Brightness Gain', min: 0.4, max: 2, step: 0.01, d: 1, n: 1 },
        { k: 'chroma', l: 'Chroma Level', min: 0, max: 2.5, step: 0.01, d: 1.1, n: 1 },
        amt('hueDrift', 'Hue Drift', 0, { max: 1.2, dirt: 1 }),
        amt('bleed', 'Chroma Bleed', 0.25, { dirt: 1 }),
        amt('rgbSplit', 'RGB Split', 0.04, { dirt: 1 }),
        amt('sharpen', 'Post Sharpen', 0.15),
        amt('postGlow', 'Post Glow', 0.12),
        amt('halation', 'Halation', 0.15),
      ],
    },
    {
      id: 'grade', title: 'Post Grade', hint: 'Grades the finished picture after the tube and the camera: exposure, contrast and color, then split toning, curves and grunge.',
      controls: [
        { k: 'postExp', l: 'Exposure', min: -3, max: 3, step: 0.01, d: 0, n: 0, u: 'EV' },
        { k: 'bright', l: 'Brightness', min: -0.5, max: 0.5, step: 0.005, d: 0, n: 0 },
        { k: 'contrast', l: 'Contrast', min: 0, max: 2.5, step: 0.01, d: 1, n: 1 },
        { k: 'sat', l: 'Saturation', min: 0, max: 2, step: 0.01, d: 1, n: 1 },
        { k: 'hue', l: 'Hue Shift', min: -180, max: 180, step: 1, d: 0, n: 0, u: '°' },
        { k: 'temp', l: 'Temperature', min: -1, max: 1, step: 0.01, d: 0, n: 0 },
        { k: 'tintGM', l: 'Tint', min: -1, max: 1, step: 0.01, d: 0, n: 0 },
        { k: 'shHue', l: 'Shadow Color', min: 0, max: 360, step: 1, d: 200, u: '°' },
        amt('shAmt', 'Shadow Tint'),
        { k: 'hiHue', l: 'Highlight Color', min: 0, max: 360, step: 1, d: 35, u: '°' },
        amt('hiAmt', 'Highlight Tint'),
        amt('gmap', 'Gradient Map'),
        amt('cross', 'Cross Process'),
        { k: 'lift', l: 'Black Level', min: -0.2, max: 0.3, step: 0.005, d: 0, n: 0 },
        { k: 'gamma', l: 'Gamma', min: 0.4, max: 2.5, step: 0.01, d: 1, n: 1 },
        amt('solar', 'Solarize'),
        amt('poster', 'Posterize'),
        amt('invert', 'Invert'),
        { k: 'chanSwap', l: 'Channel Swap', d: 0, n: 0, opts: pick(['RGB', 'RBG', 'GRB', 'GBR', 'BRG', 'BGR']) },
        amt('grunge', 'Grunge'),
      ],
    },
    {
      id: 'corrupt', title: 'Corrupt', hint: 'Codec damage: datamosh, macroblocks, slices, pixel smear, bit crush.',
      controls: [
        amt('mosh', 'Datamosh', 0, { dirt: 1 }),
        { k: 'moshBlock', l: 'Mosh Block Size', min: 0, max: 1, step: 0.01, d: 0.4 },
        { k: 'moshGain', l: 'Motion Gain', min: 0, max: 4, step: 0.01, d: 1.5 },
        { k: 'moshDrift', l: 'Drift', min: 0, max: 1, step: 0.01, d: 0.2 },
        { k: 'moshRefresh', l: 'Keyframes', min: 0, max: 1, step: 0.01, d: 0.1 },
        { k: 'moshResid', l: 'Residual', min: 0, max: 1, step: 0.01, d: 0.3 },
        amt('blockGlitch', 'Block Glitch', 0, { dirt: 1 }),
        amt('slices', 'Slice Shift', 0, { dirt: 1 }),
        amt('smear', 'Pixel Smear', 0, { dirt: 1 }),
        { k: 'smearThresh', l: 'Smear Threshold', min: 0, max: 1, step: 0.01, d: 0.6 },
        amt('compress', 'Compression', 0, { dirt: 1 }),
        amt('crush', 'Bit Crush'),
      ],
    },
    {
      id: 'bend', title: 'Circuit Bend', hint: 'A resonant, nonlinear stage that rings after edges and folds over.',
      controls: [
        amt('bend', 'Amount', 0, { dirt: 1 }),
        { k: 'bendMotion', l: 'Motion', min: -1, max: 1, step: 0.01, d: 0.2 },
        { k: 'bendFreq', l: 'Frequency', min: 0.05, max: 5.5, step: 0.01, d: 1.8, u: 'MHz' },
        { k: 'bendQ', l: 'Q', min: 0.25, max: 30, step: 0.05, d: 6 },
        { k: 'bendBoost', l: 'Boost', min: 0, max: 48, step: 0.5, d: 12, u: 'dB' },
        { k: 'bendLo', l: 'Threshold Low', min: -40, max: 160, step: 1, d: -40, u: 'IRE' },
        { k: 'bendHi', l: 'Threshold High', min: -40, max: 160, step: 1, d: 160, u: 'IRE' },
        { k: 'bendFb', l: 'Feedback', min: 0, max: 0.25, step: 0.005, d: 0.05 },
        { k: 'bendDelay', l: 'Feedback Delay', min: 0, max: 1.5, step: 0.01, d: 0.4, u: 'µs' },
      ],
    },
    {
      id: 'damage', title: 'Damage', hint: 'Time-base and tape faults: shake, tears, roll, dropouts.',
      controls: [
        amt('shake', 'Shake', 0, { dirt: 1 }),
        amt('tear', 'Tear', 0, { dirt: 1 }),
        amt('roll', 'Vertical Roll', 0, { dirt: 1 }),
        amt('flash', 'Exposure Flash', 0, { dirt: 1 }),
        amt('dropout', 'Dropouts', 0, { dirt: 1 }),
        { k: 'dropStyle', l: 'Dropout Style', d: 0, opts: pick(['White Streak', 'Black', 'Line Hold', 'Chroma Loss', 'TBC Tear']) },
        amt('hum', 'Hum Band', 0, { dirt: 1 }),
        { k: 'echo', l: 'Signal Echo', min: -1, max: 1, step: 0.01, d: 0, n: 0, dirt: 1 },
        amt('headSwitch', 'Head-Switch Band', 0, { dirt: 1 }),
        amt('topLine', 'Top-Line Spectral', 0, { dirt: 1 }),
      ],
    },
    {
      id: 'noise', title: 'Noise & Film', hint: 'Reception specks, tape grain, and film stock grain that clumps and breathes.',
      controls: [
        amt('film', 'Film Grain', 0.08),
        { k: 'filmSize', l: 'Grain Size', min: 0, max: 1, step: 0.01, d: 0.3 },
        { k: 'filmColor', l: 'Grain Color', min: 0, max: 1, step: 0.01, d: 0.3, u: 'mono → rgb' },
        { k: 'filmResp', l: 'Grain Response', min: 0, max: 1, step: 0.01, d: 0.5, u: 'shadows → highlights' },
        { k: 'filmVar', l: 'Grain Variation', min: 0, max: 1, step: 0.01, d: 0.3 },
        amt('dust', 'Dust & Scratches'),
        { k: 'dustOpacity', l: 'Dust Opacity', min: 0, max: 1, step: 0.01, d: 1 },
        amt('weave', 'Gate Weave'),
        amt('grain', 'Tape Grain', 0.04, { dirt: 1 }),
        amt('rf', 'RF Specks', 0, { dirt: 1 }),
        { k: 'speckOpacity', l: 'Speck Opacity', min: 0, max: 1, step: 0.01, d: 1 },
        { k: 'speckSize', l: 'Speck Size', min: 0, max: 1, step: 0.01, d: 0.3 },
      ],
    },
    {
      id: 'waves', title: 'Waves', hint: 'Modulation bands rolling through the picture. Raise Amount to engage.',
      controls: [
        amt('waves', 'Amount', 0, { dirt: 1 }),
        { k: 'waveCount', l: 'Band Count', min: 10, max: 150, step: 1, d: 40 },
        { k: 'waveReact', l: 'Picture React', min: 0, max: 0.3, step: 0.005, d: 0.05 },
        { k: 'waveSmooth', l: 'Smooth Bands', min: 0, max: 8, step: 0.1, d: 3 },
        { k: 'waveOrient', l: 'Orientation', d: 0, opts: pick(['Horizontal', 'Vertical']) },
        { k: 'waveColor', l: 'Color', d: 0, opts: pick(['Grayscale', 'RGB']) },
        { k: 'waveDir', l: 'Direction', d: 0, opts: pick(['Forward', 'Backward']) },
        { k: 'waveBlend', l: 'Blend', d: 1, opts: pick(['Normal', 'Multiply', 'Screen', 'Add']) },
      ],
    },
    {
      id: 'screen', title: 'Screen', hint: 'The tube face: phosphor mask, scanlines, refresh and beam. Push Mask Scale and Phosphor for big pixels.',
      controls: [
        { k: 'tint', l: 'Phosphor Color', d: 0, opts: pick(['Full Color', 'Green', 'Amber', 'White']) },
        { k: 'gamut', l: 'Tube Gamut', d: 1, n: 0, opts: pick(['Modern (sRGB)', 'P22 · D65', 'P22 · D93']) },
        { k: 'maskType', l: 'Screen Type', d: 1, opts: pick(['Slot Mask', 'Aperture Grille', 'Delta Dot', 'Fine Slot', 'Square Grid']) },
        { k: 'maskScale', l: 'Mask Scale', min: 0, max: 1, step: 0.01, d: 0.3 },
        { k: 'phosphor', l: 'Phosphor', min: 0, max: 1.5, step: 0.01, d: 0.55, n: 0 },
        amt('scanlines', 'Scanlines', 0.6),
        { k: 'refresh', l: 'Refresh', d: 59.94, opts: steps([50, 59.94, 60, 75, 85, 100, 120], ' Hz') },
        amt('persistence', 'Persistence', 0.1),
        amt('sync', 'Sync', 0, { dirt: 1 }),
        amt('ripple', 'Supply Ripple', 0, { dirt: 1 }),
        amt('flicker', 'Flicker', 0.03),
        { k: 'softness', l: 'Beam Softness', min: 0, max: 1, step: 0.01, d: 0.25 },
        amt('pbloom', 'Phosphor Bloom', 0.35),
        amt('overscan', 'Overscan', 0.08),
      ],
    },
    {
      id: 'capture', title: 'Capture', hint: 'A camera filming the tube: its sensor grid beats against the screen grid, and the moiré bends with the glass and the lens. Moiré Scale goes from single-pixel to chunky; Coverage is room light, so the moiré reaches dark areas. Plus the scan pulse.',
      controls: [
        amt('rainbow', 'Rainbow Moiré'),
        amt('moire', 'Moiré Bands'),
        { k: 'moireScale', l: 'Moiré Scale', min: 0, max: 1, step: 0.01, d: 0.25, u: 'single pixels → chunky' },
        { k: 'moireGrid', l: 'Moiré Grid', d: 0, opts: pick(['Pixel Grid', 'Aperture Grille', 'Slot Mask', 'Delta Dot', 'Same as Screen']) },
        { k: 'moireCells', l: 'Pixel Visibility', min: 0, max: 1, step: 0.01, d: 0.5 },
        { k: 'moireColor', l: 'Moiré Color', min: 0, max: 1, step: 0.01, d: 0.3 },
        { k: 'moireCover', l: 'Moiré Coverage', min: 0, max: 1, step: 0.01, d: 0.4, u: 'room light: lit areas → whole frame' },
        { k: 'moirePitch', l: 'Moiré Density', min: 0, max: 1, step: 0.01, d: 0.35 },
        { k: 'moireAngle', l: 'Moiré Angle', min: -45, max: 45, step: 0.1, d: 0, u: '°' },
        { k: 'moireRings', l: 'Moiré Rings', min: -1, max: 1, step: 0.01, d: 0.2 },
        { k: 'moireDrift', l: 'Moiré Drift', min: 0, max: 1, step: 0.01, d: 0.2 },
        amt('capture', 'Screen Pulse'),
        { k: 'shutter', l: 'Shutter', d: 48, opts: [24, 30, 48, 50, 60, 96, 120, 250, 500].map(v => ({ v, l: '1/' + v })) },
        { k: 'pulseContrast', l: 'Pulse Contrast', min: 0, max: 2, step: 0.01, d: 1 },
        { k: 'bandAngle', l: 'Band Angle', min: -90, max: 90, step: 1, d: 0, u: '°' },
        { k: 'readout', l: 'Sensor Readout', min: 0, max: 1.5, step: 0.01, d: 0 },
      ],
    },
    {
      id: 'convergence', title: 'Convergence', hint: 'Red, green and blue beams landing out of register.',
      controls: [
        amt('conv', 'Beam Convergence', 0.1),
        { k: 'convAngle', l: 'Converge Angle', min: 0, max: 360, step: 1, d: 0, u: '°' },
        amt('pconv', 'Phosphor Convergence'),
      ],
    },
    {
      id: 'glass', title: 'Glass & Optics', hint: 'Glow through the faceplate, curvature and lens warp.',
      controls: [
        amt('glow', 'Glow', 0.25),
        amt('spectral', 'Spectral Bloom', 0.08),
        amt('curve', 'Glass Curve', 0.25),
        amt('vignette', 'Vignette', 0.3),
        { k: 'stretch', l: 'Line Stretch', min: -1, max: 1, step: 0.01, d: 0, n: 0 },
        { k: 'fisheye', l: 'Fisheye', min: -1, max: 2, step: 0.01, d: 0, n: 0 },
        { k: 'outside', l: 'Outside Screen', d: 0, opts: pick(['Opaque', 'Transparent']) },
        { k: 'extend', l: 'Edges', d: 0, opts: pick(['Clip', 'Extend']) },
      ],
    },
  ];

  const ALL = [...MASTER, ...MACROS, ...GROUPS.flatMap(g => g.controls)];
  const DEFAULTS = {};
  const BY_KEY = {};
  ALL.forEach(c => { DEFAULTS[c.k] = c.d; BY_KEY[c.k] = c; });

  // Init: a blank slate to build a look from. Every control that has a neutral value (n, what it
  // takes when its module is switched off) is set to it; the rest only shape effects that are off.
  const INIT = Object.fromEntries(ALL.filter(c => c.n !== undefined).map(c => [c.k, c.n]));

  // Factory looks. Each is a full look laid over DEFAULTS, in a category from CATS.
  const PRESETS = [
    { cat: 'TV', name: 'Init', p: INIT },
    // TV: sets in a room, from studio monitors to arcade cabinets
    { cat: 'TV', name: 'Living Room Tube', p: { composite: 2, lumaBW: 2, maskType: 0, maskScale: 0.3, phosphor: 0.6, scanlines: 0.55, curve: 0.45, glow: 0.35, halation: 0.2, bleed: 0.3, conv: 0.15, spectral: 0.1, overscan: 0.12 } },
    { cat: 'TV', name: 'Broadcast Monitor', p: { composite: 1, maskType: 1, maskScale: 0.2, phosphor: 0.6, scanlines: 0.8, softness: 0.1, sharpen: 0.3, bleed: 0.05, curve: 0.08, glow: 0.15, conv: 0.03, rgbSplit: 0, overscan: 0.04 } },
    { cat: 'TV', name: 'Tokyo Trinitron', p: { gamut: 2, composite: 1, maskType: 1, maskScale: 0.25, phosphor: 0.65, scanlines: 0.6, curve: 0.18, stretch: 0.15, glow: 0.3, halation: 0.15, bleed: 0.15, chroma: 1.15, overscan: 0.06 } },
    { cat: 'TV', name: 'Arcade Cabinet', p: { maskType: 2, maskScale: 0.4, phosphor: 0.85, scanlines: 0.9, pbloom: 0.6, glow: 0.45, halation: 0.2, curve: 0.55, chroma: 1.3, gain: 1.1, spectral: 0.15, persistence: 0.2 } },
    { cat: 'TV', name: 'Console on Composite', p: { composite: 2, maskType: 0, maskScale: 0.35, phosphor: 0.7, scanlines: 0.85, bleed: 0.2, sharpen: 0.2, chroma: 1.2, curve: 0.35, glow: 0.3, halation: 0.15 } },
    { cat: 'TV', name: 'Big Pixel Max', p: { maskType: 1, maskScale: 1, phosphor: 1.5, scanlines: 0.9, softness: 0.1, pbloom: 0.7, glow: 0.6, halation: 0.3, curve: 0.35, vignette: 0.5, chroma: 1.3, gain: 1.25 } },
    { cat: 'TV', name: 'Pastel Dream', p: { chroma: 0.98, glow: 0.15, postGlow: 1, spectral: 0.6, halation: 0.45, softness: 0.7, bright: 0.13, contrast: 1.05, gain: 1.06, gamma: 0.97, scanlines: 0.3, hueDrift: 0.3, curve: 0.35 } },

    // Tape: videotape through a deck and a composite cable
    { cat: 'Tape', name: 'VHS Camcorder', p: { composite: 2, lumaBW: 4, bleed: 0.55, chroma: 0.9, grain: 0.35, headSwitch: 0.5, shake: 0.12, dropout: 0.1, sharpen: 0.4, hueDrift: 0.05, hum: 0.08, scanlines: 0.35, phosphor: 0.25, curve: 0.1, glow: 0.2, halation: 0.15, temp: 0.08 } },
    { cat: 'Tape', name: 'Rental Tape EP', p: { composite: 2, lumaBW: 4, bleed: 0.75, chroma: 0.7, grain: 0.6, dropout: 0.3, dropStyle: 0, tear: 0.12, headSwitch: 0.7, hum: 0.2, echo: 0.25, topLine: 0.3, sharpen: 0.5, shake: 0.2, scanlines: 0.35, phosphor: 0.25, curve: 0.15, lift: 0.03, contrast: 1.05 } },
    { cat: 'Tape', name: 'Betamax Archive', p: { composite: 2, lumaBW: 3, bleed: 0.45, chroma: 0.85, grain: 0.3, headSwitch: 0.3, sharpen: 0.2, hueDrift: 0.03, temp: 0.22, lift: 0.04, sat: 0.82, contrast: 0.94, shHue: 30, shAmt: 0.15, scanlines: 0.4, phosphor: 0.35, curve: 0.2, glow: 0.25 } },
    { cat: 'Tape', name: 'S-VHS Master', p: { composite: 1, lumaBW: 1, bleed: 0.15, chroma: 1.05, grain: 0.1, headSwitch: 0.2, sharpen: 0.35, contrast: 1.05, scanlines: 0.5, phosphor: 0.45, curve: 0.15, glow: 0.2 } },
    { cat: 'Tape', name: 'Haunted Tape', p: { composite: 2, lumaBW: 4, dropout: 0.35, dropStyle: 0, grain: 0.7, rf: 0.35, chroma: 0.4, echo: 0.6, hum: 0.4, shake: 0.25, headSwitch: 0.8, topLine: 0.5, flicker: 0.2, contrast: 1.2, bright: -0.05 } },
    { cat: 'Tape', name: 'Late Night Ad', p: { composite: 2, lumaBW: 2, chroma: 1.6, hueDrift: 0.15, bleed: 0.7, rgbSplit: 0.2, halation: 0.5, postGlow: 0.4, glow: 0.4, sharpen: 0.5, echo: 0.3, scanlines: 0.4, curve: 0.3, tear: 0.05 } },

    // Camera: the tube seen through a lens and a sensor
    { cat: 'Camera', name: 'Pixel Moiré', p: { rainbow: 0.85, moire: 0.3, moireScale: 0.07, moireGrid: 2, moireCells: 0.5, moireColor: 0.6, moireCover: 0.5, moirePitch: 0.2, moireAngle: 0, moireRings: 0.05, moireDrift: 0.15, scanlines: 0.6, bleed: 0.3, sharpen: 0.3, rgbSplit: 0.25, grain: 0.1, curve: 0.15, vignette: 0.4, glow: 0.2 } },
    { cat: 'Camera', name: 'Phone Off Screen', p: { maskType: 1, maskScale: 0.1, phosphor: 0.8, rainbow: 0.6, moire: 0.3, moireGrid: 4, moireCover: 0.3, moirePitch: 0.3, moireAngle: 2, moireRings: 0.35, moireDrift: 0.1, curve: 0.2, glow: 0.3, halation: 0.3, softness: 0.4, temp: 0.15, film: 0.1 } },
    { cat: 'Camera', name: 'Rainbow Grille', p: { maskType: 1, maskScale: 0.08, phosphor: 0.9, rainbow: 0.85, moire: 0.4, moireGrid: 4, moireCover: 0.2, moirePitch: 0.15, moireAngle: 0.5, moireRings: -0.5, moireDrift: 0.1, curve: 0.3, glow: 0.3, scanlines: 0.5 } },
    { cat: 'Camera', name: 'Filmed Off TV', p: { capture: 0.7, shutter: 48, refresh: 59.94, pulseContrast: 0.8, rainbow: 0.35, moire: 0.2, moireGrid: 4, moireCover: 0.2, moireDrift: 0.1, maskType: 0, maskScale: 0.12, phosphor: 0.8, scanlines: 0.7, curve: 0.5, glow: 0.4, conv: 0.25, overscan: 0.15, persistence: 0.3, film: 0.15 } },
    { cat: 'Camera', name: 'Rolling Shutter', p: { capture: 1, shutter: 250, refresh: 60, pulseContrast: 1.4, bandAngle: 12, readout: 0.4, persistence: 0.35, curve: 0.35, phosphor: 0.7, glow: 0.35 } },
    { cat: 'Camera', name: '16mm Print', p: { phosphor: 0, scanlines: 0, curve: 0, vignette: 0.55, conv: 0, bleed: 0.1, film: 0.6, filmSize: 0.6, filmColor: 0.45, filmVar: 0.7, dust: 0.45, weave: 0.5, halation: 0.35, glow: 0.2, temp: 0.15, lift: 0.04, contrast: 1.1, sat: 0.9, overscan: 0, gamut: 0 } },
    { cat: 'Camera', name: 'Night Shift', p: { composite: 2, lumaBW: 4, chroma: 0.15, gain: 1.3, grain: 0.55, rf: 0.15, sharpen: 0.6, scanlines: 0.5, hum: 0.35, shake: 0.05, contrast: 1.3, curve: 0.2, glow: 0.3, flicker: 0.2, bleed: 0.2 } },

    // Terminal: monitors for text
    { cat: 'Terminal', name: 'Terminal Glow', p: { scanlines: 0.8, softness: 0.1, maskScale: 0.2, phosphor: 0.2, glow: 0.55, postGlow: 0.35, halation: 0, spectral: 0, curve: 0.15, vignette: 1, flicker: 0.2, persistence: 0.3, bleed: 0.1, rgbSplit: 0, conv: 0, contrast: 1.15, gain: 1.1, sharpen: 0.3, film: 0.05, overscan: 0.05 } },
    { cat: 'Terminal', name: 'Green Phosphor', p: { tint: 1, scanlines: 0.8, softness: 0.15, maskScale: 0.2, phosphor: 0.2, glow: 0.6, postGlow: 0.4, curve: 0.2, vignette: 1, flicker: 0.15, persistence: 0.55, contrast: 1.2, gain: 1.1, sharpen: 0.4 } },
    { cat: 'Terminal', name: 'Amber Monitor', p: { tint: 2, scanlines: 0.85, softness: 0.15, maskScale: 0.2, phosphor: 0.15, glow: 0.5, postGlow: 0.3, curve: 0.3, vignette: 0.8, flicker: 0.15, persistence: 0.5, contrast: 1.1, gain: 1.05, sharpen: 0.25 } },
    { cat: 'Terminal', name: 'Paper White', p: { tint: 3, scanlines: 0.7, softness: 0.2, maskScale: 0.2, phosphor: 0.15, glow: 0.4, postGlow: 0.25, curve: 0.25, vignette: 0.7, flicker: 0.1, persistence: 0.2, contrast: 1.2, sharpen: 0.3 } },

    // Color: creative grades on a clean tube
    { cat: 'Color', name: 'Teal Night', p: { shHue: 190, shAmt: 0.55, hiHue: 40, hiAmt: 0.3, temp: -0.3, sat: 1.25, halation: 0.35, glow: 0.4, lift: 0.02 } },
    { cat: 'Color', name: 'Cross Processed', p: { cross: 0.85, sat: 1.35, contrast: 1.15, lift: 0.05, hiHue: 60, hiAmt: 0.2, film: 0.2 } },
    { cat: 'Color', name: 'Duotone', p: { gmap: 0.9, shHue: 255, hiHue: 25, contrast: 1.15, film: 0.15 } },
    { cat: 'Color', name: 'Bleach Bypass', p: { sat: 0.4, contrast: 1.45, lift: -0.04, temp: -0.1, film: 0.3, filmColor: 0, halation: 0.1 } },

    // Glitch: signals and codecs breaking
    { cat: 'Glitch', name: 'Datamosh Bloom', p: { mosh: 1, moshDrift: 0.5, moshGain: 2, moshRefresh: 0.03, moshResid: 0.25, moshBlock: 0.45, compress: 0.2, chroma: 1.3 } },
    { cat: 'Glitch', name: 'Bent Circuit', p: { bend: 0.6, bendFreq: 2.2, bendQ: 9, bendBoost: 18, bendMotion: 0.35, bendFb: 0.08, chroma: 1.4, scanlines: 0.5 } },
    { cat: 'Glitch', name: 'Loose Cable', p: { composite: 2, tear: 0.55, shake: 0.5, dropout: 0.4, dropStyle: 4, echo: 0.5, hum: 0.45, rf: 0.3, headSwitch: 0.6, rgbSplit: 0.3, sync: 0.5 } },
    { cat: 'Glitch', name: 'Chroma Storm', p: { composite: 2, hueDrift: 1, chroma: 2.2, rgbSplit: 0.6, bleed: 1, waves: 0.4, waveColor: 1, waveBlend: 3, waveCount: 80, conv: 0.6, convAngle: 45 } },
    { cat: 'Glitch', name: 'Feedback Bloom', p: { persistence: 0.85, bend: 0.35, bendFb: 0.22, bendDelay: 1.1, hueDrift: 0.6, glow: 0.7, spectral: 0.6, waves: 0.25, waveColor: 1, waveBlend: 2, waveCount: 25 } },
    { cat: 'Glitch', name: 'Lost Sync', p: { roll: 0.45, sync: 0.8, tear: 0.4, shake: 0.3, hum: 0.5, headSwitch: 0.5, flicker: 0.3 } },
  ];

  const CATS = ['TV', 'Tape', 'Camera', 'Terminal', 'Color', 'Glitch'];

  window.AtlasParams = { MASTER, MACROS, GROUPS, DEFAULTS, BY_KEY, PRESETS, CATS };
})();
