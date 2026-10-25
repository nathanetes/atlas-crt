// Atlas CRT shader sources. Four programs: signal (the damaged video signal at the
// tube's raster), copy + blur (glow pyramids), and screen (the filmed tube itself).
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
`;

  // ---------------------------------------------------------------- signal
  const SIGNAL = COMMON + `
uniform sampler2D uSrc;
uniform sampler2D uPrev;
uniform vec2 uRes;
uniform float uTime, uFrame;
uniform float u_gain, u_chroma, u_hueDrift, u_bleed, u_rgbSplit, u_sharpen;
uniform float u_bend, u_bendMotion, u_bendFreq, u_bendQ, u_bendBoost, u_bendLo, u_bendHi, u_bendFb, u_bendDelay;
uniform float u_shake, u_tear, u_roll, u_flash, u_dropout, u_dropStyle, u_hum, u_echo, u_headSwitch, u_topLine;
uniform float u_rf, u_speckSize, u_grain;
uniform float u_waves, u_waveCount, u_waveReact, u_waveSmooth, u_waveOrient, u_waveColor, u_waveDir, u_waveBlend;
uniform float u_persistence;

const mat3 RGB2YIQ = mat3(0.299, 0.596, 0.211, 0.587, -0.274, -0.523, 0.114, -0.322, 0.312);
const mat3 YIQ2RGB = mat3(1.0, 1.0, 1.0, 0.956, -0.272, -1.106, 0.621, -0.647, 1.703);

vec3 src(vec2 uv) { return texture(uSrc, uv).rgb; }
float srcY(vec2 uv) { return lum(texture(uSrc, uv).rgb); }

void main() {
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

  // composite decode: split, chroma bleed, sharpening
  float sd = u_rgbSplit * 0.008;
  vec3 rgb = vec3(texture(uSrc, suv + vec2(sd, 0.0)).r, texture(uSrc, suv).g, texture(uSrc, suv - vec2(sd, 0.0)).b);
  vec3 yiq = RGB2YIQ * rgb;

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
    float px = 1.25 / uRes.x;
    float yb = 0.5 * (srcY(suv - vec2(px, 0.0)) + srcY(suv + vec2(px, 0.0)));
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
    yiq.x += (hash12(gl_FragCoord.xy + fract(fr * 0.618) * 917.0) - 0.5) * u_grain * 0.22;
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
  rgb = max(rgb, texture(uPrev, vUv).rgb * u_persistence * 0.94);
  o = vec4(max(rgb, 0.0), 1.0);
}`;

  // ---------------------------------------------------------------- glow
  const COPY = COMMON + `
uniform sampler2D uTex;
void main() { o = vec4(texture(uTex, vUv).rgb, 1.0); }`;

  const BLUR = COMMON + `
uniform sampler2D uTex;
uniform vec2 uDir;
void main() {
  vec3 c = texture(uTex, vUv).rgb * 0.2270270;
  c += (texture(uTex, vUv + uDir * 1.3846).rgb + texture(uTex, vUv - uDir * 1.3846).rgb) * 0.3162162;
  c += (texture(uTex, vUv + uDir * 3.2308).rgb + texture(uTex, vUv - uDir * 3.2308).rgb) * 0.0702703;
  o = vec4(c, 1.0);
}`;

  // ---------------------------------------------------------------- screen
  const SCREEN = COMMON + `
uniform sampler2D uSig, uBlurA, uBlurB, uSrc;
uniform vec2 uOut, uSigRes;
uniform float uTime, uFrame, uAspect, uSplit, uScale;
uniform float u_mix, u_bright, u_contrast, u_postGlow, u_halation;
uniform float u_maskType, u_maskScale, u_phosphor, u_scanlines, u_refresh, u_persistence;
uniform float u_sync, u_ripple, u_flicker, u_softness, u_pbloom, u_overscan;
uniform float u_capture, u_shutter, u_pulseContrast, u_bandAngle, u_readout, u_moire, u_rainbow;
uniform float u_conv, u_convAngle, u_pconv;
uniform float u_glow, u_spectral, u_curve, u_stretch, u_fisheye, u_outside, u_extend, u_vignette, u_tint;

vec3 sigLine(float l, float x) {
  l = clamp(l, 0.0, uSigRes.y - 1.0);
  return textureLod(uSig, vec2(x, (l + 0.5) / uSigRes.y), 0.0).rgb;
}
// one scanline's beam: brighter lines draw wider, normalised so average light holds
vec3 beamW(vec3 c, float d) {
  vec3 s = (0.2 + 0.12 * clamp(c, 0.0, 1.5) * (0.5 + u_pbloom)) * (1.0 + u_softness);
  return c * exp(-d * d / (2.0 * s * s)) / (s * 2.5066);
}
vec3 beam(vec2 uv) {
  float yl = uv.y * uSigRes.y - 0.5;
  float l0 = floor(yl), f = yl - l0;
  vec3 c0 = sigLine(l0, uv.x), c1 = sigLine(l0 + 1.0, uv.x);
  vec3 lin = mix(c0, c1, f);
  float amt = u_scanlines * smoothstep(2.0, 3.5, uOut.y / uSigRes.y);
  if (amt < 0.001) return lin;
  vec3 sc = beamW(sigLine(l0 - 1.0, uv.x), f + 1.0) + beamW(c0, f) + beamW(c1, 1.0 - f) + beamW(sigLine(l0 + 2.0, uv.x), 2.0 - f);
  return mix(lin, sc, amt);
}

// sub-stripe width in canvas pixels; uScale shrinks it for the fitted preview
float maskPitch(int type) {
  return (type == 3 ? mix(0.67, 1.6, u_maskScale) : mix(1.0, 4.0, u_maskScale)) * uScale;
}
vec3 triad(float x) { vec3 c = 0.5 + 0.5 * cos(6.2831853 * (x - vec3(0.0, 0.33333, 0.66667))); return c * c; }
vec3 maskAt(vec2 fc) {
  int type = int(u_maskType + 0.5);
  float u = maskPitch(type);
  if (type == 1) return triad(fc.x / (3.0 * u)) * 2.4;            // aperture grille
  if (type == 0 || type == 3) {                                     // slot mask / fine slot
    float col = floor(fc.x / (3.0 * u));
    float y = fract(fc.y / (3.45 * u) + mod(col, 2.0) * 0.5);
    float gap = smoothstep(0.7, 0.8, y) * (1.0 - smoothstep(0.92, 1.0, y));
    return triad(fc.x / (3.0 * u)) * (1.0 - 0.85 * gap) * 2.7;
  }
  if (type == 2) {                                                  // delta dot shadow mask
    vec2 g = fc / (u * 2.0);
    float row = floor(g.y);
    g.x += mod(row, 2.0) * 0.5;
    vec2 id = floor(g);
    float d = length((fract(g) - 0.5) * vec2(1.0, 1.15));
    float ch = mod(id.x + 2.0 * row, 3.0);
    vec3 m = vec3(float(ch < 0.5), float(ch > 0.5 && ch < 1.5), float(ch > 1.5));
    return m * (1.0 - smoothstep(0.32, 0.5, d)) * 4.8;
  }
  vec2 f = fract(fc / (3.0 * u));                                    // square grid
  float rowLit = smoothstep(0.0, 0.15, f.y) * (1.0 - smoothstep(0.85, 1.0, f.y));
  return triad(fc.x / (3.0 * u)) * rowLit * 3.0;
}

void main() {
  vec2 uv = vUv;
  float t = uTime;
  vec2 p = uv * 2.0 - 1.0;

  // deflection: sync wander, supply ripple, overscan, glass and lens
  float slip = step(0.985, hash11(floor(t * 8.0))) * (hash11(floor(t * 8.0) + 3.0) - 0.5);
  p.y += u_sync * (0.012 * (vnoise1(t * 2.3) - 0.5) + 0.08 * slip);
  p.x += u_ripple * 0.006 * sin(6.2831853 * (uv.y * 2.0 - t * 0.5));
  p *= 1.0 - u_overscan * 0.18;
  vec2 ph = p * vec2(uAspect, 1.0);
  float r2 = dot(ph, ph) / (uAspect * uAspect + 1.0);
  p *= 1.0 + (u_curve * 0.3 + u_fisheye * 0.22) * r2;
  p.y += u_stretch * 0.1 * (1.0 - p.y * p.y);
  vec2 suv = p * 0.5 + 0.5;

  float inside = 1.0;
  if (u_extend > 0.5) {
    suv = clamp(suv, 0.0, 1.0);
  } else {
    float rad = u_curve * 0.12;
    vec2 q = abs(suv - 0.5) * 2.0 * vec2(uAspect, 1.0) - vec2(uAspect, 1.0) + rad;
    float sdf = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - rad;
    float px = 2.0 / uOut.y;
    inside = 1.0 - smoothstep(-px, px, sdf);
  }

  // beams with convergence error
  vec3 col;
  if (u_conv > 0.001) {
    float a = radians(u_convAngle);
    vec2 coff = (p * 0.006 + vec2(cos(a), sin(a)) * 0.004) * u_conv;
    col = vec3(beam(suv + coff).r, beam(suv).g, beam(suv - coff).b);
  } else {
    col = beam(suv);
  }

  // phosphor mask, drawn on the glass so it follows the curve
  if (u_phosphor > 0.001) {
    vec2 mfc = suv * uOut;
    vec3 m;
    if (u_pconv > 0.001) {
      float sh = u_pconv * 1.5 * maskPitch(int(u_maskType + 0.5));
      m = vec3(maskAt(mfc + vec2(sh, 0.0)).r, maskAt(mfc).g, maskAt(mfc - vec2(sh, 0.0)).b);
    } else {
      m = maskAt(mfc);
    }
    // a mask finer than the canvas can show is drawn as its average instead of aliasing
    m = mix(vec3(0.92), m, smoothstep(0.55, 1.2, maskPitch(int(u_maskType + 0.5))));
    m = mix(m, vec3(1.0), clamp((lum(col) - 0.55) * 1.5, 0.0, 1.0) * u_pbloom);
    col *= mix(vec3(1.0), m, u_phosphor);
  }

  // light spreading in the signal path and the glass
  vec3 bA = texture(uBlurA, suv).rgb;
  vec3 bB = texture(uBlurB, suv).rgb;
  // bloom from highlights plus a faint veil, so mid-tones keep their scanline gaps
  col += (max(bA - 0.25, 0.0) * 1.1 + bA * 0.1) * u_postGlow;
  col += (max(bB - 0.3, 0.0) * 1.5 + bB * 0.15) * u_glow;
  if (u_spectral > 0.001) {
    vec2 so = p * 0.02 * u_spectral;
    vec3 sb = vec3(texture(uBlurA, suv + so).r, bA.g, texture(uBlurA, suv - so).b);
    col += max(sb - 0.25, 0.0) * u_spectral * 1.6 * vec3(1.0, 0.9, 1.2);
  }
  if (u_halation > 0.001) col += bB * vec3(1.0, 0.32, 0.14) * smoothstep(0.35, 1.0, lum(bB)) * u_halation * 1.8;

  // camera filming the tube: scan pulse against the shutter
  if (u_capture > 0.001) {
    float yT = 1.0 - suv.y;
    float ys = yT + tan(radians(clamp(u_bandAngle, -85.0, 85.0))) * (suv.x - 0.5) * uAspect * 0.5;
    ys = u_readout > 1.0 ? (1.0 - ys) * u_readout : ys * (1.0 + u_readout * 0.6);
    float beat = u_refresh - 30.0 * floor(u_refresh / 30.0 + 0.5);
    float pos = fract(t * (beat * 0.6 + 0.12));
    float expo = clamp(u_refresh / u_shutter, 0.02, 4.0);
    float d = fract(pos - ys);
    float tau = 0.015 + u_persistence * 0.5;
    float fe = fract(expo);
    float lit = 1.0 - smoothstep(fe - 0.015, fe + 0.015, d);
    float pulse;
    if (expo < 1.0) {
      float tail = exp(-max(d - fe, 0.0) / tau);
      pulse = max(lit, tail) / pow(fe + tau * (1.0 - exp(-(1.0 - fe) / tau)), 0.7);
    } else {
      pulse = (floor(expo) + lit) / expo;
    }
    col *= mix(1.0, pulse, clamp(u_capture * u_pulseContrast * 0.6, 0.0, 1.2));
  }
  if (u_moire + u_rainbow > 0.001) {
    vec2 q = suv * vec2(uAspect, 1.0) * 1000.0;
    float mph = 6.2831853 * (q.x * 0.011 + q.y * 0.0037 + 0.35 * sin(q.y * 0.006 + t * 0.4)) * (1.0 + 2.5 * r2 * (0.3 + u_curve));
    col *= mix(1.0, 0.45 + 1.1 * (0.5 + 0.5 * cos(mph + t * 0.8)), u_moire * 0.8);
    vec3 rb = 0.5 + 0.5 * cos(mph * 0.6 + t * 0.5 + vec3(0.0, 2.094, 4.189));
    col *= mix(vec3(1.0), 0.45 + 1.1 * rb, u_rainbow * 0.75);
  }
  col *= 1.0 - u_flicker * (0.1 * hash11(uFrame * 0.61 + 0.3) + 0.05 * sin(t * 47.0));
  col *= 1.0 - u_vignette * 0.55 * smoothstep(0.3, 1.0, r2);

  // grade, soft shoulder, dry/wet, outside the tube
  col = max((col - 0.5) * u_contrast + 0.5 + u_bright, 0.0);
  col = mix(col, 0.8 + 0.2 * tanh((col - 0.8) / 0.2), step(0.8, col));

  // monochrome tubes: one phosphor, whose hottest cores burn toward white
  int tint = int(u_tint + 0.5);
  if (tint > 0) {
    vec3 ph = tint == 1 ? vec3(0.239, 1.0, 0.447) : tint == 2 ? vec3(1.0, 0.69, 0.18) : vec3(0.93, 0.96, 1.0);
    float l = lum(col);
    col = ph * l + max(l - 0.75, 0.0) * 0.8 * (vec3(1.0) - ph);
  }
  vec3 dry = texture(uSrc, uv).rgb;
  float a = u_outside > 0.5 ? mix(1.0, inside, u_mix) : 1.0;
  col = mix(dry, col * inside, u_mix);
  if (uv.x < uSplit) { col = dry; a = 1.0; }
  o = vec4(col * a, a);
}`;

  window.AtlasShaders = { VERT, SIGNAL, COPY, BLUR, SCREEN };
})();
