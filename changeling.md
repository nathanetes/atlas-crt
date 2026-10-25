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
