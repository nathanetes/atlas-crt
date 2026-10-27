# ATLAS CRT

A CRT and analog video emulator that runs in the browser. Drop in a photo or a video, dial in composite and tape signal, interlacing, phosphor masks, rainbow moiré, film grain, datamosh and creative color, then save a PNG or export an MP4.

Everything renders on the GPU with WebGL2, on your machine. Nothing is uploaded anywhere.

![Test card with the source on the left and a CRT look on the right, from an earlier version](docs/compare.jpg)

## Run it

Atlas CRT lives at atlas-crt.nathanetes.com
You can access the latest release there.

## Using it

1. Click **$ open photo/video** or drag a file onto the preview. The app starts on a built-in test card with the default settings, so you can see the effects right away.
2. On the **looks** tab, shape the picture with the six quick macros (tube, glow, moiré, color, grime, corrupt). Each one scales a whole family of controls, and 1.00 leaves the look as it is. Looks you save appear here too.
3. On the **adjust** tab, open any module for the full controls. Double-click a control to reset it.
4. Click **$ save still** for a PNG at the output size, or **$ export video** to record.

| Key | Action |
| --- | --- |
| Space | Play or pause |
| C | Compare: drag on the picture to move the split between source and result |
| Z | View output pixels at 100% |

**Raster** (under render on the looks tab) sets the resolution of the simulated signal: LO is 120 lines, SD is 240, HI is 480, and FULL works at the source resolution. **480i** is 480 lines drawn as two interlaced fields, one per frame: anything moving shows combing on its edges, and detail one line tall flickers (line twitter), as on an interlaced TV. Exports get one field per frame too. **Out** sets the export size. The preview renders at screen resolution, so use 100% to check fine detail like the phosphor mask.

### Keyframes

Click **◆** next to any slider to keyframe it. A lane opens under the slider with its keyframes and the playhead. Move the playhead (with the scrub bar, or by clicking the lane), set the slider, and that value is keyed there. Dragging a slider while the clip plays edits a single keyframe. Click a keyframe to jump to it, drag it to retime it, use **<** and **>** to step between keyframes, **key** to key the current value, and **del** to remove the selected one.

The curve under the lane shapes the move from the selected keyframe to the next. Drag its two handles (a cubic Bézier, as in CSS easing) or pick a preset: ease in-out, linear, ease in, ease out, snap, overshoot or hold. The solid line is the value over the move, and the dashed line is its speed.

Videos keyframe on their own time. Photos and the test card get a timeline that loops every 10 seconds, or longer to fit the last keyframe. Exports play the same timeline from the start, and saved looks keep their keyframes. The adjust tab lists every keyframed control, and **stop** removes a control's keyframes and keeps the value it was showing.

## Modules

| Module | What it does |
| --- | --- |
| Pre Grade | Exposure, brightness, contrast, saturation, temperature, tint and hue on the source, before it reaches the tube |
| Color Signal | Signal path (RGB, S-Video or composite), luma bandwidth, brightness gain, chroma level, hue drift, chroma bleed, RGB split, sharpening, post glow, halation |
| Post Grade | Exposure, brightness, contrast, saturation, hue shift, temperature and tint on the finished picture, then shadow and highlight toning, gradient map, cross process, black level, gamma, solarize, posterize, invert, channel swap, grunge |
| Corrupt | Datamosh (block size, motion gain, drift, keyframes, residual), block glitch, slice shift, pixel smear, compression, bit crush |
| Circuit Bend | A resonant stage that rings after edges and folds over. Frequency (MHz), Q, boost (dB), thresholds (IRE), feedback |
| Damage | Shake, tear, vertical roll, exposure flash, dropouts (5 styles), hum band, signal echo, head-switch band, top-line noise |
| Noise & Film | Film grain with size, mono-to-RGB color, shadow-to-highlight response and variation (clumping and breathing), dust and scratches with their own opacity, gate weave, tape grain in horizontal streaks, reception specks with their own opacity |
| Waves | Modulation bands with count, picture reaction, smoothing, direction and blend mode |
| Screen | Phosphor color, tube gamut, 5 mask types, mask scale (up to 36px triads) and phosphor strength (above 1 the gaps go black), scanlines, refresh rate, persistence, sync, supply ripple, flicker, beam softness, phosphor bloom, overscan |
| Capture | A camera filming the tube. Its sensor beats against a grid on the curved glass, so the rainbow fringes warp with the glass and the lens: rainbow moiré, moiré bands, moiré scale (single pixels to chunky), grid pattern, pixel visibility, moiré color, coverage (room light that carries the fringes into dark areas), tube curvature (how far the glass bulges toward the camera, which bends the fringes into rings toward the sides), camera position (left to right), density, angle, rings and drift. Works with or without the Screen mask. Plus the scan pulse: shutter against refresh, band angle, rolling-shutter readout |
| Convergence | Red, green and blue beams landing out of register |
| Glass & Optics | Glow with a long, soft tail, spectral bloom, curvature, vignette, line stretch, fisheye, transparent outside area |

Each module has its own on/off switch and reset.

### Signal and tube controls

- **Signal Path** (Color Signal): **RGB** keeps the picture clean. **S-Video** carries color on its own wire at reduced bandwidth. **Composite** puts color on a 3.58 MHz subcarrier mixed into the picture and decodes it again the way an inexpensive TV did, so fine detail turns into rainbow color (cross-color) and color edges get crawling dots (dot crawl).
- **Luma Bandwidth** (Color Signal): limits horizontal sharpness to a format's resolution: S-VHS (about 400 TV lines), broadcast NTSC (about 330), Betamax (about 250) or VHS (about 240). Post Sharpen then rings at the tape's own scale, like a deck's detail enhancer.
- **Tube Gamut** (Screen): **P22 · D65** (the default) shows color through CRT phosphors with a standard white point. **P22 · D93** adds the bluish white of many Japanese and consumer sets. **Modern (sRGB)** turns it off.
- **Persistence** (Screen): each phosphor fades at its own rate, so trails behind bright moving things lean red.

## Looks

33 factory looks in six groups, built for the linear-light renderer, plus **Init** at the top of TV: every effect off, a blank slate to build your own look from. The app opens on Init the first time; after that it reopens on whatever you were last using.

- **TV:** Living Room Tube, Broadcast Monitor, Tokyo Trinitron, Arcade Cabinet, Console on Composite, Big Pixel Max, Pastel Dream
- **Tape:** VHS Camcorder, Rental Tape EP, Betamax Archive, S-VHS Master, Haunted Tape, Late Night Ad
- **Camera:** Phone Off Screen, Rainbow Grille, Filmed Off TV, Rolling Shutter, 16mm Print, Night Shift
- **Terminal:** Terminal Glow, Green Phosphor, Amber Monitor, Paper White
- **Color:** Teal Night, Cross Processed, Duotone, Bleach Bypass
- **Glitch:** Datamosh Bloom, Bent Circuit, Loose Cable, Chroma Storm, Feedback Bloom, Lost Sync

Looks don't change the raster, so pick **480i** yourself for interlaced footage. Save your own looks under **mine**. Saved looks keep settings and keyframes, and live in your browser's local storage. The looks from before the linear-light renderer are kept for reference in `docs/presets-pre-linear.js`; the app doesn't load them.

## Exporting

- **Video export runs in real time.** A two-minute clip takes two minutes. Keep the tab in front, because browsers pause rendering in background tabs.
- **The format depends on the browser.** Chrome, Edge and Safari record MP4 (H.264). Firefox records WebM.
- **Sound is included** when the source is a video.
- **Stills export as a clip** of the length you pick (5 to 30 seconds), with the effects moving.
- **Transparency** from the Outside Screen setting is kept in PNG stills only.

## How it works

Each frame runs through these stages:

1. **Pre grade** (only when it changes something). The source is graded before anything else sees it.
2. **Datamosh** (only when it's on). The frame is split into blocks. Each block either refreshes from the new frame or drags the previous moshed frame along a motion vector estimated from the last two frames.
3. **Signal.** The source is drawn into a low-resolution raster in YIQ color, like a video signal. Luma band-limiting, timing errors, slices, macroblock glitches, compression, pixel smear, chroma bleed, circuit bending, dropouts, noise and waves happen here. The previous frame feeds back for phosphor persistence. In 480i, each frame redraws only one field and keeps the other from the frame before.
4. **Composite** (only with S-Video or Composite selected). The raster is encoded onto a color subcarrier at 752 samples per line (188 subcarrier cycles, 4 samples each) and decoded again, which produces cross-color and dot crawl.
5. **Glow.** The picture is converted to linear light, downsampled and blurred at four sizes (1/4, 1/8, 1/16 and 1/32 of the output), which feed the glow, its long tail, halation and bloom.
6. **Screen.** The tube is drawn at output resolution in linear light, so light adds up as it does on a real screen: curvature and overscan, a beam per scanline that widens on bright lines, convergence error, the phosphor mask, glow and the tube gamut. Where moiré is on, a camera at export resolution photographs the grid and raster lines through a Bayer filter, and that photo multiplies the picture. Each photosite traces a ray to the curved glass (a sphere, or a cylinder for an aperture grille) and reads the grid where the ray lands, measured along the glass. The result is converted back to display values for the camera scan pulse, the post grade, creative color, monochrome phosphor tint, film grain, dust and bit crush, and a light dither keeps dark gradients from banding.

Masks finer than a screen pixel are drawn as their average in the fitted preview, so it never shows aliasing that the export won't have.

## Project structure

```
index.html       page, styles and markup
src/shaders.js        GLSL for the datamosh, signal, composite and blur passes
src/screen-shader.js  GLSL for the screen pass, grade and film
src/engine.js         WebGL2 setup, render targets and the pass order
src/params.js         every control (range, default), the quick macros and the looks
src/app.js            keyframes and the timeline, media loading, render loop, transport
src/rack.js           the control panel: tabs, macros, modules, keyframe lanes and curves, saved looks
src/export.js         PNG stills and video recording
docs/                 images for this README, the previous factory looks, third-party licenses
```

### Adding a look

Add an entry to `PRESETS` in `src/params.js`, and add its group name to `CATS` in the same file. Any control you leave out uses its default.

```js
{ cat: 'TV', name: 'My Look', p: { curve: 0.4, glow: 0.5, scanlines: 0.7, maskType: 2 } },
```

Control keys and their ranges are listed at the top of `src/params.js`. A look can also carry keyframes, as `auto: { glow: { keys: [{ t: 0, v: 0.2, ease: [0.42, 0, 0.58, 1] }, { t: 4, v: 0.8, ease: 'hold' }] } }`. `t` is in seconds, and `ease` is the curve out of that keyframe: the two handles of a cubic Bézier, or `'hold'`.

## Browser support

Atlas CRT needs WebGL2, which current Chrome, Edge, Safari and Firefox all support. It opens any video format the browser can decode: H.264 MP4 and WebM everywhere, and HEVC `.mov` in Safari and in Chrome on macOS.

The interface uses the Nathan Etes Terminal design system and the [VT323](https://fonts.google.com/specimen/VT323) typeface from Google Fonts.

## Credits

The composite video encode and decode follows the approach of [Cathode Retro](https://github.com/DeadlyRedCube/Cathode-Retro) by DeadlyRedCube. Its license and notice are in [docs/licenses/cathode-retro.txt](docs/licenses/cathode-retro.txt).

CRT Effect made with Claude Ultracode ( because i do not know how to code )
