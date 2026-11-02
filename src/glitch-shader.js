// Atlas CRT shader sources, part 3: the glitch pass. Four independent slots break the picture on its
// way to the tube. For each slot you pick what breaks (Type), when (Rate, Length, Chance), where
// (Position, Spread, Size, Width), which way (Direction), how it moves (Movement, Speed), the shape of
// its edges (Bands, Edge), and what colour it comes out (Color, Tint, Blend). Every value here is a
// pure function of the timeline, so exports repeat the preview.
(function () {
  const S = window.AtlasShaders;
  const SLOTS = [1, 2, 3, 4];
  const FIELDS = ['Amt', 'Type', 'Rate', 'Len', 'Chance', 'Size', 'Width', 'Count', 'Pos', 'Spread', 'Dir', 'Move', 'Speed', 'Edge', 'Tint', 'Blend', 'Seed'];

  const slot = (i) => `
  if (u_g${i}Amt > 0.001) {
    // when: Rate windows a second, each firing with Chance and staying on for Length seconds
    float rate = max(u_g${i}Rate, 0.01), win = t * rate, id = floor(win), seed = u_g${i}Seed * 7.13 + ${i}.0 * 19.7;
    float on = step(hash11(id * 0.731 + seed), u_g${i}Chance) * step(fract(win) / rate, u_g${i}Len);
    if (on > 0.5) {
      float amt = u_g${i}Amt, fr = floor(t * 30.0);
      int type = int(u_g${i}Type + 0.5), move = int(u_g${i}Move + 0.5);
      // which way: d is along the direction, n across it; bands stack across it
      float dirA = radians(u_g${i}Dir);
      vec2 d = vec2(cos(dirA), sin(dirA)), n = vec2(-d.y, d.x);
      vec2 p = uv0 - 0.5;
      float a = dot(p, d) + 0.5, b = dot(p, n) + 0.5;
      // where, and how it moves
      float cy = mix(u_g${i}Pos, hash11(id * 1.31 + seed), u_g${i}Spread);
      float ph = t * u_g${i}Speed;
      if (move == 1) cy = hash11(floor(t * max(u_g${i}Speed * 8.0, 1.0)) * 0.77 + seed);
      else if (move == 2) cy = fract(cy + ph);
      else if (move == 3) cy = fract(cy - ph);
      else if (move == 4) cy += 0.08 * sin(ph * 6.2831853);
      else if (move == 5) cy = abs(fract(cy * 0.5 + ph * 0.5) * 2.0 - 1.0);
      // stepped edges: bands and regions break up in blocks rather than ruled lines
      float count = max(u_g${i}Count, 1.0);
      float step32 = floor(a * 28.0);
      float be = b + u_g${i}Edge * (hash12(vec2(step32, id + seed)) - 0.5) * 0.9 / count;
      float dy = abs(be - cy); dy = min(dy, 1.0 - dy);
      float reg = step(dy, u_g${i}Size * 0.5) * step(abs(a - 0.5), u_g${i}Width * 0.5 + 0.0005);
      if (reg > 0.5) {
        float band = floor(be * count);
        float r = hash12(vec2(band, id + seed)), r2 = hash12(vec2(band + 3.7, id * 1.7 + seed));
        if (type == 0) {         // Slice Shift
          uv += d * (r - 0.5) * amt * 0.6;
        } else if (type == 1) {  // Block Shift
          vec2 cell = floor(vec2(a * count * aspect, be * count));
          float c1 = hash12(cell + id + seed), c2 = hash12(cell.yx + id * 1.3 + seed);
          if (c1 < 0.25 + amt * 0.6) uv += (d * (c2 - 0.5) + n * (c1 - 0.5) * 0.4) * amt * 0.5;
        } else if (type == 2) {  // Line Hold
          float a0 = 0.5 + (r - 0.5) * 0.7;
          uv += d * (a0 - a) * amt;
        } else if (type == 3) {  // Mosaic
          vec2 c = vec2(count * aspect, count) * (1.1 - amt);
          uv = mix(uv, (floor(uv * c) + 0.5) / c, 1.0);
        } else if (type == 4) {  // Pixel Sort
          sortD = d * amt * 0.28; sortOn = 1.0;
        } else if (type == 5) {  // Sparkle Dashes
          vec2 g = vec2(a * (6.0 + count * 0.5), b * (40.0 + count * 3.0));
          vec2 c = floor(g);
          float h = hash12(c + fr * 0.37 + seed);
          float w = hash12(c + 4.1 + seed);
          float dash = step(1.0 - amt * 0.22, h) * step(abs(fract(g.x) - 0.5), 0.15 + 0.35 * w) * step(abs(fract(g.y) - 0.5), 0.34);
          add += mix(vec3(1.0), u_g${i}Color, u_g${i}Tint) * dash * (0.65 + 0.6 * w);
        } else if (type == 6) {  // Streaks
          float line = floor(b * (count * 10.0));
          float h = hash12(vec2(line, id + seed));
          float run = smoothstep(0.35, 0.75, vnoise(vec2(a * 9.0 + h * 40.0, fr * 0.15 + line)));
          add += mix(vec3(1.0), u_g${i}Color, u_g${i}Tint) * step(1.0 - amt * 0.16, h) * run * 0.8;
        } else if (type == 7) {  // RGB Tear
          split += d * (r - 0.5 + 0.2 * sign(r - 0.5)) * amt * 0.09;
        } else if (type == 8) {  // Freeze
          hold = max(hold, amt);
        } else {                 // Invert
          inv = max(inv, amt);
        }
        if (u_g${i}Tint > 0.001 && type != 5 && type != 6) {
          tintC[${i - 1}] = u_g${i}Color; tintA[${i - 1}] = u_g${i}Tint * (0.6 + 0.4 * r2); tintM[${i - 1}] = int(u_g${i}Blend + 0.5);
        }
      }
    }
  }`;

  S.GLITCH = S.COMMON + `
uniform sampler2D uSig, uHist;
uniform float uTl, uAspect;
${SLOTS.map((i) => `uniform float ${FIELDS.map((f) => `u_g${i}${f}`).join(', ')};\nuniform vec3 u_g${i}Color;`).join('\n')}

vec3 blendTint(vec3 c, vec3 k, int mode) {
  if (mode == 1) return c + k;                                        // Add
  if (mode == 2) return 1.0 - (1.0 - c) * (1.0 - k);                  // Screen
  if (mode == 3) return c * k;                                        // Multiply
  if (mode == 4) return abs(c - k);                                   // Difference
  if (mode == 5) { float y = lum(c); return k * (y * 1.5); }          // Color
  return k;                                                           // Normal
}

void main() {
  vec2 uv0 = vUv, uv = vUv, split = vec2(0.0), sortD = vec2(0.0);
  float t = uTl, aspect = uAspect, hold = 0.0, inv = 0.0, sortOn = 0.0;
  vec3 add = vec3(0.0), tintC[4];
  float tintA[4]; int tintM[4];
  for (int i = 0; i < 4; i++) { tintA[i] = 0.0; tintC[i] = vec3(0.0); tintM[i] = 0; }
${SLOTS.map(slot).join('\n')}
  vec3 c = dot(split, split) > 0.0
    ? vec3(texture(uSig, uv + split).r, texture(uSig, uv).g, texture(uSig, uv - split).b)
    : texture(uSig, uv).rgb;
  if (sortOn > 0.5) {
    // drag the brightest thing along the direction, a stand-in for sorting pixels
    float best = lum(c);
    for (int k = 1; k <= 18; k++) {
      vec3 s = texture(uSig, uv - sortD * float(k) / 18.0).rgb;
      float l = lum(s);
      if (l > best + 0.02) { best = l; c = s * (1.0 - float(k) / 18.0 * 0.25); }
    }
  }
  if (hold > 0.0) c = mix(c, texture(uHist, uv0).rgb, hold);
  if (inv > 0.0) c = mix(c, 1.0 - c, inv);
  for (int i = 0; i < 4; i++) if (tintA[i] > 0.0) c = mix(c, blendTint(c, tintC[i], tintM[i]), tintA[i]);
  o = vec4(max(c + add, 0.0), 1.0);
}`;
})();
