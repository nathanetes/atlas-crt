// Atlas CRT controls and factory looks.
// Control fields: k key, l label, min/max/step, d default, n value when the module
// is switched off, u unit, opts for stepped choices, dirt = eased by Signal Clean.
(function () {
  const pick = (labels) => labels.map((l, v) => ({ v, l }));
  const steps = (vals, unit) => vals.map(v => ({ v, l: v + unit }));

  const MASTER = [
    { k: 'mix', l: 'Dry / Wet', min: 0, max: 1, step: 0.01, d: 1 },
    { k: 'bright', l: 'Brightness', min: -0.25, max: 0.25, step: 0.005, d: 0 },
    { k: 'contrast', l: 'Contrast', min: 0.5, max: 2.5, step: 0.01, d: 1 },
    { k: 'clean', l: 'Signal Clean', min: 0, max: 1, step: 0.01, d: 0 },
  ];

  const GROUPS = [
    {
      id: 'color', title: 'Color Signal', hint: 'Composite decode: gain, chroma, bleed and glow in the signal path.',
      controls: [
        { k: 'gain', l: 'Brightness Gain', min: 0.4, max: 2, step: 0.01, d: 1.05, n: 1 },
        { k: 'chroma', l: 'Chroma Level', min: 0, max: 2.5, step: 0.01, d: 1.15, n: 1 },
        { k: 'hueDrift', l: 'Hue Drift', min: 0, max: 1.2, step: 0.01, d: 0.02, n: 0, dirt: 1 },
        { k: 'bleed', l: 'Chroma Bleed', min: 0, max: 1, step: 0.01, d: 0.35, n: 0, dirt: 1 },
        { k: 'rgbSplit', l: 'RGB Split', min: 0, max: 1, step: 0.01, d: 0.06, n: 0, dirt: 1 },
        { k: 'sharpen', l: 'Post Sharpen', min: 0, max: 1, step: 0.01, d: 0.2, n: 0 },
        { k: 'postGlow', l: 'Post Glow', min: 0, max: 1, step: 0.01, d: 0.15, n: 0 },
        { k: 'halation', l: 'Halation', min: 0, max: 1, step: 0.01, d: 0.2, n: 0 },
      ],
    },
    {
      id: 'bend', title: 'Circuit Bend', hint: 'A resonant, nonlinear stage that rings after edges and folds over.',
      controls: [
        { k: 'bend', l: 'Amount', min: 0, max: 1, step: 0.01, d: 0, n: 0, dirt: 1 },
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
        { k: 'shake', l: 'Shake', min: 0, max: 1, step: 0.01, d: 0.04, n: 0, dirt: 1 },
        { k: 'tear', l: 'Tear', min: 0, max: 1, step: 0.01, d: 0, n: 0, dirt: 1 },
        { k: 'roll', l: 'Vertical Roll', min: 0, max: 1, step: 0.01, d: 0, n: 0, dirt: 1 },
        { k: 'flash', l: 'Exposure Flash', min: 0, max: 1, step: 0.01, d: 0, n: 0, dirt: 1 },
        { k: 'dropout', l: 'Dropouts', min: 0, max: 1, step: 0.01, d: 0.05, n: 0, dirt: 1 },
        { k: 'dropStyle', l: 'Dropout Style', d: 0, opts: pick(['White Streak', 'Black', 'Line Hold', 'Chroma Loss', 'TBC Tear']) },
        { k: 'hum', l: 'Hum Band', min: 0, max: 1, step: 0.01, d: 0.08, n: 0, dirt: 1 },
        { k: 'echo', l: 'Signal Echo', min: -1, max: 1, step: 0.01, d: 0.05, n: 0, dirt: 1 },
        { k: 'headSwitch', l: 'Head-Switch Band', min: 0, max: 1, step: 0.01, d: 0.15, n: 0, dirt: 1 },
        { k: 'topLine', l: 'Top-Line Spectral', min: 0, max: 1, step: 0.01, d: 0, n: 0, dirt: 1 },
      ],
    },
    {
      id: 'noise', title: 'Noise', hint: 'Reception specks and tape grain.',
      controls: [
        { k: 'rf', l: 'RF Specks', min: 0, max: 1, step: 0.01, d: 0.04, n: 0, dirt: 1 },
        { k: 'speckSize', l: 'Speck Size', min: 0, max: 1, step: 0.01, d: 0.3 },
        { k: 'grain', l: 'Tape Grain', min: 0, max: 1, step: 0.01, d: 0.18, n: 0, dirt: 1 },
      ],
    },
    {
      id: 'waves', title: 'Waves', hint: 'Modulation bands rolling through the picture. Raise Amount to engage.',
      controls: [
        { k: 'waves', l: 'Amount', min: 0, max: 1, step: 0.01, d: 0, n: 0, dirt: 1 },
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
      id: 'screen', title: 'Screen', hint: 'The tube face: phosphor mask, scanlines, refresh and beam.',
      controls: [
        { k: 'tint', l: 'Phosphor Color', d: 0, opts: pick(['Full Color', 'Green', 'Amber', 'White']) },
        { k: 'maskType', l: 'Screen Type', d: 1, opts: pick(['Slot Mask', 'Aperture Grille', 'Delta Dot', 'Fine Slot', 'Square Grid']) },
        { k: 'maskScale', l: 'Mask Scale', min: 0, max: 1, step: 0.01, d: 0.35 },
        { k: 'phosphor', l: 'Phosphor', min: 0, max: 1, step: 0.01, d: 0.55, n: 0 },
        { k: 'scanlines', l: 'Scanlines', min: 0, max: 1, step: 0.01, d: 0.6, n: 0 },
        { k: 'refresh', l: 'Refresh', d: 59.94, opts: steps([50, 59.94, 60, 75, 85, 100, 120], ' Hz') },
        { k: 'persistence', l: 'Persistence', min: 0, max: 1, step: 0.01, d: 0.1, n: 0 },
        { k: 'sync', l: 'Sync', min: 0, max: 1, step: 0.01, d: 0, n: 0, dirt: 1 },
        { k: 'ripple', l: 'Supply Ripple', min: 0, max: 1, step: 0.01, d: 0, n: 0, dirt: 1 },
        { k: 'flicker', l: 'Flicker', min: 0, max: 1, step: 0.01, d: 0.05, n: 0 },
        { k: 'softness', l: 'Beam Softness', min: 0, max: 1, step: 0.01, d: 0.25 },
        { k: 'pbloom', l: 'Phosphor Bloom', min: 0, max: 1, step: 0.01, d: 0.35, n: 0 },
        { k: 'overscan', l: 'Overscan', min: 0, max: 1, step: 0.01, d: 0.1, n: 0 },
      ],
    },
    {
      id: 'capture', title: 'Capture', hint: 'A camera filming the tube: shutter against refresh, moiré, rainbow.',
      controls: [
        { k: 'capture', l: 'Screen Pulse', min: 0, max: 1, step: 0.01, d: 0, n: 0 },
        { k: 'shutter', l: 'Shutter', d: 48, opts: [24, 30, 48, 50, 60, 96, 120, 250, 500].map(v => ({ v, l: '1/' + v })) },
        { k: 'pulseContrast', l: 'Pulse Contrast', min: 0, max: 2, step: 0.01, d: 1 },
        { k: 'bandAngle', l: 'Band Angle', min: -90, max: 90, step: 1, d: 0, u: '°' },
        { k: 'readout', l: 'Sensor Readout', min: 0, max: 1.5, step: 0.01, d: 0 },
        { k: 'moire', l: 'Moiré', min: 0, max: 1, step: 0.01, d: 0, n: 0 },
        { k: 'rainbow', l: 'Rainbow', min: 0, max: 1, step: 0.01, d: 0, n: 0 },
      ],
    },
    {
      id: 'convergence', title: 'Convergence', hint: 'Red, green and blue beams landing out of register.',
      controls: [
        { k: 'conv', l: 'Beam Convergence', min: 0, max: 1, step: 0.01, d: 0.15, n: 0 },
        { k: 'convAngle', l: 'Converge Angle', min: 0, max: 360, step: 1, d: 0, u: '°' },
        { k: 'pconv', l: 'Phosphor Convergence', min: 0, max: 1, step: 0.01, d: 0, n: 0 },
      ],
    },
    {
      id: 'glass', title: 'Glass & Optics', hint: 'Glow through the faceplate, curvature and lens warp.',
      controls: [
        { k: 'glow', l: 'Glow', min: 0, max: 1, step: 0.01, d: 0.25, n: 0 },
        { k: 'spectral', l: 'Spectral Bloom', min: 0, max: 1, step: 0.01, d: 0.1, n: 0 },
        { k: 'curve', l: 'Glass Curve', min: 0, max: 1, step: 0.01, d: 0.25, n: 0 },
        { k: 'vignette', l: 'Vignette', min: 0, max: 1, step: 0.01, d: 0.3, n: 0 },
        { k: 'stretch', l: 'Line Stretch', min: -1, max: 1, step: 0.01, d: 0, n: 0 },
        { k: 'fisheye', l: 'Fisheye', min: -1, max: 2, step: 0.01, d: 0, n: 0 },
        { k: 'outside', l: 'Outside Screen', d: 0, opts: pick(['Opaque', 'Transparent']) },
        { k: 'extend', l: 'Edges', d: 0, opts: pick(['Clip', 'Extend']) },
      ],
    },
  ];

  const DEFAULTS = {};
  [...MASTER, ...GROUPS.flatMap(g => g.controls)].forEach(c => { DEFAULTS[c.k] = c.d; });

  // Factory looks. Each is a full look laid over DEFAULTS.
  const PRESETS = [
    { cat: 'Terminal', name: 'Terminal Glow', p: { scanlines: 0.8, softness: 0.1, maskType: 1, maskScale: 0.15, phosphor: 0.2, glow: 0.55, postGlow: 0.35, halation: 0, spectral: 0, curve: 0.15, vignette: 1, flicker: 0.2, persistence: 0.3, bleed: 0.1, rgbSplit: 0, conv: 0, contrast: 1.15, gain: 1.1, sharpen: 0.3, grain: 0.08, dropout: 0, headSwitch: 0, hum: 0.05, rf: 0, shake: 0.02, echo: 0, overscan: 0.05 } },
    { cat: 'Terminal', name: 'Green Screen Glitch', p: { tint: 1, scanlines: 0.8, softness: 0.15, maskType: 1, maskScale: 0.15, phosphor: 0.2, glow: 0.6, postGlow: 0.4, curve: 0.2, vignette: 1, flicker: 0.35, persistence: 0.45, contrast: 1.2, gain: 1.1, sharpen: 0.4, grain: 0.15, tear: 0.25, shake: 0.2, roll: 0, dropout: 0.2, dropStyle: 2, headSwitch: 0.3, hum: 0.2, rf: 0.08, sync: 0.3, bend: 0.2 } },
    { cat: 'Terminal', name: 'Amber Monitor', p: { tint: 2, scanlines: 0.85, softness: 0.15, maskType: 1, maskScale: 0.15, phosphor: 0.15, glow: 0.5, postGlow: 0.3, curve: 0.3, vignette: 0.8, flicker: 0.15, persistence: 0.5, contrast: 1.1, gain: 1.05, sharpen: 0.25, grain: 0.06, dropout: 0, headSwitch: 0, hum: 0.05, echo: 0 } },
    { cat: 'Terminal', name: 'Paper White', p: { tint: 3, scanlines: 0.7, softness: 0.2, maskType: 1, maskScale: 0.15, phosphor: 0.15, glow: 0.4, postGlow: 0.25, curve: 0.25, vignette: 0.7, flicker: 0.1, persistence: 0.2, contrast: 1.2, sharpen: 0.3, grain: 0.05, dropout: 0, headSwitch: 0, echo: 0 } },
    { cat: 'Camera', name: "Camcorder '94", p: { shake: 0.15, bleed: 0.6, chroma: 0.9, grain: 0.35, headSwitch: 0.55, sharpen: 0.45, dropout: 0.12, hum: 0.12, scanlines: 0.35, phosphor: 0.2, curve: 0.05, glow: 0.2, halation: 0.15, rgbSplit: 0.1, hueDrift: 0.05, echo: 0.15 } },
    { cat: 'Camera', name: 'Filmed Off TV', p: { capture: 0.7, shutter: 48, refresh: 59.94, pulseContrast: 0.8, moire: 0.35, rainbow: 0.15, curve: 0.55, glow: 0.45, phosphor: 0.8, maskScale: 0.55, scanlines: 0.7, conv: 0.3, spectral: 0.25, overscan: 0.2, persistence: 0.3, maskType: 0 } },
    { cat: 'Camera', name: 'Rolling Shutter', p: { capture: 1, shutter: 250, refresh: 60, pulseContrast: 1.4, bandAngle: 12, readout: 0.4, persistence: 0.35, curve: 0.35, phosphor: 0.7, glow: 0.35 } },
    { cat: 'Camera', name: 'Night Shift', p: { chroma: 0.15, gain: 1.3, grain: 0.55, rf: 0.15, sharpen: 0.6, scanlines: 0.5, hum: 0.35, shake: 0.05, contrast: 1.3, curve: 0.2, glow: 0.3, flicker: 0.2, bleed: 0.2 } },
    { cat: 'TV', name: 'Living Room Tube', p: { maskType: 0, curve: 0.45, glow: 0.35, halation: 0.3, bleed: 0.45, scanlines: 0.55, phosphor: 0.6, conv: 0.2, spectral: 0.15, overscan: 0.15 } },
    { cat: 'TV', name: 'Broadcast Monitor', p: { maskType: 1, maskScale: 0.2, phosphor: 0.65, scanlines: 0.85, softness: 0.05, bleed: 0.1, sharpen: 0.35, curve: 0.1, glow: 0.15, conv: 0.05, grain: 0.05, dropout: 0, hum: 0, headSwitch: 0, shake: 0, rf: 0, echo: 0 } },
    { cat: 'TV', name: 'Arcade Cabinet', p: { maskType: 2, maskScale: 0.6, phosphor: 0.8, scanlines: 0.9, pbloom: 0.6, glow: 0.5, halation: 0.25, curve: 0.6, chroma: 1.35, gain: 1.15, spectral: 0.2, headSwitch: 0, dropout: 0, grain: 0.05 } },
    { cat: 'TV', name: 'Late Night Ad', p: { chroma: 1.6, hueDrift: 0.15, bleed: 0.7, rgbSplit: 0.25, halation: 0.5, postGlow: 0.4, glow: 0.4, sharpen: 0.5, echo: 0.3, scanlines: 0.4, curve: 0.3, tear: 0.05 } },
    { cat: 'TV', name: 'Pastel Dream', p: { chroma: 0.85, glow: 0.8, postGlow: 0.6, spectral: 0.5, halation: 0.45, softness: 0.7, bright: 0.05, contrast: 0.85, scanlines: 0.3, hueDrift: 0.3, curve: 0.35 } },
    { cat: 'TV', name: 'Hot Screen', p: { flash: 0.35, flicker: 0.35, glow: 0.6, spectral: 0.6, pbloom: 0.8, contrast: 1.35, chroma: 1.5, scanlines: 0.7, phosphor: 0.7, maskScale: 0.45 } },
    { cat: 'Glitch', name: 'Bent Circuit', p: { bend: 0.6, bendFreq: 2.2, bendQ: 9, bendBoost: 18, bendMotion: 0.35, bendFb: 0.08, chroma: 1.4, scanlines: 0.5 } },
    { cat: 'Glitch', name: 'Loose Cable', p: { tear: 0.55, shake: 0.5, dropout: 0.4, dropStyle: 4, echo: 0.5, hum: 0.45, rf: 0.3, headSwitch: 0.6, rgbSplit: 0.3, sync: 0.5 } },
    { cat: 'Glitch', name: 'Overcooked', p: { sharpen: 1, contrast: 2, chroma: 2.3, gain: 1.4, bleed: 0.9, grain: 0.6, halation: 0.8, postGlow: 0.5, rgbSplit: 0.4, glow: 0.4, bend: 0.15 } },
    { cat: 'Glitch', name: 'Feedback Bloom', p: { persistence: 0.85, bend: 0.35, bendFb: 0.22, bendDelay: 1.1, hueDrift: 0.6, glow: 0.7, spectral: 0.6, waves: 0.25, waveColor: 1, waveBlend: 2, waveCount: 25 } },
    { cat: 'Glitch', name: 'Lost Sync', p: { roll: 0.45, sync: 0.8, tear: 0.4, shake: 0.3, hum: 0.5, headSwitch: 0.5, flicker: 0.3 } },
    { cat: 'Glitch', name: 'Chroma Storm', p: { hueDrift: 1, chroma: 2.2, rgbSplit: 0.6, bleed: 1, waves: 0.4, waveColor: 1, waveBlend: 3, waveCount: 80, conv: 0.6, convAngle: 45 } },
    { cat: 'Glitch', name: 'Haunted Tape', p: { dropout: 0.35, dropStyle: 0, grain: 0.7, rf: 0.35, chroma: 0.4, echo: 0.6, hum: 0.4, shake: 0.25, headSwitch: 0.8, topLine: 0.5, flicker: 0.2, contrast: 1.2, bright: -0.05 } },
    { cat: 'Glitch', name: 'Rainbow Moiré', p: { capture: 0.6, moire: 0.7, rainbow: 0.9, spectral: 0.7, maskScale: 0.8, phosphor: 0.9, maskType: 3, curve: 0.5, glow: 0.4 } },
  ];

  window.AtlasParams = { MASTER, GROUPS, DEFAULTS, PRESETS };
})();
