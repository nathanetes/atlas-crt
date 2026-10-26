# Changelog

## Unreleased

### Added

- **Intro.** The Atlas CRT title video plays when the page opens, then fades quickly into the app, the same way the nathanetes.com intro works. It plays once per browser session (add `?intro` to the address to see it again), a click or any key skips it, and it's skipped for anyone with reduced motion turned on.

## v2.2.1-beta

Moiré rebuilt on real camera physics, down to single-pixel scale, plus grading before and after the tube.

Try it at https://atlas-crt.nathanetes.com

### Added

- **Pre Grade module:** exposure, brightness, contrast, saturation, temperature, tint and hue on the source before it reaches the tube, so the signal, beams and glow all work on the graded picture.
- **Exposure in Post Grade** (the old Grade module), in stops. Brightness and Contrast moved there from Master, so each grade has exposure, brightness, contrast and color.
- **Dust Opacity** and **Speck Opacity** in Noise & Film, to make dust, scratches and RF specks fainter without making them rarer.
- **Moiré Scale** in Capture: the grid the camera photographs, from single-pixel cells (fine pixel moiré, like a phone filming a screen) up to chunky stripes. It no longer depends on the Screen mask.
- **Moiré Grid** (Pixel Grid, Aperture Grille, Slot Mask, Delta Dot, or Same as Screen), **Pixel Visibility** (how sharply the grid's cells show), **Moiré Color** (the false color a phone camera boosts), **Moiré Coverage** (room light on the glass) and **Moiré Drift** (the camera breathing, so the fringes crawl).
- **Pixel Moiré**, a new Camera look: fine rows of colored pixels, after a phone filming a CRT.

### Changed

- **Moiré works from any starting point and across the whole picture.** The simulated camera from v2.0.0-beta photographed the Screen's phosphor mask, so with Phosphor at 0 (as in Init) it produced nothing, and it only showed where the picture was lit. The camera now photographs a grid of its own, so moiré works with the mask off, and Coverage lights the glass with room light so the fringes carry across black, as they do on a real filmed screen. The physics is the same as before: a flat sensor, turned by Angle and bent by the lens (Rings), beats against the grid on the curved glass, so the fringes warp with both.
- **The picture stays sharp at every Moiré Scale.** The sensor photographs only the fine structure (the grid and the raster lines), and that photo multiplies the picture. The grid's cells are also drawn sharp at full resolution, since a sensor at two photosites per triad records the fringes but not the cells themselves.
- **Phone-camera sensor.** Photosites gather light from 40% of their width, with no anti-aliasing filter, so detail finer than the sensor aliases into strong fringes instead of averaging away. Raster lines beat against the sensor rows too, adding horizontal streaks when Scanlines is on.
- **Moiré Density** reaches much tighter fringes, from broad bands to streaks a few cells apart. Moiré Angle defaults to 0.
- **The preview matches the export.** The camera always shoots at export resolution, so the fitted preview shows the same moiré scaled down, instead of finer aliased stripes.
- Phone Off Screen, Rainbow Grille and Filmed Off TV photograph the Screen's own mask again (Moiré Grid: Same as Screen), as in v2.0.0-beta, and their dark areas now show moiré too.

### Known limitations

- **Saved looks that use moiré will look different**, because the moiré controls changed. Looks that set Brightness or Contrast keep their values; those controls now live in Post Grade.
- **Moiré adds two render passes** while Rainbow Moiré or Moiré Bands is above zero, so long or 4K exports are slower with it on.
- **In the fitted preview,** single-pixel moiré is drawn smaller than in the export. Use the 100% view (Z) to see exactly what you'll export.

## v2.0.0-beta

A rebuilt renderer. The tube now works in linear light, so beams, phosphors and glow add up the way light does on a real screen, and Atlas CRT can now carry the picture over a real composite signal, onto tape, and through an interlaced raster. The factory looks are new to match.

Try it at https://atlas-crt.nathanetes.com

### Added

- **Composite and S-Video.** Signal Path in Color Signal encodes the picture onto a 3.58 MHz color subcarrier and decodes it again the way an inexpensive TV did. Fine detail turns into rainbow cross-color, and color edges get crawling dots. S-Video keeps color on its own wire, so it's softer but clean. The approach follows Cathode Retro by DeadlyRedCube.
- **Luma Bandwidth** in Color Signal: limits sharpness to S-VHS (about 400 TV lines), broadcast NTSC (330), Betamax (250) or VHS (240). Post Sharpen then rings at the tape's own scale, like a deck's detail enhancer.
- **480i raster.** 480 lines drawn as two interlaced fields, one per frame. Moving edges comb and detail one line tall flickers (line twitter), as on an interlaced TV.
- **Tube Gamut** in Screen: P22 · D65 shows color through CRT phosphors with a standard white, P22 · D93 adds the bluish white of many Japanese and consumer sets, and Modern (sRGB) turns it off. P22 · D65 is the new default.
- **A real camera for moiré.** Rainbow Moiré and Moiré Bands now come from a simulated camera: a sensor with a Bayer color filter photographs the tube, and its flat grid beats against the curved phosphor grid. The fringes cover the whole picture and bend with the glass. Density, Angle and Rings set the camera's pitch, rotation and lens.
- **New looks:** Tokyo Trinitron and Console on Composite in TV, Green Phosphor in Terminal, and a new **Tape** group with VHS Camcorder, Rental Tape EP, Betamax Archive and S-VHS Master.

### Changed

- **Linear light.** Beams, the phosphor mask, glow and halation are computed in linear light. Edges are smoother, the mask stays visible in bright areas, and glow falls off like light.
- **Glow** has a long, soft tail from light scattering in the faceplate. Next to large bright areas it lifts the blacks a little, as real glass does.
- **Persistence** fades per phosphor: red lingers longest and blue fades fastest, so trails behind bright moving things lean red.
- **Tape grain** runs in horizontal streaks, like real tape noise.
- **Fine phosphor masks** are anti-aliased exactly, and a light dither keeps dark gradients and glow from banding.
- **The factory looks are rebuilt** for the new renderer: 33 looks in six groups (TV, Tape, Camera, Terminal, Color, Glitch). Haunted Tape and Late Night Ad moved into Tape. The looks tab now opens on the group of the look you're using.

### Removed

- Nine factory looks: Camcorder '94 (replaced by VHS Camcorder), Green Screen Glitch (replaced by Green Phosphor), Grunge Zine, Hot Screen, Macroblock Rot, Overcooked, Pixel Melt, Slice & Dice and Solar Flare. Every control they used is still there, so you can rebuild them and save them under **mine**.

### Known limitations

- **Saved looks will look different.** They pick up the new renderer, the P22 · D65 gamut and the camera-based moiré. Set Tube Gamut to Modern (sRGB) to get the old colors back.
- **Looks don't set the raster.** Choose 480i yourself for interlaced footage.
- **The moiré camera adds a render pass** while Rainbow Moiré or Moiré Bands is above zero. With very large Mask Scale settings the camera's picture gets soft, because a camera that close wouldn't see moiré.
- **In the fitted preview,** fine masks and moiré are drawn smaller than in the export. Use the 100% view (Z) to see exactly what you'll export.

## v1.2.0-beta

### Added

- **Automation.** Click ~ next to any slider to swing it around its value. Six shapes (sine, triangle, saw, square, random, drift), rate from 0.02 to 10 Hz, and depth. It exports with the video and saves with looks.
- **Quick macros** on the looks tab: tube, glow, moiré, color, grime and corrupt. Each scales a family of controls at once.
- **Corrupt module:** datamosh with block size, motion gain, drift, keyframes and residual, plus block glitch, slice shift, pixel smear, compression and bit crush.
- **Grade module** for creative color: hue shift, saturation, temperature, tint, shadow and highlight toning, gradient map, cross process, black level, gamma, solarize, posterize, invert, channel swap and grunge.
- **Film grain** in the Noise & Film module: size, mono-to-RGB color, shadow-to-highlight response and variation, so it clumps and breathes like film. Also dust and scratches, and gate weave.
- **Rainbow moiré** in Capture: the camera sensor beats against the curved grille, with density, angle and rings controls.
- **Bigger pixels.** Mask Scale goes up to 36px triads, Phosphor goes up to 1.5 where the gaps turn black, and there's a new LO raster (120 lines).
- **14 new looks:** Rainbow Grille (it replaces Rainbow Moiré), Phone Off Screen, 16mm Print, Big Pixel Max, a new Color group (Teal Night, Cross Processed, Duotone, Grunge Zine, Solar Flare, Bleach Bypass), and Datamosh Bloom, Macroblock Rot, Pixel Melt and Slice & Dice in Glitch.

### Changed

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
