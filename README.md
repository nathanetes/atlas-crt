# ATLAS CRT

A CRT and analog video emulator that runs in the browser. Drop in a photo or a video, dial in signal damage, phosphor masks, rainbow moiré, film grain, datamosh and creative color, then save a PNG or export an MP4.

Everything renders on the GPU with WebGL2, on your machine. Nothing is uploaded anywhere.

![Test card with the source on the left and the Terminal Glow look on the right](docs/compare.jpg)

## Run it

Atlas CRT lives at atlas-crt.nathanetes.com
You can access the latest release there.

## Using it

1. Click **$ open photo/video** or drag a file onto the preview. The app starts on a built-in test card so you can see the effects right away.
2. On the **looks** tab, pick a look and shape it with the six quick macros (tube, glow, moiré, color, grime, corrupt). Each one scales a whole family of controls, and 1.00 leaves the look as it is.
3. On the **adjust** tab, open any module for the full controls. Double-click a control to reset it.
4. Click **$ save still** for a PNG at the output size, or **$ export video** to record.

| Key | Action |
| --- | --- |
| Space | Play or pause |
| C | Compare: drag on the picture to move the split between source and result |
| Z | View output pixels at 100% |

**Raster** (under render on the looks tab) sets the resolution of the simulated signal: LO is 120 lines, SD is 240, HI is 480, and FULL works at the source resolution. **Out** sets the export size. The preview renders at screen resolution, so use 100% to check fine detail like the phosphor mask.

### Automation

Click **~** next to any slider to automate it. The slider then swings around the value you set, with a shape (sine, triangle, saw, square, random or drift), a rate from 0.02 to 10 Hz, and a depth. A marker on the slider shows the value being rendered right now. Automation runs on the effect clock, so exports match the preview, and saved looks keep it. The adjust tab lists everything that's automated.

## Modules

| Module | What it does |
| --- | --- |
| Color Signal | Brightness gain, chroma level, hue drift, chroma bleed, RGB split, sharpening, post glow, halation |
| Grade | Hue shift, saturation, temperature, tint, shadow and highlight toning, gradient map, cross process, black level, gamma, solarize, posterize, invert, channel swap, grunge |
| Corrupt | Datamosh (block size, motion gain, drift, keyframes, residual), block glitch, slice shift, pixel smear, compression, bit crush |
| Circuit Bend | A resonant stage that rings after edges and folds over. Frequency (MHz), Q, boost (dB), thresholds (IRE), feedback |
| Damage | Shake, tear, vertical roll, exposure flash, dropouts (5 styles), hum band, signal echo, head-switch band, top-line noise |
| Noise & Film | Film grain with size, mono-to-RGB color, shadow-to-highlight response and variation (clumping and breathing), dust and scratches, gate weave, tape grain, reception specks |
| Waves | Modulation bands with count, picture reaction, smoothing, direction and blend mode |
| Screen | Phosphor color, 5 mask types, mask scale (up to 36px triads) and phosphor strength (above 1 the gaps go black), scanlines, refresh rate, persistence, sync, supply ripple, flicker, beam softness, phosphor bloom, overscan |
| Capture | A camera sensor beating against the curved grille: rainbow moiré and moiré bands with density, angle and rings. Plus the scan pulse: shutter against refresh, band angle, rolling-shutter readout |
| Convergence | Red, green and blue beams landing out of register |
| Glass & Optics | Glow, spectral bloom, curvature, vignette, line stretch, fisheye, transparent outside area |

Each module has its own on/off switch and reset.

## Looks

35 factory looks in five groups: Terminal, Camera, TV, Color and Glitch. Save your own under **mine**. Saved looks keep settings and automation, and live in your browser's local storage.

![Living Room Tube, Bent Circuit, Filmed Off TV and Loose Cable](docs/looks.jpg)

*From top left: Living Room Tube, Bent Circuit, Filmed Off TV, Loose Cable.*

## Exporting

- **Video export runs in real time.** A two-minute clip takes two minutes. Keep the tab in front, because browsers pause rendering in background tabs.
- **The format depends on the browser.** Chrome, Edge and Safari record MP4 (H.264). Firefox records WebM.
- **Sound is included** when the source is a video.
- **Stills export as a clip** of the length you pick (5 to 30 seconds), with the effects moving.
- **Transparency** from the Outside Screen setting is kept in PNG stills only.

## How it works

Each frame runs through these stages:

1. **Datamosh** (only when it's on). The frame is split into blocks. Each block either refreshes from the new frame or drags the previous moshed frame along a motion vector estimated from the last two frames.
2. **Signal.** The source is drawn into a low-resolution raster in YIQ color, like a composite video signal. Timing errors, slices, macroblock glitches, compression, pixel smear, chroma bleed, circuit bending, dropouts, noise and waves happen here. The previous frame feeds back for phosphor persistence.
3. **Glow.** The signal is downsampled and blurred at two sizes (1/4 and 1/8 of the output), which feed the glow, halation and bloom.
4. **Screen.** The tube is drawn at output resolution: curvature and overscan, a beam per scanline that widens on bright lines, convergence error, the phosphor mask, glow, the camera scan pulse and sensor moiré. Then come the grade, the creative color, the phosphor color, film grain, dust and bit crush.

Masks finer than a screen pixel are drawn as their average in the fitted preview, so it never shows aliasing that the export won't have.

## Project structure

```
index.html       page, styles and markup
src/shaders.js        GLSL for the datamosh, signal and blur passes
src/screen-shader.js  GLSL for the screen pass, grade and film
src/engine.js         WebGL2 setup, render targets and the pass order
src/params.js         every control (range, default), the quick macros and the looks
src/app.js            automation, media loading, render loop, transport
src/rack.js           the control panel: tabs, macros, modules, automation, saved looks
src/export.js         PNG stills and video recording
docs/                 images for this README
```

### Adding a look

Add an entry to `PRESETS` in `src/params.js`. Any control you leave out uses its default.

```js
{ cat: 'TV', name: 'My Look', p: { curve: 0.4, glow: 0.5, scanlines: 0.7, maskType: 2 } },
```

Control keys and their ranges are listed at the top of `src/params.js`. `cat` must be one of the groups in `CATS` at the bottom of the same file. A look can also carry automation, as `auto: { glow: { shape: 'sine', rate: 0.5, depth: 0.3, phase: 0, seed: 1 } }`.

## Browser support

Atlas CRT needs WebGL2, which current Chrome, Edge, Safari and Firefox all support. It opens any video format the browser can decode: H.264 MP4 and WebM everywhere, and HEVC `.mov` in Safari and in Chrome on macOS.

The interface uses the Nathan Etes Terminal design system and the [VT323](https://fonts.google.com/specimen/VT323) typeface from Google Fonts.

CRT Effect made with Claude Ultracode ( because i do not know how to code )
