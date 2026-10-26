# Changelog

## Unreleased

### Added

- **Automation.** Click ~ next to any slider to swing it around its value. Six shapes (sine, triangle, saw, square, random, drift), rate from 0.02 to 10 Hz, and depth. It exports with the video and saves with looks.
- **Quick macros** on the looks tab: tube, glow, moiré, color, grime and corrupt. Each scales a family of controls at once.
- **Corrupt module:** datamosh with block size, motion gain, drift, keyframes and residual, plus block glitch, slice shift, pixel smear, compression and bit crush.
- **Grade module** for creative color: hue shift, saturation, temperature, tint, shadow and highlight toning, gradient map, cross process, black level, gamma, solarize, posterize, invert, channel swap and grunge.
- **Film grain** in the Noise & Film module: size, mono-to-RGB color, shadow-to-highlight response and variation, so it clumps and breathes like film. Also dust and scratches, and gate weave.
- **Rainbow moiré** in Capture, from a simulated camera: a sensor with a Bayer color filter photographs the tube, and its flat grid beats against the curved phosphor grid, so the fringes cover the whole picture and bend with the glass. Density, angle and rings set the camera's pitch, rotation and lens.
- **Bigger pixels.** Mask Scale goes up to 36px triads, Phosphor goes up to 1.5 where the gaps turn black, and there's a new LO raster (120 lines).
- **Composite and S-Video** (Signal Path, in Color Signal): a real NTSC encode and decode, so fine detail turns into rainbow cross-color and color edges get dot crawl. After Cathode Retro by DeadlyRedCube.
- **Luma Bandwidth** for S-VHS, broadcast, Betamax and VHS, with deck sharpening that rings at the tape's own scale.
- **480i raster:** two interlaced fields, with combing on motion and line twitter.
- **Tube Gamut** in Screen: P22 phosphors with a D65 or bluish D93 white point.
- **33 factory looks in six groups:** TV, Tape (new), Camera, Terminal, Color and Glitch, built for the new renderer.

### Changed

- The tube now renders in linear light: beams, phosphor mask, glow and halation add up as light does on a real screen, and edges are smoother.
- Glow has a long, soft tail from light scattering in the glass.
- Persistence fades per phosphor, so trails behind bright moving things lean red.
- Tape grain runs in horizontal streaks, like real tape noise.
- A light dither keeps dark gradients and glow from banding.

- The interface is simpler: a looks tab (looks, macros, render settings, save) and an adjust tab (automation, master, modules). Raster and output size moved from the header into the looks tab.
- The defaults are cleaner: no dropouts, hum, echo, shake or head-switch band unless a look adds them.
- The controls window no longer flickers.
- Sources are mipmapped, so large photos and 4K video downsample cleanly into the raster.

## v1.0.0-beta

The first public beta of Atlas CRT, a CRT and analog video emulator that runs in the browser. Open a photo or video, shape the look, and export a PNG or a video. Everything renders on your GPU, and nothing is uploaded.

Try it at https://atlas-crt.nathanetes.com

### Features

- **Photos and videos.** Open a file or drag it onto the preview. Video plays with sound and a scrub bar. A built-in test card loads first, so the effects show right away.
- **Nine effect modules**, each with its own on/off switch and reset:
  - **Color Signal:** gain, chroma, hue drift, chroma bleed, RGB split, sharpening, post glow, halation
  - **Circuit Bend:** resonant ringing and fold-over, with frequency, Q, boost, thresholds and feedback
  - **Damage:** shake, tear, vertical roll, exposure flash, dropouts in five styles, hum band, echo, head-switch band, top-line noise
  - **Noise:** reception specks and tape grain
  - **Waves:** rolling modulation bands with four blend modes
  - **Screen:** five phosphor masks, scanlines, phosphor color (full color, green, amber, white), refresh rate, persistence, sync, ripple, flicker, beam softness, bloom, overscan
  - **Capture:** a camera filming the tube, with shutter, scan band, rolling-shutter readout, moiré and rainbow interference
  - **Convergence:** beam and phosphor misregistration
  - **Glass & Optics:** glow, spectral bloom, curvature, vignette, line stretch, fisheye, transparent outside area
- **22 factory looks** in four groups (Terminal, Camera, TV, Glitch), plus **Randomize**, and saved looks of your own.
- **Master controls:** dry/wet, brightness, contrast and signal clean.
- **Raster quality:** SD (240 lines), HI (480 lines) or FULL (source resolution).
- **Output sizes:** 720p, 1080p, 1440p or source size.
- **Compare:** a draggable split between the source and the result.
- **100% view** for checking the mask and scanlines pixel for pixel.
- **Export:**
  - PNG stills at the output size.
  - Video recorded in real time with sound: MP4 in Chrome, Edge and Safari, WebM in Firefox. Stills can be recorded as 5 to 30 second clips.
- **Keyboard shortcuts:** Space plays and pauses, C toggles compare, Z toggles 100% view.
- **Works on phones**, with the layout stacked into one column.

### Known limitations

- Video export runs in real time, and the tab has to stay in front while it records.
- Video exports only as MP4 (H.264) or WebM, depending on the browser. There is no ProRes or HEVC export.
- Needs WebGL2. Tested mainly in Chromium-based browsers; Safari and Firefox have had less testing.
- Long or 4K clips can be slow on older or integrated GPUs. Use SD raster and a smaller output size to speed things up.
- Saved looks stay in the browser where you made them and don't sync between devices.
- There is no undo yet. Double-click a control to reset it, or use a module's reset button.
