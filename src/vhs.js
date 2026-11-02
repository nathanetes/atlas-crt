// Atlas CRT tape stage: the ntsc-rs library by valadaptive, compiled to WebAssembly from native/vhs.
// It is the real thing, so a look played here matches the ntsc-rs app to within rounding. Every
// control maps to a field of an ntsc-rs preset, which is also how presets from that app import.
(function () {
  // Atlas control -> ntsc-rs preset field. These are copied across as they are.
  const FIELDS = {
    vhsField: 'use_field', vhsFilter: 'filter_type', vhsLumaIn: 'input_luma_filter',
    vhsChromaIn: 'chroma_lowpass_in', vhsChromaOut: 'chroma_lowpass_out', vhsDemod: 'chroma_demodulation',
    vhsPreemph: 'composite_preemphasis', vhsSmear: 'luma_smear',
    vhsCompNoise: 'composite_noise_intensity', vhsCompFreq: 'composite_noise_frequency', vhsCompDetail: 'composite_noise_detail',
    vhsSnow: 'snow_intensity', vhsSnowAniso: 'snow_anisotropy',
    vhsHead: 'head_switching_height', vhsHeadOffset: 'head_switching_offset', vhsHeadShift: 'head_switching_horizontal_shift',
    vhsMidPos: 'head_switching_mid_line_position', vhsMidJitter: 'head_switching_mid_line_jitter',
    vhsTrack: 'tracking_noise_height', vhsTrackWave: 'tracking_noise_wave_intensity', vhsTrackSnow: 'tracking_noise_snow_intensity',
    vhsTrackAniso: 'tracking_noise_snow_anisotropy', vhsTrackNoise: 'tracking_noise_noise_intensity',
    vhsRing: 'ringing_scale', vhsRingFreq: 'ringing_frequency', vhsRingPower: 'ringing_power',
    vhsLumaNoise: 'luma_noise_intensity', vhsLumaFreq: 'luma_noise_frequency', vhsLumaDetail: 'luma_noise_detail',
    vhsChromaNoise: 'chroma_noise_intensity', vhsChromaFreq: 'chroma_noise_frequency', vhsChromaDetail: 'chroma_noise_detail',
    vhsPhaseError: 'chroma_phase_error', vhsPhaseNoise: 'chroma_phase_noise_intensity',
    vhsDelayH: 'chroma_delay_horizontal', vhsDelayV: 'chroma_delay_vertical',
    vhsSpeed: 'vhs_tape_speed', vhsLoss: 'vhs_chroma_loss', vhsSharpen: 'vhs_sharpen', vhsSharpenFreq: 'vhs_sharpen_frequency',
    vhsEdge: 'vhs_edge_wave', vhsEdgeSpeed: 'vhs_edge_wave_speed', vhsEdgeFreq: 'vhs_edge_wave_frequency', vhsEdgeDetail: 'vhs_edge_wave_detail',
    vhsBandwidth: 'bandwidth_scale', vhsVScale: 'vertical_scale', vhsSeed: 'random_seed',
  };
  // ntsc-rs has an on/off beside these. Here a control at zero is off, as it has no effect anyway.
  const SWITCHES = {
    composite_noise: 'vhsCompNoise', head_switching: 'vhsHead', tracking_noise: 'vhsTrack', ringing: 'vhsRing',
    luma_noise: 'vhsLumaNoise', chroma_noise: 'vhsChromaNoise', vhs_settings: 'vhsSpeed',
    vhs_sharpen_enabled: 'vhsSharpen', vhs_edge_wave_enabled: 'vhsEdge',
  };
  const WHOLE = new Set(['vhsField', 'vhsFilter', 'vhsLumaIn', 'vhsChromaIn', 'vhsChromaOut', 'vhsDemod', 'vhsCompDetail', 'vhsHead',
    'vhsHeadOffset', 'vhsTrack', 'vhsLumaDetail', 'vhsChromaDetail', 'vhsDelayV', 'vhsSpeed', 'vhsEdgeDetail', 'vhsSeed']);

  // Atlas's controls as an ntsc-rs preset
  function toPreset(p) {
    const o = {
      version: 1, scale_settings: true, scale_with_video_size: false,
      head_switching_start_mid_line: p.vhsMid > 0.5, vhs_chroma_vert_blend: p.vhsBlend > 0.5,
    };
    for (const k in FIELDS) o[FIELDS[k]] = WHOLE.has(k) ? Math.round(p[k]) : p[k];
    for (const s in SWITCHES) o[s] = p[SWITCHES[s]] !== 0;
    return o;
  }

  // an ntsc-rs preset as Atlas's controls; anything it switches off is zero
  function fromPreset(o) {
    const p = {};
    for (const k in FIELDS) if (Number.isFinite(o[FIELDS[k]])) p[k] = o[FIELDS[k]];
    for (const s in SWITCHES) if (o[s] === false) p[SWITCHES[s]] = 0;
    if (typeof o.head_switching_start_mid_line === 'boolean') p.vhsMid = o.head_switching_start_mid_line ? 1 : 0;
    if (typeof o.vhs_chroma_vert_blend === 'boolean') p.vhsBlend = o.vhs_chroma_vert_blend ? 1 : 0;
    return p;
  }
  const isPreset = (o) => !!o && typeof o === 'object' && 'use_field' in o && 'chroma_demodulation' in o;

  class AtlasTape {
    constructor() {
      this.ready = false;
      this.failed = false;
      this.version = 0; // goes up whenever the settings change
      this.json = '';
      this.onfail = null;
    }

    load() {
      if (this.loading || this.failed) return;
      const fail = () => { this.failed = true; if (this.onfail) this.onfail(); };
      this.loading = fetch('src/vhs.wasm')
        .then((r) => { if (!r.ok) throw new Error('missing'); return r.arrayBuffer(); })
        .then((bytes) => WebAssembly.instantiate(bytes, {}))
        .then(({ instance }) => { this.x = instance.exports; this.ready = true; })
        .catch(fail);
    }

    // hand ntsc-rs the current controls, if they've changed
    sync(p) {
      const json = JSON.stringify(toPreset(p));
      if (json === this.json) return;
      const bytes = new TextEncoder().encode(json);
      const at = this.x.settings_buffer(bytes.length); // this can grow memory, so read the buffer after
      new Uint8Array(this.x.memory.buffer, at, bytes.length).set(bytes);
      if (this.x.apply_settings()) { this.json = json; this.version++; }
    }

    // the frame's bytes, inside wasm memory
    pixels(w, h) {
      const at = this.x.frame_buffer(w, h);
      return new Uint8Array(this.x.memory.buffer, at, w * h * 4);
    }

    // run frame number n through the tape; rows are bottom-up, as WebGL reads them
    process(n) { this.x.process(n, 1); }
  }

  window.AtlasTape = AtlasTape;
  window.AtlasPreset = { toPreset, fromPreset, isPreset };
})();
