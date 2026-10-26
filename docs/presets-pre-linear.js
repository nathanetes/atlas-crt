// Atlas CRT factory looks as they were before the tube moved to linear light (October 2026).
// Not loaded by the app. Kept as a reference for rebuilding the presets; delete once they are rebuilt.
// To restore one, copy its line into PRESETS in src/params.js and add its category to CATS.

const PRESETS_PRE_LINEAR = [
    { cat: 'Terminal', name: 'Terminal Glow', p: { scanlines: 0.8, softness: 0.1, maskScale: 0.2, phosphor: 0.2, glow: 0.55, postGlow: 0.35, halation: 0, spectral: 0, curve: 0.15, vignette: 1, flicker: 0.2, persistence: 0.3, bleed: 0.1, rgbSplit: 0, conv: 0, contrast: 1.15, gain: 1.1, sharpen: 0.3, film: 0.05, overscan: 0.05 } },
    { cat: 'Terminal', name: 'Green Screen Glitch', p: { tint: 1, scanlines: 0.8, softness: 0.15, maskScale: 0.2, phosphor: 0.2, glow: 0.6, postGlow: 0.4, curve: 0.2, vignette: 1, flicker: 0.35, persistence: 0.45, contrast: 1.2, gain: 1.1, sharpen: 0.4, grain: 0.15, tear: 0.25, shake: 0.2, dropout: 0.2, dropStyle: 2, headSwitch: 0.3, hum: 0.2, rf: 0.08, sync: 0.3, bend: 0.2 } },
    { cat: 'Terminal', name: 'Amber Monitor', p: { tint: 2, scanlines: 0.85, softness: 0.15, maskScale: 0.2, phosphor: 0.15, glow: 0.5, postGlow: 0.3, curve: 0.3, vignette: 0.8, flicker: 0.15, persistence: 0.5, contrast: 1.1, gain: 1.05, sharpen: 0.25 } },
    { cat: 'Terminal', name: 'Paper White', p: { tint: 3, scanlines: 0.7, softness: 0.2, maskScale: 0.2, phosphor: 0.15, glow: 0.4, postGlow: 0.25, curve: 0.25, vignette: 0.7, flicker: 0.1, persistence: 0.2, contrast: 1.2, sharpen: 0.3 } },

    { cat: 'Camera', name: 'Rainbow Grille', p: { maskType: 1, maskScale: 0.45, phosphor: 0.7, scanlines: 0.5, softness: 0.35, rainbow: 0.45, moire: 0.1, moirePitch: 0.08, moireAngle: 4, moireRings: 0.3, glow: 0.35, postGlow: 0.2, halation: 0.3, contrast: 0.95, spectral: 0.2, curve: 0.3, fisheye: 0.25, vignette: 0.7, bleed: 0.4, rgbSplit: 0.12, temp: -0.35, shHue: 190, shAmt: 0.45, hiHue: 50, hiAmt: 0.25, sat: 1.2, film: 0.15 } },
    { cat: 'Camera', name: 'Phone Off Screen', p: { maskScale: 0.3, phosphor: 0.6, rainbow: 0.45, moire: 0.2, moirePitch: 0.2, moireRings: 0.75, moireAngle: 1, halation: 0.55, glow: 0.55, postGlow: 0.3, softness: 0.55, sharpen: 0, bleed: 0.5, rgbSplit: 0.15, conv: 0.25, temp: 0.25, hiHue: 15, hiAmt: 0.3, lift: 0.04, vignette: 0.75, curve: 0.1, film: 0.2, filmVar: 0.5 } },
    { cat: 'Camera', name: "Camcorder '94", p: { shake: 0.15, bleed: 0.6, chroma: 0.9, grain: 0.35, headSwitch: 0.55, sharpen: 0.45, dropout: 0.12, hum: 0.12, scanlines: 0.35, phosphor: 0.2, curve: 0.05, glow: 0.2, halation: 0.15, rgbSplit: 0.1, hueDrift: 0.05, echo: 0.15 } },
    { cat: 'Camera', name: 'Filmed Off TV', p: { capture: 0.7, shutter: 48, refresh: 59.94, pulseContrast: 0.8, moire: 0.35, rainbow: 0.25, curve: 0.55, glow: 0.45, phosphor: 0.8, maskScale: 0.39, scanlines: 0.7, conv: 0.3, spectral: 0.25, overscan: 0.2, persistence: 0.3, maskType: 0 } },
    { cat: 'Camera', name: 'Rolling Shutter', p: { capture: 1, shutter: 250, refresh: 60, pulseContrast: 1.4, bandAngle: 12, readout: 0.4, persistence: 0.35, curve: 0.35, phosphor: 0.7, glow: 0.35 } },
    { cat: 'Camera', name: '16mm Print', p: { phosphor: 0, scanlines: 0, curve: 0, vignette: 0.55, conv: 0, bleed: 0.1, film: 0.6, filmSize: 0.6, filmColor: 0.45, filmVar: 0.7, dust: 0.45, weave: 0.5, halation: 0.35, glow: 0.2, temp: 0.15, lift: 0.04, contrast: 1.1, sat: 0.9, overscan: 0 } },
    { cat: 'Camera', name: 'Night Shift', p: { chroma: 0.15, gain: 1.3, grain: 0.55, rf: 0.15, sharpen: 0.6, scanlines: 0.5, hum: 0.35, shake: 0.05, contrast: 1.3, curve: 0.2, glow: 0.3, flicker: 0.2, bleed: 0.2 } },

    { cat: 'TV', name: 'Living Room Tube', p: { maskType: 0, curve: 0.45, glow: 0.35, halation: 0.3, bleed: 0.45, scanlines: 0.55, phosphor: 0.6, conv: 0.2, spectral: 0.15, overscan: 0.15 } },
    { cat: 'TV', name: 'Broadcast Monitor', p: { maskType: 1, maskScale: 0.23, phosphor: 0.65, scanlines: 0.85, softness: 0.05, bleed: 0.1, sharpen: 0.35, curve: 0.1, glow: 0.15, conv: 0.05, film: 0 } },
    { cat: 'TV', name: 'Arcade Cabinet', p: { maskType: 2, maskScale: 0.4, phosphor: 0.8, scanlines: 0.9, pbloom: 0.6, glow: 0.5, halation: 0.25, curve: 0.6, chroma: 1.35, gain: 1.15, spectral: 0.2 } },
    { cat: 'TV', name: 'Big Pixel Max', p: { maskType: 1, maskScale: 1, phosphor: 1.5, scanlines: 0.9, softness: 0.1, pbloom: 0.7, glow: 0.6, halation: 0.3, curve: 0.35, vignette: 0.5, rainbow: 0.35, moireAngle: 2, chroma: 1.3, gain: 1.25 } },
    { cat: 'TV', name: 'Late Night Ad', p: { chroma: 1.6, hueDrift: 0.15, bleed: 0.7, rgbSplit: 0.25, halation: 0.5, postGlow: 0.4, glow: 0.4, sharpen: 0.5, echo: 0.3, scanlines: 0.4, curve: 0.3, tear: 0.05 } },
    { cat: 'TV', name: 'Pastel Dream', p: { chroma: 0.85, glow: 0.8, postGlow: 0.6, spectral: 0.5, halation: 0.45, softness: 0.7, bright: 0.05, contrast: 0.85, scanlines: 0.3, hueDrift: 0.3, curve: 0.35 } },
    { cat: 'TV', name: 'Hot Screen', p: { flash: 0.35, flicker: 0.35, glow: 0.6, spectral: 0.6, pbloom: 0.8, contrast: 1.35, chroma: 1.5, scanlines: 0.7, phosphor: 0.7, maskScale: 0.35 } },

    { cat: 'Color', name: 'Teal Night', p: { shHue: 190, shAmt: 0.55, hiHue: 40, hiAmt: 0.3, temp: -0.3, sat: 1.25, halation: 0.35, glow: 0.4, lift: 0.02 } },
    { cat: 'Color', name: 'Cross Processed', p: { cross: 0.85, sat: 1.35, contrast: 1.15, lift: 0.05, hiHue: 60, hiAmt: 0.2, film: 0.2 } },
    { cat: 'Color', name: 'Duotone', p: { gmap: 0.9, shHue: 255, hiHue: 25, contrast: 1.15, film: 0.15 } },
    { cat: 'Color', name: 'Grunge Zine', p: { grunge: 0.85, poster: 0.35, contrast: 1.35, crush: 0.3, film: 0.45, filmSize: 0.5, filmVar: 0.8, dust: 0.4, sat: 0.8, sharpen: 0.6 } },
    { cat: 'Color', name: 'Solar Flare', p: { solar: 0.6, hue: 25, glow: 0.55, spectral: 0.4, sat: 1.3 } },
    { cat: 'Color', name: 'Bleach Bypass', p: { sat: 0.4, contrast: 1.45, lift: -0.04, temp: -0.1, film: 0.3, filmColor: 0, halation: 0.1 } },

    { cat: 'Glitch', name: 'Datamosh Bloom', p: { mosh: 1, moshDrift: 0.5, moshGain: 2, moshRefresh: 0.03, moshResid: 0.25, moshBlock: 0.45, compress: 0.2, chroma: 1.3 } },
    { cat: 'Glitch', name: 'Macroblock Rot', p: { compress: 0.8, blockGlitch: 0.5, crush: 0.25, mosh: 0.35, moshRefresh: 0.2, sat: 1.2 } },
    { cat: 'Glitch', name: 'Pixel Melt', p: { smear: 0.75, smearThresh: 0.45, mosh: 0.5, moshDrift: 0.7, moshRefresh: 0.05, hueDrift: 0.3, glow: 0.4 } },
    { cat: 'Glitch', name: 'Slice & Dice', p: { slices: 0.8, blockGlitch: 0.35, chanSwap: 4, rgbSplit: 0.4, tear: 0.2 } },
    { cat: 'Glitch', name: 'Bent Circuit', p: { bend: 0.6, bendFreq: 2.2, bendQ: 9, bendBoost: 18, bendMotion: 0.35, bendFb: 0.08, chroma: 1.4, scanlines: 0.5 } },
    { cat: 'Glitch', name: 'Loose Cable', p: { tear: 0.55, shake: 0.5, dropout: 0.4, dropStyle: 4, echo: 0.5, hum: 0.45, rf: 0.3, headSwitch: 0.6, rgbSplit: 0.3, sync: 0.5 } },
    { cat: 'Glitch', name: 'Overcooked', p: { sharpen: 1, contrast: 2, chroma: 2.3, gain: 1.4, bleed: 0.9, grain: 0.6, halation: 0.8, postGlow: 0.5, rgbSplit: 0.4, glow: 0.4, bend: 0.15 } },
    { cat: 'Glitch', name: 'Feedback Bloom', p: { persistence: 0.85, bend: 0.35, bendFb: 0.22, bendDelay: 1.1, hueDrift: 0.6, glow: 0.7, spectral: 0.6, waves: 0.25, waveColor: 1, waveBlend: 2, waveCount: 25 } },
    { cat: 'Glitch', name: 'Lost Sync', p: { roll: 0.45, sync: 0.8, tear: 0.4, shake: 0.3, hum: 0.5, headSwitch: 0.5, flicker: 0.3 } },
    { cat: 'Glitch', name: 'Chroma Storm', p: { hueDrift: 1, chroma: 2.2, rgbSplit: 0.6, bleed: 1, waves: 0.4, waveColor: 1, waveBlend: 3, waveCount: 80, conv: 0.6, convAngle: 45 } },
    { cat: 'Glitch', name: 'Haunted Tape', p: { dropout: 0.35, dropStyle: 0, grain: 0.7, rf: 0.35, chroma: 0.4, echo: 0.6, hum: 0.4, shake: 0.25, headSwitch: 0.8, topLine: 0.5, flicker: 0.2, contrast: 1.2, bright: -0.05 } },
];

const CATS_PRE_LINEAR = ['Terminal', 'Camera', 'TV', 'Color', 'Glitch'];
