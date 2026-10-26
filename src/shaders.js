// Atlas CRT shader sources, part 1: shared helpers, the datamosh pass, the signal
// pass (the damaged video signal at the tube's raster), and the glow passes.
// The screen pass lives in screen-shader.js.
(function () {
  const VERT = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

  const COMMON = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x),
             mix(hash12(i + vec2(0.0, 1.0)), hash12(i + 1.0), f.x), f.y);
}
float vnoise1(float x) { float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(hash11(i), hash11(i + 1.0), f); }
float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
vec3 hue2rgb(float h) { return clamp(abs(fract(h + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0) - 1.0, 0.0, 1.0); }
vec3 triad(float x) { vec3 c = 0.5 + 0.5 * cos(6.2831853 * (x - vec3(0.0, 0.33333, 0.66667))); return c * c; }
// the signal is gamma-encoded like a real video signal; light (beams, glow) adds up in linear
vec3 toLin(vec3 c) { return pow(max(c, 0.0), vec3(2.2)); }
vec3 toGam(vec3 c) { return pow(max(c, 0.0), vec3(1.0 / 2.2)); }
const mat3 RGB2YIQ = mat3(0.299, 0.596, 0.211, 0.587, -0.274, -0.523, 0.114, -0.322, 0.312);
const mat3 YIQ2RGB = mat3(1.0, 1.0, 1.0, 0.956, -0.272, -1.106, 0.621, -0.647, 1.703);
`;

  // ---------------------------------------------------------------- datamosh
  // Codec-style P-frame smearing: each block either refreshes from the new frame
  // or drags the previous moshed frame along a rough motion vector.
  const MOSH = COMMON + `
uniform sampler2D uCur, uPrev, uMosh;
uniform vec2 uRes;
uniform float uTime, uFrame;
uniform float u_mosh, u_moshBlock, u_moshGain, u_moshDrift, u_moshRefresh, u_moshResid;

float Y(sampler2D s, vec2 p, float lod) { return lum(textureLod(s, p, lod).rgb); }

void main() {
  float bs = floor(mix(4.0, 32.0, u_moshBlock));
  vec2 px = 1.0 / uRes;
  vec2 blk = floor(vUv * uRes / bs);
  vec2 c = (blk + 0.5) * bs * px;
  float lod = log2(bs);

  // one Lucas-Kanade step on the blurred luma at the block centre
  vec2 dx = vec2(bs * px.x, 0.0), dy = vec2(0.0, bs * px.y);
  vec2 grad = vec2(Y(uCur, c + dx, lod) - Y(uCur, c - dx, lod), Y(uCur, c + dy, lod) - Y(uCur, c - dy, lod)) / (2.0 * bs);
  float it = Y(uCur, c, lod) - Y(uPrev, c, lod);
  vec2 v = -it * grad / (dot(grad, grad) + 2e-4);
  if (length(v) > bs * 1.5) v = normalize(v) * bs * 1.5;
  v += u_moshDrift * bs * 0.6 * (vec2(vnoise(blk * 0.35 + uTime * 0.4), vnoise(blk * 0.35 + 17.0 - uTime * 0.3)) - 0.5) * 2.0;

  vec3 cur = texture(uCur, vUv).rgb;
  vec4 held = texture(uMosh, vUv - v * u_moshGain * px);
  vec3 moshed = held.rgb + (cur - texture(uPrev, vUv).rgb) * u_moshResid;

  float tick = floor(uTime * 8.0);
  float key = step(hash12(blk * 1.31 + tick * 0.77), u_moshRefresh * 0.12);
  if (held.a < 0.5) key = 1.0;
  float pBlock = step(hash12(blk * 1.7 + floor(uTime * 0.5)), u_mosh);
  o = vec4(mix(cur, mix(moshed, cur, key), pBlock), 1.0);
}`;

  // ---------------------------------------------------------------- signal
  const SIGNAL = COMMON + `
uniform sampler2D uSrc;
uniform sampler2D uPrev;
uniform vec2 uRes, uSrcRes;
uniform float uTime, uFrame, uSrcAspect, uField;
uniform float u_gain, u_chroma, u_hueDrift, u_bleed, u_rgbSplit, u_sharpen, u_lumaBW;
uniform float u_bend, u_bendMotion, u_bendFreq, u_bendQ, u_bendBoost, u_bendLo, u_bendHi, u_bendFb, u_bendDelay;
uniform float u_shake, u_tear, u_roll, u_flash, u_dropout, u_dropStyle, u_hum, u_echo, u_headSwitch, u_topLine;
uniform float u_rf, u_speckSize, u_grain;
uniform float u_waves, u_waveCount, u_waveReact, u_waveSmooth, u_waveOrient, u_waveColor, u_waveDir, u_waveBlend;
uniform float u_blockGlitch, u_slices, u_smear, u_smearThresh, u_compress;
uniform float u_persistence;

vec3 src(vec2 uv) { return texture(uSrc, uv).rgb; }
float srcY(vec2 uv) { return lum(texture(uSrc, uv).rgb); }

// Luma bandwidth of the format, as a horizontal Gaussian low-pass. Resolution is in TV lines (TVL):
// alternating lines resolvable across a width equal to the picture height, so the cutoff is
// TVL / 2 cycles per picture height. sigma puts the 50% response at that cutoff.
// 1 S-VHS ~400 TVL, 2 broadcast NTSC ~330 TVL (4.2 MHz), 3 Betamax ~250 TVL, 4 VHS ~240 TVL.
float lumaSigma() {
  int f = int(u_lumaBW + 0.5);
  float tvl = f == 1 ? 400.0 : f == 2 ? 330.0 : f == 3 ? 250.0 : 240.0;
  return 0.1874 / (0.5 * tvl * uSrcAspect);   // in uv units across the width
}
float lumaLP(vec2 uv, float sigma) {
  float acc = 0.0, ws = 0.0;
  for (int k = -4; k <= 4; k++) {
    float d = float(k) * 0.75, w = exp(-0.5 * d * d);
    acc += srcY(uv + vec2(d * sigma, 0.0)) * w; ws += w;
  }
  return acc / ws;
}

void main() {
  // interlaced: this frame scans one field; the other field's rows keep what the last field drew,
  // so anything that moved between fields is caught at two moments (combing). Decided here but
  // applied at the end: returning early would break the mip derivatives of neighbouring pixels.
  bool holdField = uField >= 0.0 && mod(floor(gl_FragCoord.y), 2.0) != uField;
  vec2 uv = vUv;
  float t = uTime, fr = uFrame;
  float lines = uRes.y;
  float yT = 1.0 - uv.y; // 0 = top of frame

  // vertical roll with a blanking bar at the wrap
  float blank = 0.0;
  if (u_roll > 0.001) {
    float yr = yT + t * u_roll * u_roll * 1.1 + (vnoise1(t * 1.7) - 0.5) * u_roll * 0.05;
    float bar = fract(yr);
    blank = smoothstep(0.0, 0.006, bar) * (1.0 - smoothstep(0.045, 0.055, bar));
    blank *= clamp(u_roll * 4.0, 0.0, 1.0);
    yT = bar;
  }
  float line = floor(yT * lines);

  // horizontal timing errors
  float dx = 0.0;
  if (u_shake > 0.001) {
    dx += u_shake * 0.012 * (vnoise(vec2(line * 0.08, t * 6.0)) - 0.5) * 2.0;
    dx += u_shake * 0.004 * (hash12(vec2(line, fr)) - 0.5);
    dx += u_shake * 0.03 * step(0.93, hash11(fr * 0.37 + 1.0)) * (hash11(fr + 5.0) - 0.5);
  }
  if (u_tear > 0.001) {
    float tpos = fract(hash11(floor(t * 1.3) + 2.0) + t * 0.11);
    float d = (yT - tpos) / (0.04 + 0.2 * u_tear);
    if (d > 0.0 && d < 1.0) dx += u_tear * 0.2 * d * d * (0.6 + 0.4 * sin(t * 9.0 + line * 0.05));
    dx += u_tear * 0.04 * step(0.975, hash12(vec2(line * 0.3, floor(t * 20.0))));
  }
  if (u_slices > 0.001) {
    float bucket = floor(t * 6.0);
    float band = floor(yT * (6.0 + floor(hash11(bucket * 0.37) * 30.0)));
    if (hash12(vec2(band, bucket)) < u_slices * 0.6) dx += (hash12(vec2(band + 3.1, bucket)) - 0.5) * 0.35 * u_slices;
  }
  float hs = smoothstep(0.95, 0.99, yT);
  if (u_headSwitch > 0.001) dx += u_headSwitch * hs * (0.04 + 0.05 * (hash12(vec2(line, fr)) - 0.5));

  // dropouts: one segment per affected line
  int style = int(u_dropStyle + 0.5);
  float isDrop = step(1.0 - u_dropout * 0.07, hash12(vec2(line * 1.37, fr * 0.71 + 0.3)));
  float x0 = hash12(vec2(line + 0.5, fr + 3.1));
  float seg = isDrop * step(x0, uv.x) * step(uv.x, x0 + 0.04 + 0.4 * hash12(vec2(fr + 0.7, line + 7.3)));
  if (style == 4) dx += isDrop * (hash12(vec2(line, fr + 9.0)) - 0.5) * 0.2;

  vec2 suv = vec2(uv.x + dx, 1.0 - yT);
  if (style == 2 && seg > 0.0) suv.y += (1.0 + floor(hash12(vec2(line, fr)) * 4.0)) / lines;

  // macroblock glitches: blocks jump, swap channels or posterize
  float glitch = 0.0;
  if (u_blockGlitch > 0.001) {
    vec2 bid = floor(vec2(uv.x * uRes.x, yT * lines) / 16.0);
    float bucket = floor(t * 10.0);
    if (hash12(bid + bucket * 7.13) < u_blockGlitch * 0.18) {
      glitch = 1.0 + floor(hash12(bid * 1.9 + bucket) * 3.0);
      suv += (vec2(hash12(bid + bucket), hash12(bid.yx + bucket * 1.3)) - 0.5) * vec2(0.25, 0.15) * u_blockGlitch;
    }
  }

  // composite decode: split, compression, smear, chroma bleed, sharpening
  float sd = u_rgbSplit * 0.008;
  vec3 rgb = vec3(texture(uSrc, suv + vec2(sd, 0.0)).r, texture(uSrc, suv).g, texture(uSrc, suv - vec2(sd, 0.0)).b);

  if (u_compress > 0.001) {
    float bs = 8.0 * uSrcRes.x / uRes.x;
    vec2 bc = (floor(suv * uSrcRes / bs) + 0.5) * bs / uSrcRes;
    vec3 avg = textureLod(uSrc, bc, log2(bs)).rgb;
    float lv = mix(32.0, 6.0, u_compress);
    rgb = mix(rgb, mix(avg, floor(rgb * lv + 0.5) / lv, 0.35), u_compress);
  }
  if (u_smear > 0.001) {
    float len = u_smear * 0.3, bl = lum(rgb);
    vec3 best = rgb;
    for (int i = 1; i <= 24; i++) {
      float fi = float(i) / 24.0;
      vec3 s = texture(uSrc, suv - vec2(fi * len, 0.0)).rgb;
      float ls = lum(s);
      if (ls > u_smearThresh && ls > bl) { best = s * (1.0 - fi * 0.35); bl = ls; }
    }
    rgb = best;
  }
  if (glitch > 1.5 && glitch < 2.5) rgb = rgb.brg;
  else if (glitch > 2.5) rgb = floor(rgb * 3.0 + 0.5) / 3.0;

  vec3 yiq = RGB2YIQ * rgb;
  // band-limit luma: take out the detail above the format's cutoff, keeping the damage done above
  bool bandLimited = u_lumaBW > 0.5;
  float sigma = bandLimited ? lumaSigma() : 0.0;
  if (bandLimited) yiq.x += lumaLP(suv, sigma) - srcY(suv);
  if (u_bleed > 0.001) {
    vec2 iq = vec2(0.0);
    float ws = 0.0;
    float span = u_bleed * 2.5 / uRes.x;
    for (int i = -3; i <= 8; i++) {
      float fi = float(i);
      float w = exp(-fi * fi / 18.0);
      iq += (RGB2YIQ * src(suv - vec2(fi * span, 0.0))).yz * w;
      ws += w;
    }
    yiq.yz = mix(yiq.yz, iq / ws, clamp(u_bleed * 1.6, 0.0, 1.0));
  }
  if (u_sharpen > 0.001) {
    // the deck's detail enhancer; on a band-limited signal it works at the tape's own scale,
    // so its halos ring at the width real tape halos have
    float px = 1.25 / uRes.x;
    float yb;
    if (bandLimited) {
      px = max(px, sigma);
      yb = 0.5 * (lumaLP(suv - vec2(px, 0.0), sigma) + lumaLP(suv + vec2(px, 0.0), sigma));
    } else {
      yb = 0.5 * (srcY(suv - vec2(px, 0.0)) + srcY(suv + vec2(px, 0.0)));
    }
    yiq.x += (yiq.x - yb) * u_sharpen * 2.5;
  }

  // circuit bend: resonant ringing after edges, gated by level, folded back on overflow
  if (u_bend > 0.001) {
    float px = 1.5 / uRes.x;
    float omega = 6.2831853 * u_bendFreq / 5.5 * 0.45;
    float damp = 2.5 / max(u_bendQ, 0.25);
    float ph = t * u_bendMotion * 14.0;
    float prev = yiq.x, ring = 0.0;
    for (int i = 1; i <= 20; i++) {
      float fi = float(i);
      float s = srcY(suv - vec2(fi * px, 0.0));
      ring += (prev - s) * exp(-fi * damp) * cos(fi * omega + ph);
      prev = s;
    }
    float ire = yiq.x * 100.0;
    float gate = smoothstep(u_bendLo - 6.0, u_bendLo + 6.0, ire) * (1.0 - smoothstep(u_bendHi - 6.0, u_bendHi + 6.0, ire));
    float fb = srcY(suv - vec2(u_bendDelay * 0.019 + 0.002, 0.0));
    float bent = (ring * pow(10.0, u_bendBoost / 20.0) + u_bendFb * 6.0 * (fb - 0.5)) * gate;
    yiq.x += bent * u_bend;
    yiq.yz = rot(bent * u_bend * 5.0) * yiq.yz + vec2(0.6, -0.4) * bent * u_bend * 0.25;
    float folded = 1.0 - abs(1.0 - mod(max(yiq.x, -1.0) + 2.0, 2.0));
    yiq.x = mix(yiq.x, folded, clamp(u_bend * 1.5, 0.0, 1.0));
  }

  float ha = u_hueDrift * 3.14159 * (0.3 + 0.4 * sin(t * 0.37) + 0.25 * sin(yT * 5.0 + t * 0.9));
  yiq.yz = rot(ha) * yiq.yz * u_chroma;
  yiq.x *= u_gain;

  if (u_grain > 0.001) {
    // tape luma noise runs in horizontal streaks: each line gets its own slow noise along x,
    // fresh every frame, over a little fine grain. GRAIN_STREAK/FINE keep the old overall strength.
    const float GRAIN_STREAK = 0.91, GRAIN_FINE = 0.4;
    float streak = vnoise(vec2(uv.x * 90.0, line + fr * 263.0)) - 0.5;
    float fine = hash12(gl_FragCoord.xy + fract(fr * 0.618) * 917.0) - 0.5;
    yiq.x += (streak * GRAIN_STREAK + fine * GRAIN_FINE) * u_grain * 0.22;
    vec2 bp = vec2(uv.x * 28.0, yT * 80.0);
    yiq.yz += (vec2(vnoise(bp + fr * 1.7), vnoise(bp.yx + 13.0 - fr * 1.3)) - 0.5) * u_grain * 0.2;
  }
  rgb = YIQ2RGB * yiq;

  if (abs(u_echo) > 0.001) {
    vec3 g = src(suv - vec2(0.01 + 0.025 * abs(u_echo), 0.0));
    rgb += u_echo * 0.5 * (g - 0.5 * rgb);
  }
  if (u_topLine > 0.001) {
    float tl = 1.0 - smoothstep(0.0, 0.035, yT);
    float n = hash12(vec2(floor(uv.x * uRes.x * 0.2), line + fr));
    vec3 spec = 0.5 + 0.5 * cos(6.2831853 * (uv.x * 5.0 + n * 0.6 + t * 0.5 + vec3(0.0, 0.33, 0.67)));
    rgb = mix(rgb, spec * (0.35 + 0.65 * n), tl * u_topLine);
  }
  if (u_headSwitch > 0.001) {
    float n = hash12(vec2(uv.x * uRes.x, line + fr));
    rgb = mix(rgb, vec3(n) * 0.7 + rgb * 0.3, hs * u_headSwitch * 0.7 * step(0.45, hash12(vec2(line, fr * 1.1))));
  }
  if (seg > 0.0) {
    if (style == 0) rgb = mix(rgb, vec3(0.85 + 0.15 * hash12(uv * uRes + fr)), 0.92);
    else if (style == 1) rgb *= 0.06;
    else if (style == 3) rgb = vec3(lum(rgb));
  }

  // reception noise
  if (u_rf > 0.001) {
    float cs = mix(1.0, 5.0, u_speckSize);
    vec2 cell = floor(vec2(uv.x * uRes.x / (cs * 3.0), yT * lines / cs));
    float sp = step(1.0 - u_rf * 0.04, hash12(cell + vec2(fr * 13.1, fr * 7.7)));
    rgb = mix(rgb, vec3(step(0.35, hash12(cell * 1.7 + fr))), sp);
    rgb = mix(rgb, vec3(hash12(gl_FragCoord.xy * 1.3 + fr * 31.0)), u_rf * u_rf * 0.35);
  }
  if (u_hum > 0.001) {
    float hb = smoothstep(0.5, 1.0, 0.5 + 0.5 * sin(6.2831853 * (yT - t * 0.17)));
    rgb *= 1.0 - u_hum * 0.55 * hb;
  }
  if (u_flash > 0.001) {
    float fl = step(1.0 - u_flash * 0.12, hash11(floor(t * 12.0) * 0.73 + 0.1));
    rgb = rgb * (1.0 + fl * 1.3 * u_flash) + fl * 0.12 * u_flash;
  }

  // modulation waves
  if (u_waves > 0.001) {
    float pos = u_waveOrient > 0.5 ? uv.x : yT;
    float dir = u_waveDir > 0.5 ? -1.0 : 1.0;
    float ph = 3.14159 * pos * u_waveCount + dir * t * 2.5 + u_waveReact * lum(rgb) * 60.0;
    float k = 6.0 / (1.0 + u_waveSmooth * 1.5);
    vec3 s = u_waveColor > 0.5 ? sin(ph + vec3(0.0, 2.094, 4.189)) : vec3(sin(ph));
    vec3 w = 0.5 + 0.5 * tanh(s * k) / tanh(k);
    int bm = int(u_waveBlend + 0.5);
    vec3 r = bm == 0 ? w : bm == 1 ? rgb * w : bm == 2 ? 1.0 - (1.0 - rgb) * (1.0 - w) : rgb + w * 0.6;
    rgb = mix(rgb, r, u_waves);
  }

  rgb = mix(rgb, vec3(0.015), blank);
  // phosphor afterglow, in linear light. Each phosphor fades at its own rate: in P22 the red
  // (europium) phosphor glows longest and the blue shortest, so trails behind bright moving
  // things warm toward red. Green keeps the per-frame decay the single-rate version had.
  if (u_persistence > 0.001) {
    vec3 decay = pow(vec3(pow(u_persistence * 0.94, 2.2)), vec3(0.6, 1.0, 1.5));
    rgb = toGam(max(toLin(rgb), toLin(texture(uPrev, vUv).rgb) * decay));
  }
  o = vec4(max(rgb, 0.0), 1.0);
  if (holdField) o = vec4(texelFetch(uPrev, ivec2(gl_FragCoord.xy), 0).rgb, 1.0);
}`;

  // ---------------------------------------------------------------- composite video
  // A real NTSC encode and decode of the signal raster. Colour rides on a 3.58 MHz subcarrier
  // (QAM: I on sine, Q on cosine) added to luma on one wire. The decoder splits them again
  // with a box filter exactly one subcarrier cycle wide, which is what cheap sets did: fine
  // luma detail near the subcarrier leaks into chroma (rainbows) and chroma leaks into luma
  // at colour edges (dot crawl). The subcarrier phase flips half a cycle every line (227.5
  // cycles per line) and every frame, so the dots crawl.
  // Approach after Cathode Retro by DeadlyRedCube (https://github.com/DeadlyRedCube/Cathode-Retro),
  // used under its license; see docs/licenses/cathode-retro.txt.
  // The composite texture is COMP_W samples wide: 188 subcarrier cycles in an active NTSC line, 4 samples each.
  const COMPOSITE = `
const float SPC = 4.0;                   // samples per subcarrier cycle
float carrier(float x, float line) { return 6.2831853 * (x / SPC + 0.5 * line + 0.5 * uFrame); }
`;

  // encode: r = luma, g = modulated chroma (kept apart so S-Video can use them separately),
  // stored around 0.5 so it survives the 8-bit fallback targets
  const COMP_ENC = COMMON + `
uniform sampler2D uSig;
uniform vec2 uRes;
uniform float uFrame;
` + COMPOSITE + `
void main() {
  vec2 px = floor(vUv * uRes);
  float line = uRes.y - 1.0 - px.y;
  vec3 yiq = RGB2YIQ * texture(uSig, vUv).rgb;
  float ph = carrier(px.x, line);
  o = vec4(yiq.x, 0.5 + 0.5 * (sin(ph) * yiq.y - cos(ph) * yiq.z), 0.0, 1.0);
}`;

  // decode: notch luma out with a one-cycle box, demodulate chroma against the carrier over two cycles
  const COMP_DEC = COMMON + `
uniform sampler2D uComp;
uniform vec2 uRes;
uniform float uFrame, u_composite;
` + COMPOSITE + `
vec2 at(float x, float y) { vec2 s = texelFetch(uComp, ivec2(clamp(x, 0.0, uRes.x - 1.0), y), 0).rg; return vec2(s.r, s.g * 2.0 - 1.0); }
float wire(float x, float y) { vec2 s = at(x, y); return s.r + s.g; }   // composite: luma and chroma on one wire
float notchY(float x, float y) { return 0.25 * (wire(x - 2.0, y) + wire(x - 1.0, y) + wire(x, y) + wire(x + 1.0, y)); }
void main() {
  vec2 px = floor(vUv * uRes);
  float line = uRes.y - 1.0 - px.y;
  bool comp = u_composite > 1.5;
  float Y = comp ? notchY(px.x, px.y) : at(px.x, px.y).r;
  vec2 iq = vec2(0.0);
  for (int k = -4; k < 4; k++) {
    float x = px.x + float(k);
    float c = comp ? wire(x, px.y) - notchY(x, px.y) : at(x, px.y).g;
    float ph = carrier(x, line);
    iq += c * vec2(sin(ph), -cos(ph));
  }
  o = vec4(YIQ2RGB * vec3(Y, iq * 0.25), 1.0);   // 2 / 8 taps: the sin^2 average is one half
}`;

  // ---------------------------------------------------------------- glow
  const COPY = COMMON + `
uniform sampler2D uTex;
void main() { o = vec4(texture(uTex, vUv).rgb, 1.0); }`;

  // copy into linear light, so the glow pyramid blurs light rather than signal values
  const LINCOPY = COMMON + `
uniform sampler2D uTex;
void main() { o = vec4(toLin(texture(uTex, vUv).rgb), 1.0); }`;

  const BLUR = COMMON + `
uniform sampler2D uTex;
uniform vec2 uDir;
void main() {
  vec3 c = texture(uTex, vUv).rgb * 0.2270270;
  c += (texture(uTex, vUv + uDir * 1.3846).rgb + texture(uTex, vUv - uDir * 1.3846).rgb) * 0.3162162;
  c += (texture(uTex, vUv + uDir * 3.2308).rgb + texture(uTex, vUv - uDir * 3.2308).rgb) * 0.0702703;
  o = vec4(c, 1.0);
}`;

  window.AtlasShaders = { VERT, COMMON, MOSH, SIGNAL, COMP_ENC, COMP_DEC, COPY, LINCOPY, BLUR };
})();
