// Atlas CRT controls, quick macros and factory looks.
// Control fields: k key, l label, min/max/step, d default, n value when the module
// is switched off, u unit, opts for stepped choices, dirt = eased by Signal Clean.
(function () {
  const pick = (labels) => labels.map((l, v) => ({ v, l }));
  const steps = (vals, unit) => vals.map(v => ({ v, l: v + unit }));
  const amt = (k, l, d = 0, extra = {}) => ({ k, l, min: 0, max: 1, step: 0.01, d, n: 0, ...extra });

  const MASTER = [
    { k: 'mix', l: 'Intensity', min: 0, max: 1, step: 0.01, d: 1 },
    { k: 'bright', l: 'Brightness', min: -0.25, max: 0.25, step: 0.005, d: 0 },
    { k: 'contrast', l: 'Contrast', min: 0.5, max: 2.5, step: 0.01, d: 1 },
    { k: 'clean', l: 'Signal Clean', min: 0, max: 1, step: 0.01, d: 0 },
  ];

  // Quick macros scale whole families of controls away from (or toward) neutral.
  const MACROS = [
    { k: 'mTube', l: 'Tube', keys: ['phosphor', 'scanlines', 'maskScale', 'curve', 'vignette', 'fisheye'] },
    { k: 'mGlow', l: 'Glow', keys: ['glow', 'postGlow', 'halation', 'spectral', 'pbloom'] },
    { k: 'mMoire', l: 'Moiré', keys: ['moire', 'rainbow', 'capture'] },
    { k: 'mColor', l: 'Color', keys: ['chroma', 'hueDrift', 'bleed', 'rgbSplit', 'conv', 'hue', 'sat', 'temp', 'tintGM', 'shAmt', 'hiAmt', 'gmap', 'cross', 'solar', 'grunge'] },
    { k: 'mGrime', l: 'Grime', keys: ['shake', 'tear', 'roll', 'flash', 'dropout', 'hum', 'echo', 'headSwitch', 'topLine', 'rf', 'grain', 'film', 'dust', 'weave', 'sync', 'ripple', 'flicker'] },
    { k: 'mCorrupt', l: 'Corrupt', keys: ['mosh', 'blockGlitch', 'slices', 'smear', 'compress', 'crush', 'bend', 'waves'] },
  ].map((m) => ({ ...m, min: 0, max: 2, step: 0.01, d: 1 }));

  const GROUPS = [
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
      id: 'grade', title: 'Grade', hint: 'Creative color after the tube: split toning, curves, posterize, grunge.',
      controls: [
        { k: 'hue', l: 'Hue Shift', min: -180, max: 180, step: 1, d: 0, n: 0, u: '°' },
        { k: 'sat', l: 'Saturation', min: 0, max: 2, step: 0.01, d: 1, n: 1 },
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
        amt('weave', 'Gate Weave'),
        amt('grain', 'Tape Grain', 0.04, { dirt: 1 }),
        amt('rf', 'RF Specks', 0, { dirt: 1 }),
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
      id: 'capture', title: 'Capture', hint: 'A camera filming the tube: the sensor beating against the grille for rainbow bands and rings, plus the scan pulse.',
      controls: [
        amt('rainbow', 'Rainbow Moiré'),
        amt('moire', 'Moiré Bands'),
        { k: 'moirePitch', l: 'Moiré Density', min: 0, max: 1, step: 0.01, d: 0.35 },
        { k: 'moireAngle', l: 'Moiré Angle', min: -45, max: 45, step: 0.1, d: 3, u: '°' },
        { k: 'moireRings', l: 'Moiré Rings', min: -1, max: 1, step: 0.01, d: 0.2 },
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

  // Factory looks. Each is a full look laid over DEFAULTS, in a category from CATS:
  //   { cat: 'TV', name: 'My Look', p: { curve: 0.4, glow: 0.5 } }
  // Empty while the shaders are rebuilt; the previous looks are in docs/presets-pre-linear.js.
  const PRESETS = [];

  const CATS = [];

  window.AtlasParams = { MASTER, MACROS, GROUPS, DEFAULTS, BY_KEY, PRESETS, CATS };
})();
