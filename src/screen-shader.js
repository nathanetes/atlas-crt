// Atlas CRT shader sources, part 2: the screen pass. It draws the tube at output
// resolution (geometry, beams, phosphor mask, glow, the camera filming it and its moiré),
// then the post grade and the film stock on top.
(function () {
  const S = window.AtlasShaders;

  S.SCREEN = S.COMMON + `
uniform sampler2D uSig, uBlurA, uBlurB, uBlurC, uBlurD, uSrc;
uniform vec2 uOut, uSigRes;
uniform float uTime, uFrame, uAspect, uSplit, uScale;
uniform float u_mix, u_bright, u_contrast, u_postGlow, u_halation;
uniform float u_maskType, u_maskScale, u_phosphor, u_scanlines, u_refresh, u_persistence;
uniform float u_sync, u_ripple, u_flicker, u_softness, u_pbloom, u_overscan;
uniform float u_capture, u_shutter, u_pulseContrast, u_bandAngle, u_readout;
uniform float u_moire, u_rainbow, u_moireCover, u_moirePitch, u_moireAngle, u_moireRings, u_moireDrift;
uniform float u_conv, u_convAngle, u_pconv;
uniform float u_glow, u_spectral, u_curve, u_stretch, u_fisheye, u_outside, u_extend, u_vignette, u_tint, u_gamut;

// Tube phosphors to the viewer's sRGB display, in linear light, with no adaptation to the white point.
// SMPTE-C primaries (the P22 set used in NTSC studio monitors): R 0.630,0.340  G 0.310,0.595  B 0.155,0.070.
// D65 white 0.3127,0.3290; D93 is the CIE daylight locus at 9300 K, 0.2833,0.2973, scaled so its bluish white fits the display.
const mat3 P22_D65 = mat3(0.9395, 0.0178, -0.0016, 0.0502, 0.9658, -0.0044, 0.0103, 0.0164, 1.0060);
const mat3 P22_D93 = mat3(0.5845, 0.0111, -0.0010, 0.0378, 0.7270, -0.0033, 0.0103, 0.0164, 1.0043);
uniform float u_postExp, u_hue, u_sat, u_temp, u_tintGM, u_shHue, u_shAmt, u_hiHue, u_hiAmt, u_lift, u_gamma;
uniform float u_poster, u_solar, u_gmap, u_cross, u_invert, u_chanSwap, u_grunge, u_crush;
uniform float u_film, u_filmSize, u_filmColor, u_filmResp, u_filmVar, u_dust, u_dustOpacity, u_weave;

// one scanline of the signal, decoded to the light the beam puts out. Interlaced, the field just
// scanned glows brighter than the one fading from the frame before (gains average to 1), so detail
// one line tall flickers at half the field rate: line twitter.
uniform float uField;
const float FIELD_NOW = 1.33, FIELD_OLD = 0.67;
vec3 sigLine(float l, float x) {
  l = clamp(l, 0.0, uSigRes.y - 1.0);
  vec3 c = toLin(textureLod(uSig, vec2(x, (l + 0.5) / uSigRes.y), 0.0).rgb);
  if (uField >= 0.0) c *= mod(l, 2.0) == uField ? FIELD_NOW : FIELD_OLD;
  return c;
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

// sub-stripe width in canvas pixels, up to 12px at full Mask Scale; uScale shrinks it for the fitted preview
float maskPitch(int type) {
  return (type == 3 ? mix(0.67, 1.6, u_maskScale) : 1.0 + 11.0 * u_maskScale * u_maskScale) * uScale;
}
// The stripes' colour triad, averaged over a footprint w triad-periods wide. triad() is
// 0.375 + 0.5 cos + 0.125 cos(2x), and a box average scales each cosine by its sinc, so this is exact:
// with a one-pixel footprint, fine masks fade to their average instead of aliasing.
float sincN(float x) { return abs(x) < 1e-4 ? 1.0 : sin(x) / x; }
vec3 triadAvg(float x, float w) {
  vec3 th = 6.2831853 * (x - vec3(0.0, 0.33333, 0.66667));
  return 0.375 + 0.5 * sincN(3.14159265 * w) * cos(th) + 0.125 * sincN(6.2831853 * w) * cos(2.0 * th);
}
vec3 deltaDot(vec2 fc, float u) {
  vec2 g = fc / (u * 2.0);
  float row = floor(g.y);
  g.x += mod(row, 2.0) * 0.5;
  vec2 id = floor(g);
  float d = length((fract(g) - 0.5) * vec2(1.0, 1.15));
  float ch = mod(id.x + 2.0 * row, 3.0);
  vec3 m = vec3(float(ch < 0.5), float(ch > 0.5 && ch < 1.5), float(ch > 1.5));
  return m * (1.0 - smoothstep(0.32, 0.5, d)) * 4.8;
}
// the mask's light at a point, averaged over a square footprint fp canvas pixels wide
vec3 maskAt(vec2 fc, float fp) {
  int type = int(u_maskType + 0.5);
  float u = maskPitch(type);
  vec3 tri = triadAvg(fc.x / (3.0 * u), fp / (3.0 * u));
  if (type == 1) return tri * 2.4;                                  // aperture grille
  if (type == 0 || type == 3) {                                     // slot mask / fine slot
    float col = floor(fc.x / (3.0 * u));
    float y = fract(fc.y / (3.45 * u) + mod(col, 2.0) * 0.5);
    float gap = smoothstep(0.7, 0.8, y) * (1.0 - smoothstep(0.92, 1.0, y));
    gap = mix(gap, 0.21, smoothstep(0.3, 1.0, fp / (3.45 * u)));   // 0.21: the slot gaps' average
    return tri * (1.0 - 0.85 * gap) * 2.7;
  }
  if (type == 2) {                                                  // delta dot shadow mask: 2D, so supersampled
    if (fp < 0.5 * u) return deltaDot(fc, u);
    vec3 acc = vec3(0.0);
    for (int j = 0; j < 4; j++) for (int i = 0; i < 4; i++) acc += deltaDot(fc + (vec2(i, j) - 1.5) * fp / 4.0, u);
    return acc / 16.0;
  }
  vec2 f = fract(fc / (3.0 * u));                                    // square grid
  float rowLit = smoothstep(0.0, 0.15, f.y) * (1.0 - smoothstep(0.85, 1.0, f.y));
  rowLit = mix(rowLit, 0.85, smoothstep(0.3, 1.0, fp / (3.0 * u)));  // 0.85: the rows' average
  return tri * rowLit * 3.0;
}

float bayer4(vec2 p) {
  ivec2 q = ivec2(mod(p, 4.0));
  const float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  return (m[q.x + q.y * 4] + 0.5) / 16.0;
}
float grainN(vec2 p) { return (vnoise(p) + 0.5 * vnoise(p * 2.13 + 7.1) - 0.75) * 1.6; }

// ---------------------------------------------------------------- the tube

// where a point of the picture lands on the tube face, after deflection and the glass
struct Face { vec2 p, suv; float r2, inside; };
Face faceAt(vec2 uv) {
  float t = uTime;
  vec2 p = uv * 2.0 - 1.0;

  // deflection: gate weave, sync wander, supply ripple, overscan, glass and lens
  p += u_weave * vec2(0.008 * (vnoise1(t * 3.1) - 0.5), 0.012 * (vnoise1(t * 2.3 + 5.0) - 0.5));
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
  return Face(p, suv, r2, inside);
}

// the beams' light at a face point, with convergence error (before the phosphor mask)
vec3 beamLight(Face F) {
  vec2 p = F.p, suv = F.suv;
  vec3 col;
  if (u_conv > 0.001) {
    float a = radians(u_convAngle);
    vec2 coff = (p * 0.006 + vec2(cos(a), sin(a)) * 0.004) * u_conv;
    col = vec3(beam(suv + coff).r, beam(suv).g, beam(suv - coff).b);
  } else {
    col = beam(suv);
  }
  return col;
}

// the phosphor mask, drawn on the glass so it follows the curve, averaged over a footprint fp
// canvas pixels wide; above 1 the gaps go black
vec3 phosphorMask(Face F, vec3 col, float fp) {
  int mtype = int(u_maskType + 0.5);
  if (u_phosphor < 0.001) return vec3(1.0);
  vec2 mfc = F.suv * uOut;
  vec3 m;
  if (u_pconv > 0.001) {
    float sh = u_pconv * 1.5 * maskPitch(mtype);
    m = vec3(maskAt(mfc + vec2(sh, 0.0), fp).r, maskAt(mfc, fp).g, maskAt(mfc - vec2(sh, 0.0), fp).b);
  } else {
    m = maskAt(mfc, fp);
  }
  // each mask averages to 1 in linear light, so phosphor strength changes texture, not brightness
  // (measured means: slot 0.832, grille 0.9, delta 0.743, fine slot 0.832, grid 0.956)
  m /= mtype == 1 ? 0.9 : mtype == 2 ? 0.743 : mtype == 4 ? 0.956 : 0.832;
  m = mix(m, vec3(1.0), clamp((lum(toGam(col)) - 0.55) * 1.5, 0.0, 1.0) * u_pbloom);
  return max(mix(vec3(1.0), m, u_phosphor), 0.0);
}

vec3 tubeLight(Face F) {
  vec3 col = beamLight(F);
  return col * phosphorMask(F, col, 1.0);
}

// light spread in the signal path and the glass at a face point
vec3 glowLight(Face F) {
  vec2 p = F.p, suv = F.suv;
  // light spreading in the signal path and the glass; bloom from highlights plus a faint veil.
  // The pyramids hold linear light; thresholds are the old signal levels in linear (0.25 -> 0.047, 0.3 -> 0.071).
  // GLOW_LIN rescales the glow amounts so the factory looks keep the strength they had in signal values.
  const float GLOW_LIN = 0.3;
  vec3 bA = texture(uBlurA, suv).rgb;
  vec3 bB = texture(uBlurB, suv).rgb;
  vec3 glowL = (max(bA - 0.047, 0.0) * 1.1 + bA * 0.1) * u_postGlow;
  // glass glow: a bright core from the 1/8 level plus a long, soft tail from the 1/16 and 1/32
  // levels, the way light scattering in the faceplate falls off slowly rather than stopping
  const float GLOW_TAIL = 0.35;
  vec3 tail = 0.6 * texture(uBlurC, suv).rgb + 0.4 * texture(uBlurD, suv).rgb;
  glowL += (max(bB - 0.071, 0.0) * 1.5 + bB * 0.15 + tail * GLOW_TAIL) * u_glow;
  if (u_spectral > 0.001) {
    vec2 so = p * 0.02 * u_spectral;
    vec3 sb = vec3(texture(uBlurA, suv + so).r, bA.g, texture(uBlurA, suv - so).b);
    glowL += max(sb - 0.047, 0.0) * u_spectral * 1.6 * vec3(1.0, 0.9, 1.2);
  }
  if (u_halation > 0.001) glowL += bB * vec3(1.0, 0.32, 0.14) * smoothstep(0.35, 1.0, lum(toGam(bB))) * u_halation * 1.8;
  return glowL * GLOW_LIN;
}

// the light leaves the tube in its own phosphor colours
vec3 gamutOf(vec3 col) {
  int gamut = int(u_gamut + 0.5);
  if (gamut == 1) return max(P22_D65 * col, 0.0);
  if (gamut == 2) return max(P22_D93 * col, 0.0);
  return col;
}

// ---------------------------------------------------------------- moiré
// A camera filming a tube sees its flat sensor grid beat against the curved phosphor grid, and the
// beat shows as broad bands that cycle through the spectrum. They're drawn as an overlay on the whole
// tube face, whatever the mask is set to: Density sets how many bands, Angle turns them, Rings bends
// them into the lens's circles, and Drift lets them crawl the way they do when the camera breathes.
float moirePhase(Face F) {
  vec2 flatP = (vUv * 2.0 - 1.0) * vec2(uAspect, 1.0);  // the camera's flat frame
  vec2 faceP = F.p * vec2(uAspect, 1.0);                // the curved tube face
  float n = mix(1.5, 28.0, u_moirePitch * u_moirePitch); // bands per picture height
  float a = radians(2.0 * u_moireAngle + 6.0 * u_moireDrift * sin(uTime * 0.37));
  vec2 dir = vec2(sin(a), cos(a));                      // angle 0: horizontal bands
  float ph = 0.5 * n * dot(dir, faceP);
  ph += 3.0 * n * dot(dir, faceP - flatP);              // the glass bends them near the edges
  ph += u_moireRings * 1.5 * n * dot(flatP, flatP) / (uAspect * uAspect + 1.0); // the lens bends them into rings (corners at 1)
  return ph + u_moireDrift * (0.12 * uTime + 0.25 * sin(uTime * 0.71));
}
// On lit parts of the picture the bands tint it, as a camera would see. Coverage also adds them as
// light, so they carry into the dark parts where a real camera would record nothing.
vec3 moireOverlay(vec3 col, Face F) {
  float ph = moirePhase(F);
  vec3 rb = 0.5 + 0.5 * cos(6.2831853 * (ph - vec3(0.0, 0.33333, 0.66667))); // each channel averages 0.5
  float lb = 0.5 + 0.5 * cos(12.566371 * ph);
  col *= mix(vec3(1.0), 2.0 * rb, u_rainbow * 0.55);
  col *= mix(1.0, 0.4 + 1.2 * lb, u_moire * 0.6);
  vec3 light = (rb * u_rainbow + vec3(lb) * u_moire * 0.5) * u_moireCover * 0.35 * F.inside;
  return 1.0 - (1.0 - col) * (1.0 - min(light, 1.0));
}

void main() {
  vec2 uv = vUv;
  float t = uTime;
  Face F = faceAt(uv);
  vec2 p = F.p, suv = F.suv;
  float r2 = F.r2, inside = F.inside;
  vec3 col = gamutOf(tubeLight(F) + glowLight(F));

  // back to display values: the camera, lens and grade below are tuned on these.
  // TUBE_DRIVE is the set's contrast drive: 1.0 shows the signal's true level, 1.3 keeps
  // the brightness the factory looks were tuned at before the tube moved to linear light.
  const float TUBE_DRIVE = 1.3;
  col = toGam(col * TUBE_DRIVE);

  // the camera's moiré, laid over the whole tube face
  if (u_rainbow + u_moire > 0.001) col = moireOverlay(col, F);

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

  col *= 1.0 - u_flicker * (0.1 * hash11(uFrame * 0.61 + 0.3) + 0.05 * sin(t * 47.0));
  col *= 1.0 - u_vignette * 0.55 * smoothstep(0.3, 1.0, r2);

  // post grade: exposure, contrast, brightness and colour, a soft shoulder, then the creative colour
  col = basicGrade(col, u_postExp, u_bright, u_contrast, u_sat, u_temp, u_tintGM, u_hue);
  col = mix(col, 0.8 + 0.2 * tanh((col - 0.8) / 0.2), step(0.8, col));
  vec3 shC = hue2rgb(u_shHue / 360.0), hiC = hue2rgb(u_hiHue / 360.0);
  float l = lum(col);
  col += (shC - 0.5) * u_shAmt * 0.5 * (1.0 - smoothstep(0.0, 0.6, l));
  col += (hiC - 0.5) * u_hiAmt * 0.5 * smoothstep(0.4, 1.0, l);
  if (u_gmap > 0.001) col = mix(col, mix(shC * 0.12, mix(hiC, vec3(1.0), 0.3), smoothstep(0.0, 1.0, l)), u_gmap);
  if (u_cross > 0.001) col = mix(col, vec3(smoothstep(0.05, 0.95, col.r), col.g * 0.9 + 0.05, col.b * 0.7 + 0.15), u_cross);
  col = max(col, 0.0);
  col = u_lift >= 0.0 ? col * (1.0 - u_lift) + u_lift : max(col + u_lift, 0.0) / (1.0 + u_lift);
  col = pow(col, vec3(1.0 / u_gamma));
  if (u_solar > 0.001) col = mix(col, 1.0 - abs(1.0 - 2.0 * col), u_solar);
  if (u_poster > 0.001) { float lv = mix(24.0, 2.0, u_poster); col = floor(col * lv + 0.5) / lv; }
  col = mix(col, 1.0 - col, u_invert);
  int cs = int(u_chanSwap + 0.5);
  col = cs == 1 ? col.rbg : cs == 2 ? col.grb : cs == 3 ? col.gbr : cs == 4 ? col.brg : cs == 5 ? col.bgr : col;
  if (u_grunge > 0.001) {
    vec2 gq = uv * vec2(uAspect, 1.0);
    float dirt = smoothstep(0.35, 0.8, vnoise(gq * 3.0) * 0.6 + vnoise(gq * 11.0 + 4.0) * 0.4);
    vec3 g = mix(col, vec3(lum(col)) * vec3(1.05, 1.0, 0.85), 0.5);
    g *= 1.0 - dirt * 0.45;
    g = mix(g, g * vec3(0.88, 0.8, 0.6) * 1.6, dirt * 0.5);
    col = mix(col, (g - 0.5) * 1.15 + 0.47, u_grunge);
  }

  // monochrome tubes: one phosphor, whose hottest cores burn toward white
  int tint = int(u_tint + 0.5);
  if (tint > 0) {
    vec3 phc = tint == 1 ? vec3(0.239, 1.0, 0.447) : tint == 2 ? vec3(1.0, 0.69, 0.18) : vec3(0.93, 0.96, 1.0);
    float lt = lum(col);
    col = phc * lt + max(lt - 0.75, 0.0) * 0.8 * (vec3(1.0) - phc);
  }

  // film stock: grain that clumps and breathes, dust and scratches
  if (u_film > 0.001) {
    float sz = mix(1.0, 4.0, u_filmSize) * uScale;
    vec2 gp = gl_FragCoord.xy / max(sz, 0.35);
    vec2 off = vec2(hash11(uFrame * 0.13), hash11(uFrame * 0.71 + 3.0)) * 977.0;
    vec3 n = vec3(grainN(gp + off), grainN(gp + off + 31.7), grainN(gp + off + 67.3));
    vec3 g = mix(vec3(n.x), n, u_filmColor);
    float patchy = 1.0 + u_filmVar * (vnoise(uv * vec2(uAspect, 1.0) * 5.0 + uFrame * 0.37) - 0.5) * 1.6;
    float breathe = 1.0 + u_filmVar * (hash11(uFrame * 0.91) - 0.5) * 0.8;
    float lc = lum(col);
    float resp = exp(-pow((lc - mix(0.2, 0.8, u_filmResp)) / 0.4, 2.0)) * 0.8 + 0.2;
    col += g * u_film * 0.32 * resp * patchy * breathe * clamp(sz, 0.4, 1.0);
    col *= 1.0 + u_filmVar * 0.07 * (hash11(uFrame * 1.7) - 0.5);
  }
  if (u_dust > 0.001) {
    vec2 dq = uv * vec2(uAspect, 1.0) * 36.0;
    vec2 cell = floor(dq);
    if (hash12(cell + uFrame * 17.1) < u_dust * 0.025) {
      float d = length(fract(dq) - vec2(hash12(cell + 1.3), hash12(cell + 2.7)));
      float r = 0.05 + 0.2 * hash12(cell + 5.0);
      col = mix(col, vec3(hash12(cell + 9.0) > 0.5 ? 0.02 : 0.95), (1.0 - smoothstep(r * 0.5, r, d)) * 0.85 * u_dustOpacity);
    }
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float seed = floor(uFrame / (6.0 + fi * 3.0));
      float on = step(1.0 - u_dust * 0.6, hash11(seed * 2.1 + fi));
      float sx = hash11(seed * 1.3 + fi * 7.0) + 0.002 * sin(uv.y * 20.0 + seed);
      float w = 0.0006 + 0.001 * hash11(seed + fi * 3.0);
      float line = (1.0 - smoothstep(w * 0.5, w, abs(uv.x - sx))) * on;
      col = mix(col, vec3(0.9), line * 0.6 * u_dustOpacity * (0.4 + 0.6 * vnoise1(uv.y * 30.0 + seed)));
    }
  }
  if (u_crush > 0.001) { float lv = exp2(mix(7.0, 1.0, u_crush)); col = floor(col * lv + bayer4(gl_FragCoord.xy)) / lv; }
  col = max(col, 0.0);

  // dry/wet, compare split, outside the tube
  vec3 dry = texture(uSrc, uv).rgb;
  float a = u_outside > 0.5 ? mix(1.0, inside, u_mix) : 1.0;
  col = mix(dry, col * inside, u_mix);
  if (uv.x < uSplit) { col = dry; a = 1.0; }

  // triangular dither of about one 8-bit step, so glow falloff and dark gradients don't band
  vec2 dq = gl_FragCoord.xy + fract(uFrame * 0.618) * 113.0;
  col += (hash12(dq) + hash12(dq + 57.3) - 1.0) / 255.0;
  o = vec4(max(col, 0.0) * a, a);
}`;
})();
