// Atlas CRT controls, quick macros and factory looks.
// Control fields: k key, l label, min/max/step, d default, n value when the module
// is switched off, u unit, opts for stepped choices, dirt = eased by Signal Clean, pow = the slider
// follows this power curve so small values get most of its travel, dp = decimals shown, tape = a
// setting of the tape stage, which Init and Randomize leave alone.
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
    { k: 'mGrime', l: 'Grime', keys: ['shake', 'tear', 'roll', 'flash', 'dropout', 'hum', 'echo', 'headSwitch', 'topLine', 'rf', 'grain', 'film', 'dust', 'scratch', 'weave', 'sync', 'ripple', 'flicker', 'vhs'] },
    { k: 'mCorrupt', l: 'Corrupt', keys: ['mosh', 'blockGlitch', 'slices', 'smear', 'compress', 'crush', 'bend', 'waves'] },
  ].map((m) => ({ ...m, min: 0, max: 2, step: 0.01, d: 1 }));

  // the tape stage's controls, which match ntsc-rs's own settings, ranges and defaults
  const tape = (k, l, min, max, step, d, extra = {}) => ({ k, l, min, max, step, d, tape: 1, ...extra });
  const onOff = pick(['Off', 'On']);

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
      id: 'vhs', title: 'VHS Tape', hint: 'The real ntsc-rs engine: the picture goes onto a tape before it reaches the TV. Raise VHS Amount to play it. Runs at 30 frames a second, and at 480 lines the raster opens up to show them.',
      controls: [
        amt('vhs', 'VHS Amount'),
        { k: 'vhsSpeed', l: 'Tape Speed', d: 2, n: 0, tape: 1, opts: pick(['Off', 'SP', 'LP', 'EP']) },
        tape('vhsEdge', 'Edge Wave', 0, 20, 0.01, 0.5, { n: 0 }),
        tape('vhsEdgeSpeed', 'Edge Wave Speed', 0, 10, 0.01, 4),
        tape('vhsEdgeFreq', 'Edge Wave Frequency', 0, 0.5, 0.005, 0.05),
        tape('vhsEdgeDetail', 'Edge Wave Detail', 1, 5, 1, 2),
        tape('vhsHead', 'Head Switching', 0, 24, 1, 8, { n: 0 }),
        tape('vhsHeadOffset', 'Head Offset', 0, 24, 1, 3),
        tape('vhsHeadShift', 'Head Shift', -100, 100, 0.5, 72),
        { k: 'vhsMid', l: 'Start Mid-Line', d: 1, tape: 1, opts: onOff },
        tape('vhsMidPos', 'Mid-Line Position', 0, 1, 0.01, 0.95),
        tape('vhsMidJitter', 'Mid-Line Jitter', 0, 1, 0.001, 0.03, { pow: 3, dp: 3 }),
        tape('vhsTrack', 'Tracking Noise', 0, 120, 1, 12, { n: 0 }),
        tape('vhsTrackWave', 'Tracking Wave', -50, 50, 0.5, 15),
        tape('vhsTrackSnow', 'Tracking Snow', 0, 1, 0.001, 0.025, { pow: 3, dp: 3 }),
        tape('vhsTrackAniso', 'Tracking Anisotropy', 0, 1, 0.01, 0.25),
        tape('vhsTrackNoise', 'Tracking Static', 0, 1, 0.001, 0.25, { pow: 2, dp: 3 }),
        tape('vhsLoss', 'Chroma Loss', 0, 1, 0.00001, 0.000025, { pow: 5, dp: 6 }),
        tape('vhsSharpen', 'Sharpen', 0, 5, 0.01, 0.25, { n: 0 }),
        tape('vhsSharpenFreq', 'Sharpen Frequency', 0.5, 4, 0.01, 1),
        { k: 'vhsBlend', l: 'Vertical Chroma Blend', d: 0, tape: 1, opts: onOff },
      ],
    },
    {
      id: 'ntsc', title: 'NTSC Signal', hint: 'How the tape stage encodes the picture onto a composite signal and decodes it again. With Tape Speed off, this is broadcast NTSC alone.',
      controls: [
        { k: 'vhsLines', l: 'Scanlines', d: 480, tape: 1, opts: steps([240, 360, 480, 576, 720], ' lines') },
        { k: 'vhsField', l: 'Fields', d: 4, tape: 1, opts: pick(['Alternating', 'Upper Only', 'Lower Only', 'Both', 'Interleaved, Upper First', 'Interleaved, Lower First']) },
        { k: 'vhsFilter', l: 'Filter Type', d: 1, tape: 1, opts: pick(['Constant K (Blurry)', 'Butterworth (Sharper)']) },
        { k: 'vhsLumaIn', l: 'Input Luma Filter', d: 2, tape: 1, opts: pick(['None', 'Box', 'Notch']) },
        { k: 'vhsChromaIn', l: 'Chroma Low-Pass In', d: 2, tape: 1, opts: pick(['None', 'Light', 'Full']) },
        { k: 'vhsChromaOut', l: 'Chroma Low-Pass Out', d: 2, tape: 1, opts: pick(['None', 'Light', 'Full']) },
        { k: 'vhsDemod', l: 'Chroma Demodulation', d: 1, tape: 1, opts: pick(['Box', 'Notch', '1-Line Comb', '2-Line Comb', '2D', '2D Adaptive']) },
        tape('vhsPreemph', 'Composite Sharpening', -1, 2, 0.01, 1, { n: 0 }),
        tape('vhsCompNoise', 'Composite Noise', 0, 1, 0.001, 0.05, { n: 0, pow: 2, dp: 3 }),
        tape('vhsCompFreq', 'Composite Frequency', 0, 1, 0.01, 0.5),
        tape('vhsCompDetail', 'Composite Detail', 1, 5, 1, 1),
        tape('vhsSnow', 'Snow', 0, 100, 0.00001, 0.00025, { n: 0, pow: 6, dp: 5 }),
        tape('vhsSnowAniso', 'Snow Anisotropy', 0, 1, 0.01, 0.5),
        tape('vhsSmear', 'Luma Smear', 0, 1, 0.01, 0.5, { n: 0 }),
        tape('vhsRing', 'Ringing', 0, 10, 0.01, 4, { n: 0 }),
        tape('vhsRingFreq', 'Ringing Frequency', 0, 1, 0.01, 0.45),
        tape('vhsRingPower', 'Ringing Power', 1, 10, 0.01, 4),
        tape('vhsLumaNoise', 'Luma Noise', 0, 1, 0.001, 0.01, { n: 0, pow: 2, dp: 3 }),
        tape('vhsLumaFreq', 'Luma Noise Frequency', 0, 1, 0.01, 0.5),
        tape('vhsLumaDetail', 'Luma Noise Detail', 1, 5, 1, 1),
        tape('vhsChromaNoise', 'Chroma Noise', 0, 1, 0.001, 0.1, { n: 0, pow: 2, dp: 3 }),
        tape('vhsChromaFreq', 'Chroma Noise Frequency', 0, 0.5, 0.005, 0.05),
        tape('vhsChromaDetail', 'Chroma Noise Detail', 1, 5, 1, 2),
        tape('vhsPhaseError', 'Chroma Phase Error', 0, 1, 0.01, 0, { n: 0 }),
        tape('vhsPhaseNoise', 'Chroma Phase Noise', 0, 1, 0.0001, 0.001, { n: 0, pow: 3, dp: 4 }),
        tape('vhsDelayH', 'Chroma Delay', -40, 40, 0.1, 0, { n: 0 }),
        tape('vhsDelayV', 'Chroma Vertical Delay', -20, 20, 1, 0, { n: 0 }),
        tape('vhsBandwidth', 'Bandwidth Scale', 0.125, 8, 0.005, 1),
        tape('vhsVScale', 'Vertical Scale', 0.125, 8.8, 0.005, 1),
        tape('vhsSeed', 'Random Seed', 0, 9999, 1, 0),
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
        { k: 'smearDir', l: 'Smear Direction', min: 0, max: 360, step: 1, d: 0, u: '°' },
        { k: 'smearThresh', l: 'Smear Threshold', min: 0, max: 1, step: 0.01, d: 0.6 },
        amt('compress', 'Compression', 0, { dirt: 1 }),
        amt('crush', 'Bit Crush'),
      ],
    },
    {
      id: 'bend', title: 'Circuit Bend', hint: 'A resonant, nonlinear stage that rings after edges and folds over.',
      controls: [
        amt('bend', 'Amount', 0, { dirt: 1 }),
        { k: 'bendDir', l: 'Direction', min: 0, max: 360, step: 1, d: 0, u: '°' },
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
        amt('dust', 'Dust'),
        amt('scratch', 'Scratches'),
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
        { k: 'drive', l: 'Tube Drive', min: 0.5, max: 2, step: 0.01, d: 1.3, n: 1, u: 'true level at 1.00' },
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
        { k: 'moireCurve', l: 'Tube Curvature', min: 0, max: 1, step: 0.01, d: 0.65 },
        { k: 'moireView', l: 'Camera Position', min: -1, max: 1, step: 0.01, d: 0, u: 'left → right' },
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
  // The tape's settings keep their defaults, so raising VHS Amount from Init plays a real tape.
  const INIT = Object.fromEntries(ALL.filter(c => c.n !== undefined && !c.tape).map(c => [c.k, c.n]));

  // a slow random LFO that glides from value to value, for a factory look
  const wander = (rate, depth, seed) => ({ mode: 'lfo', lfo: { wave: 'random', rate, depth, smooth: 1, seed } });

  // the tape on its own, with the tube out of the way, and the same tape played on a TV
  const TAPE = { ...INIT, vhs: 1 };
  const TAPE_ON_TV = { ...TAPE, gamut: 1, maskType: 0, maskScale: 0.3, phosphor: 0.5, scanlines: 0.45, curve: 0.3, glow: 0.3, halation: 0.15, vignette: 0.3, overscan: 0.08 };

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

    // Tape: videotape through a deck and a composite cable. The first group runs on ntsc-rs itself.
    { cat: 'Tape', name: 'VHS Tape', p: TAPE },
    { cat: 'Tape', name: 'VHS SP', p: { ...TAPE, vhsSpeed: 1, vhsEdge: 0.25, vhsHead: 6, vhsTrack: 8, vhsTrackNoise: 0.15, vhsChromaNoise: 0.06, vhsLumaNoise: 0.006 } },
    { cat: 'Tape', name: 'VHS EP', p: { ...TAPE, vhsSpeed: 3, vhsEdge: 1, vhsTrack: 18, vhsTrackNoise: 0.4, vhsChromaNoise: 0.18, vhsLumaNoise: 0.02, vhsLoss: 0.0008, vhsPhaseNoise: 0.004 } },
    { cat: 'Tape', name: 'Living Room VHS', p: { ...TAPE_ON_TV, vhsSpeed: 2 } },
    { cat: 'Tape', name: 'VHS Camcorder', p: { ...TAPE, vhsSpeed: 1, vhsEdge: 0.4, vhsSmear: 0.4, vhsHead: 8, vhsHeadShift: 60, vhsTrack: 10, vhsTrackNoise: 0.2, vhsChromaNoise: 0.12, temp: 0.08, shake: 0.08 } },
    { cat: 'Tape', name: 'Rental Tape EP', p: { ...TAPE_ON_TV, vhsSpeed: 3, vhsEdge: 1.6, vhsHead: 10, vhsHeadShift: 90, vhsTrack: 28, vhsTrackWave: 22, vhsTrackNoise: 0.5, vhsTrackSnow: 0.06, vhsSnow: 0.002, vhsChromaNoise: 0.25, vhsLumaNoise: 0.025, vhsLoss: 0.002, vhsPhaseNoise: 0.01 } },
    { cat: 'Tape', name: 'Tracking Error', p: { ...TAPE, vhsSpeed: 2, vhsEdge: 2.5, vhsEdgeSpeed: 6, vhsTrack: 90, vhsTrackWave: 40, vhsTrackNoise: 0.7, vhsTrackSnow: 0.25, vhsTrackAniso: 0.6, vhsSnow: 0.004, vhsHead: 12, vhsLoss: 0.004 } },
    { cat: 'Tape', name: 'Haunted Tape', p: { ...TAPE, vhsSpeed: 3, vhsEdge: 3, vhsEdgeFreq: 0.09, vhsTrack: 60, vhsTrackWave: 30, vhsTrackNoise: 0.6, vhsTrackSnow: 0.15, vhsSnow: 0.01, vhsLoss: 0.01, vhsChromaNoise: 0.35, vhsPhaseNoise: 0.02, chroma: 0.5, contrast: 1.2, bright: -0.05, flicker: 0.2 } },
    { cat: 'Tape', name: 'Broadcast NTSC', p: { ...TAPE, vhsSpeed: 0, vhsEdge: 0, vhsHead: 0, vhsTrack: 0, vhsDemod: 3, vhsCompNoise: 0.02, vhsChromaNoise: 0.04, vhsLumaNoise: 0.004, vhsPhaseNoise: 0.0005 } },
    { cat: 'Tape', name: 'Betamax Archive', p: { composite: 2, lumaBW: 3, bleed: 0.45, chroma: 0.85, grain: 0.3, headSwitch: 0.3, sharpen: 0.2, hueDrift: 0.03, temp: 0.22, lift: 0.04, sat: 0.82, contrast: 0.94, shHue: 30, shAmt: 0.15, scanlines: 0.4, phosphor: 0.35, curve: 0.2, glow: 0.25 } },
    { cat: 'Tape', name: 'S-VHS Master', p: { composite: 1, lumaBW: 1, bleed: 0.15, chroma: 1.05, grain: 0.1, headSwitch: 0.2, sharpen: 0.35, contrast: 1.05, scanlines: 0.5, phosphor: 0.45, curve: 0.15, glow: 0.2 } },
    { cat: 'Tape', name: 'Late Night Ad', p: { composite: 2, lumaBW: 2, chroma: 1.6, hueDrift: 0.15, bleed: 0.7, rgbSplit: 0.2, halation: 0.5, postGlow: 0.4, glow: 0.4, sharpen: 0.5, echo: 0.3, scanlines: 0.4, curve: 0.3, tear: 0.05 } },

    // Camera: the tube seen through a lens and a sensor
    { cat: 'Camera', name: 'Pixel Moiré', p: { rainbow: 0.85, moire: 0.3, moireScale: 0.07, moireGrid: 2, moireCells: 0.5, moireColor: 0.6, moireCover: 0.5, moirePitch: 0.2, moireAngle: 0, moireRings: 0.05, moireDrift: 0.15, scanlines: 0.6, bleed: 0.3, sharpen: 0.3, rgbSplit: 0.25, grain: 0.1, curve: 0.15, vignette: 0.4, glow: 0.2 } },
    { cat: 'Camera', name: 'Moiré Screen', p: { rainbow: 1, moire: 0.5, moireScale: 0.14, moireGrid: 1, moireCells: 0.1, moireColor: 1, moireCover: 0.8, moirePitch: 0.06, moireAngle: 0, moireCurve: 0.5, moireView: 0, moireRings: 0, moireDrift: 0.1, scanlines: 0.5, curve: 0.15, vignette: 0.35, glow: 0.2 },
      auto: { moireAngle: wander(0.27, 0.09, 3.1), moireCurve: wander(0.19, 0.42, 5.7), moireView: wander(0.23, 0.55, 8.2), moireRings: wander(0.21, 0.5, 11.4) } },
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
