// Atlas CRT WebGL2 engine: source upload -> (pre grade) -> (datamosh) -> (tape) -> signal raster -> glow pyramids -> screen.
// The signal raster is gamma-encoded; the glow pyramids and the screen's beams, mask and glow work in linear light.
(function () {
  const RASTER = {
    LO: { lines: 120, wide: 1.5 },
    SD: { lines: 240, wide: 1.5 },
    HI: { lines: 480, wide: 1.25 },
    '480i': { lines: 480, wide: 1.25, interlaced: true }, // two 240-line fields, one per frame
    FULL: { lines: 0, wide: 1 },
  };
  // composite video is always 188 subcarrier cycles across the active line, 4 samples per cycle
  const COMP_W = 752;
  // Pre Grade at these values leaves the source untouched, so its pass is skipped
  const PRE_NEUTRAL = { preExp: 0, preBright: 0, preContrast: 1, preSat: 1, preTemp: 0, preTint: 0, preHue: 0 };

  class AtlasEngine {
    constructor(canvas) {
      const gl = canvas.getContext('webgl2', {
        alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: true,
      });
      if (!gl) throw new Error('This browser does not support WebGL2.');
      this.gl = gl;
      this.canvas = canvas;
      this.half = !!gl.getExtension('EXT_color_buffer_float');
      this.vao = gl.createVertexArray();
      const S = window.AtlasShaders;
      this.progs = {
        mosh: this._program(S.VERT, S.MOSH),
        signal: this._program(S.VERT, S.SIGNAL),
        compEnc: this._program(S.VERT, S.COMP_ENC),
        compDec: this._program(S.VERT, S.COMP_DEC),
        copy: this._program(S.VERT, S.COPY),
        lincopy: this._program(S.VERT, S.LINCOPY),
        blur: this._program(S.VERT, S.BLUR),
        screen: this._program(S.VERT, S.SCREEN),
        sensor: this._program(S.VERT, S.SENSOR),
        demosaic: this._program(S.VERT, S.DEMOSAIC),
        pregrade: this._program(S.VERT, S.PREGRADE),
        tapemix: this._program(S.VERT, S.TAPEMIX),
        glitch: this._program(S.VERT, S.GLITCH),
        frame: this._program(S.VERT, S.FRAME),
      };
      this.tape = new window.AtlasTape();
      this.tapeLines = 0;
      this.fxPing = 0;
      this.ratio = 0; // 0 keeps the source's shape
      this.fill = true;
      this.srcStamp = 0;
      this.srcTex = this._texture(true);
      this.quality = 'SD';
      this.source = null;
      this.srcW = 0; this.srcH = 0;
      this.outW = 0; this.outH = 0;
      this.expW = 0; this.expH = 0; this.viewW = 0;
      this.ping = 0; this.lowPing = 0; this.moshPing = 0; this.moshFresh = true;
      this.maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    }

    _shader(type, text) {
      const gl = this.gl, s = gl.createShader(type);
      gl.shaderSource(s, text);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }

    _program(vs, fs) {
      const gl = this.gl, p = gl.createProgram();
      gl.attachShader(p, this._shader(gl.VERTEX_SHADER, vs));
      gl.attachShader(p, this._shader(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const locs = new Map(), samplers = [];
      const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) {
        const info = gl.getActiveUniform(p, i);
        const loc = gl.getUniformLocation(p, info.name);
        if (info.type === gl.SAMPLER_2D) samplers.push(info.name);
        locs.set(info.name, { loc, type: info.type });
      }
      return { p, locs, samplers };
    }

    _texture(mip) {
      const gl = this.gl, t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    }

    // the picture's shape: the source's, unless a ratio has been chosen
    get aspect() { return this.ratio || this.srcW / this.srcH; }

    // ratio 0 keeps the source's shape; fill crops to it, otherwise the picture fits inside with bars
    setFrame(ratio, fill) {
      this.ratio = ratio;
      this.fill = fill;
      this._resize();
    }

    // bytes: 8 bits a channel, for a target that gets read back or written from the CPU
    _target(w, h, mip, bytes) {
      const gl = this.gl;
      w = Math.max(2, Math.round(w)); h = Math.max(2, Math.round(h));
      const tex = this._texture(mip);
      if (this.half && !bytes) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      if (mip) gl.generateMipmap(gl.TEXTURE_2D);
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return { tex, fbo, w, h };
    }

    _mips(t) {
      this.gl.bindTexture(this.gl.TEXTURE_2D, t.tex);
      this.gl.generateMipmap(this.gl.TEXTURE_2D);
    }

    // alpha 0 marks a datamosh buffer as empty, so the first moshed frame starts clean
    _clear(t) {
      const gl = this.gl;
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }

    // Forget the frames that came before: phosphor persistence, the motion and datamosh buffers, the
    // glitch history Freeze holds, and the tape stage's last frame. An export calls this once it has
    // moved to the start, so nothing from where the playhead was bleeds into its first frames.
    resetHistory() {
      if (!this.sig) return;
      [this.sig, this.low, this.mosh, this.fx].forEach((pair) => pair.forEach((t) => this._clear(t)));
      this.moshFresh = true;
      this.tapeKey = null;
    }

    _free(t) {
      if (!t) return;
      this.gl.deleteTexture(t.tex);
      this.gl.deleteFramebuffer(t.fbo);
    }

    // el: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
    setSource(el, w, h, live) {
      this.source = el;
      this.live = live;
      this.srcW = w; this.srcH = h;
      this.srcDirty = true;
      this._resize();
    }

    setQuality(q) {
      if (!RASTER[q] || q === this.quality) return;
      this.quality = q;
      this._resize();
    }

    // export size: what stills and videos are rendered at
    setOutput(w, h) {
      this.expW = Math.round(w / 2) * 2; this.expH = Math.round(h / 2) * 2;
      this._applyView();
    }

    // preview size: the canvas renders smaller than the export while fitting the
    // window; pass null to render at full export size (100% view, exporting)
    setView(w) {
      this.viewW = w || 0;
      this._applyView();
    }

    _applyView() {
      if (!this.expW) return;
      let w = this.expW, h = this.expH;
      if (this.viewW && this.viewW < this.expW) {
        w = Math.max(2, Math.round(this.viewW / 2) * 2);
        h = Math.max(2, Math.round((w * this.expH) / this.expW / 2) * 2);
      }
      if (w === this.outW && h === this.outH) return;
      this.outW = w; this.outH = h;
      this.canvas.width = w; this.canvas.height = h;
      this._resize();
    }

    get raster() { return this.sig ? { w: this.sig[0].w, h: this.sig[0].h } : null; }

    _resize() {
      if (!this.srcW || !this.outW) return;
      const r = RASTER[this.quality];
      const aspect = this.aspect;
      // SD/HI line counts are set on the short side, so portrait clips keep the same pitch. A tape
      // holds more lines than SD, so while one plays the raster opens up to show them all.
      const lines = r.lines ? Math.round(Math.max(r.lines, this.tapeLines) / Math.min(1, aspect)) : Math.min(this.srcH, this.expH);
      const width = Math.min(this.maxTex, Math.round(lines * aspect * r.wide));
      [this.sig, this.low, this.mosh, this.fx, this.A, this.B, this.C, this.D, this.comp].forEach(set => set && set.forEach(t => this._free(t)));
      // the pre-graded source: twice the raster is plenty, since the signal pass reads it at raster size
      this._free(this.pre);
      this._free(this.framed);
      this.framed = this.ratio ? this._target(Math.min(this.maxTex, width * 2), lines * 2, true) : null;
      this.pre = this._target(Math.min(this.srcW, width * 2), Math.min(this.srcH, lines * 2), true);
      const pair = () => [this._target(width, lines, true), this._target(width, lines, true)];
      this.sig = pair();
      this.comp = [this._target(COMP_W, lines, false), this._target(COMP_W, lines, true)]; // encoded wire, decoded picture
      this.low = pair();   // this frame's and last frame's source at raster size, for motion
      this.mosh = pair();  // datamosh feedback
      this.fx = pair();    // the glitch pass, and its last frame for Freeze
      this.moshFresh = true;
      this.A = [this._target(this.outW / 4, this.outH / 4), this._target(this.outW / 4, this.outH / 4)];
      this.B = [this._target(this.outW / 8, this.outH / 8), this._target(this.outW / 8, this.outH / 8)];
      // wider levels for the long, soft tail of light scattering in the glass
      this.C = [this._target(this.outW / 16, this.outH / 16), this._target(this.outW / 16, this.outH / 16)];
      this.D = [this._target(this.outW / 32, this.outH / 32), this._target(this.outW / 32, this.outH / 32)];
    }

    _upload() {
      const gl = this.gl, el = this.source;
      if (!el) return false;
      if (el instanceof HTMLVideoElement && el.readyState < 2) return !this.srcDirty;
      if (!this.live && !this.srcDirty) return true;
      gl.bindTexture(gl.TEXTURE_2D, this.srcTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, el);
      gl.generateMipmap(gl.TEXTURE_2D);
      this.srcDirty = false;
      this.srcStamp = el instanceof HTMLVideoElement ? el.currentTime : this.srcStamp + (this.live ? 0 : 1);
      return true;
    }

    // The tape stage. ntsc-rs filters each scanline recursively, so it runs on the CPU: the frame is
    // read back at tape resolution, run through it, and uploaded again. A new frame runs 30 times a
    // second, like the tape it stands for. Returns null until the library has loaded.
    _runTape(src, params, time) {
      const gl = this.gl, T = this.tape;
      if (!T.ready) { T.load(); return null; }
      const aspect = this.aspect, lines = Math.round(params.vhsLines);
      const even = (v) => Math.max(2, Math.round(v / 2) * 2);
      const w = even(lines * Math.max(1, aspect)), h = even(lines / Math.min(1, aspect));
      if (!this.tapeIn || this.tapeIn.w !== w || this.tapeIn.h !== h) {
        [this.tapeIn, this.tapeWet, this.tapeOut].forEach((t) => this._free(t));
        this.tapeIn = this._target(w, h, false, true);
        this.tapeWet = this._target(w, h, false, true);
        this.tapeOut = this._target(w, h, true);
        this.tapeKey = null;
      }
      T.sync(params);
      const n = Math.floor(time * 30);
      const key = [n, T.version, this.srcStamp, w, ...Object.keys(PRE_NEUTRAL).map((k) => params[k])].join();
      if (key !== this.tapeKey) {
        this.tapeKey = key;
        this._pass(this.progs.copy, this.tapeIn, {}, { uTex: src });
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.tapeIn.fbo);
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, T.pixels(w, h));
        T.process(n);
        gl.bindTexture(gl.TEXTURE_2D, this.tapeWet.tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, T.pixels(w, h));
      }
      this._pass(this.progs.tapemix, this.tapeOut, { uMix: Math.min(1, params.vhs) }, { uDry: this.tapeIn.tex, uWet: this.tapeWet.tex });
      this._mips(this.tapeOut);
      return this.tapeOut;
    }

    _pass(prog, target, uniforms, textures) {
      const gl = this.gl;
      gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
      gl.viewport(0, 0, target ? target.w : this.outW, target ? target.h : this.outH);
      gl.useProgram(prog.p);
      prog.samplers.forEach((name, unit) => {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, textures[name]);
        gl.uniform1i(prog.locs.get(name).loc, unit);
      });
      for (const [name, { loc, type }] of prog.locs) {
        const v = uniforms[name];
        if (v === undefined || type === gl.SAMPLER_2D) continue;
        if (type === gl.FLOAT_VEC2) gl.uniform2f(loc, v[0], v[1]);
        else if (type === gl.FLOAT_VEC3) gl.uniform3f(loc, v[0], v[1], v[2]);
        else gl.uniform1f(loc, v);
      }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    _blur(pair, spread, iterations) {
      const prog = this.progs.blur, [a, b] = pair;
      for (let i = 0; i < iterations; i++) {
        this._pass(prog, b, { uDir: [spread / a.w, 0] }, { uTex: a.tex });
        this._pass(prog, a, { uDir: [0, spread / a.h] }, { uTex: b.tex });
      }
    }

    // params: flat {key: number}; time in seconds; frame is an integer counter;
    // extra: raw uniforms such as uSplit
    render(params, time, frame, extra) {
      const gl = this.gl;
      if (!this.sig || !this._upload()) return false;
      const tapeLines = params.vhs > 0.001 ? Math.round(params.vhsLines) : 0;
      if (tapeLines !== this.tapeLines) {
        this.tapeLines = tapeLines;
        this._resize();
        if (this.onraster) this.onraster();
      }
      gl.bindVertexArray(this.vao);
      gl.disable(gl.BLEND);
      // interlaced rasters draw one field per frame: 0 = even rows, 1 = odd rows; -1 = progressive
      const U = { uTime: time, uTl: time, uFrame: frame % 8192, uField: RASTER[this.quality].interlaced ? frame & 1 : -1 };
      for (const k in params) U['u_' + k] = params[k];
      // colour controls hold 0xRRGGBB, and arrive in the shaders as vec3
      for (const k of this.colorKeys || []) {
        const v = params[k];
        U['u_' + k] = [(v >> 16 & 255) / 255, (v >> 8 & 255) / 255, (v & 255) / 255];
      }
      Object.assign(U, extra);

      const cur = this.sig[this.ping], prev = this.sig[1 - this.ping];
      U.uRes = [cur.w, cur.h];

      // pre grade, only when it changes something
      let base = this.srcTex, baseRes = [this.srcW, this.srcH];
      if (this.framed) {
        const sa = this.srcW / this.srcH, ta = this.ratio;
        const wide = (this.fill ? sa > ta : sa < ta);
        const size = wide ? [ta / sa, 1] : [1, sa / ta];
        this._pass(this.progs.frame, this.framed, { uRectAt: [(1 - size[0]) / 2, (1 - size[1]) / 2], uRectSize: size }, { uTex: this.srcTex });
        this._mips(this.framed);
        base = this.framed.tex; baseRes = [this.framed.w, this.framed.h];
      }
      if (Object.keys(PRE_NEUTRAL).some((k) => Math.abs((params[k] ?? PRE_NEUTRAL[k]) - PRE_NEUTRAL[k]) > 1e-4)) {
        this._pass(this.progs.pregrade, this.pre, U, { uTex: base });
        this._mips(this.pre);
        base = this.pre.tex; baseRes = [this.pre.w, this.pre.h];
      }

      // keep the last two source frames at raster size so datamosh can estimate motion
      const lowCur = this.low[this.lowPing], lowPrev = this.low[1 - this.lowPing];
      this._pass(this.progs.copy, lowCur, {}, { uTex: base });
      this._mips(lowCur);
      this.lowPing = 1 - this.lowPing;

      let signalSrc = base, srcRes = baseRes;
      if (params.mosh > 0.001) {
        if (this.moshFresh) this.mosh.forEach((t) => this._clear(t));
        this.moshFresh = false;
        const mOut = this.mosh[this.moshPing], mPrev = this.mosh[1 - this.moshPing];
        this._pass(this.progs.mosh, mOut, U, { uCur: lowCur.tex, uPrev: lowPrev.tex, uMosh: mPrev.tex });
        this._mips(mOut);
        this.moshPing = 1 - this.moshPing;
        signalSrc = mOut.tex; srcRes = [mOut.w, mOut.h];
      } else {
        this.moshFresh = true;
      }
      if (params.vhs > 0.001) {
        const tape = this._runTape(signalSrc, params, time);
        if (tape) { signalSrc = tape.tex; srcRes = [tape.w, tape.h]; }
      }
      U.uSrcRes = srcRes;
      U.uSrcAspect = this.aspect;
      this._pass(this.progs.signal, cur, U, { uSrc: signalSrc, uPrev: prev.tex });
      this._mips(cur);

      // S-Video or composite: encode the raster onto a subcarrier and decode it again
      let picture = cur.tex;
      if (params.composite >= 0.5) {
        const [wire, decoded] = this.comp;
        const CU = { ...U, uRes: [wire.w, wire.h] };
        this._pass(this.progs.compEnc, wire, CU, { uSig: cur.tex });
        this._pass(this.progs.compDec, decoded, CU, { uComp: wire.tex });
        this._mips(decoded);
        picture = decoded.tex;
      }

      // glitches break the picture after the signal, so they still go through the tube
      if (params.g1Amt > 0.001 || params.g2Amt > 0.001 || params.g3Amt > 0.001 || params.g4Amt > 0.001) {
        const out = this.fx[this.fxPing], hist = this.fx[1 - this.fxPing];
        this._pass(this.progs.glitch, out, { ...U, uAspect: this.aspect }, { uSig: picture, uHist: hist.tex });
        this._mips(out);
        this.fxPing = 1 - this.fxPing;
        picture = out.tex;
      }

      this._pass(this.progs.lincopy, this.A[0], {}, { uTex: picture });
      this._blur(this.A, 1.2, 1);
      this._pass(this.progs.copy, this.B[0], {}, { uTex: this.A[0].tex });
      this._blur(this.B, 2.0, 2);
      this._pass(this.progs.copy, this.C[0], {}, { uTex: this.B[0].tex });
      this._blur(this.C, 2.0, 2);
      this._pass(this.progs.copy, this.D[0], {}, { uTex: this.C[0].tex });
      this._blur(this.D, 2.0, 2);

      U.uOut = [this.outW, this.outH];
      U.uSigRes = [cur.w, cur.h];
      U.uAspect = this.outW / this.outH;
      U.uScale = this.outH / this.expH;
      const tube = {
        uSig: picture, uBlurA: this.A[0].tex, uBlurB: this.B[0].tex, uBlurC: this.C[0].tex, uBlurD: this.D[0].tex, uSrc: base,
      };

      // a camera filming the tube, only while moiré is on. It always shoots at export resolution,
      // so the fitted preview shows the same photo as the export, scaled down through its mipmaps.
      U.uSensorRes = [1, 1]; U.uPitchS = 1; U.uExpRes = [this.expW, this.expH]; U.uCamAngle = 0; U.uCamStripe = 1;
      U.uCamShift = [0, 0]; U.uCamTilt = [0, 0]; U.uCamRoll = 0;
      let cameraTex = this.srcTex; // bound but unread when the camera is off
      if (Math.max(params.moire || 0, params.rainbow || 0) > 0.001) {
        // the grid the camera sees, sub-stripe width in export pixels: its own (Moiré Scale, from
        // single-pixel cells up) or, with Moiré Grid on Same as Screen, the tube's mask (maskPitch())
        const type = Math.round(params.maskType), ms = params.maskScale;
        const stripe = Math.round(params.moireGrid) === 4
          ? (type === 3 ? 0.67 + 0.93 * ms : 1 + 11 * ms * ms)
          : 0.5 + 7.5 * params.moireScale * params.moireScale;
        // two photosites per colour triad, so the Bayer filter's red and blue sites (every other
        // photosite) sit one triad apart; Density pulls the pitch off that, and the further off it is
        // the tighter the fringes: from broad bands (0) to streaks a few cells apart (1)
        const detune = 0.002 + 0.4 * params.moirePitch ** 3;
        const pitch = Math.max(1, 1.5 * stripe * (1 + detune));
        // Drift: the camera breathes, a slight zoom and turn that sets the fringes crawling
        const drift = params.moireDrift || 0;
        const breathe = 1 + 0.004 * drift * Math.sin(time * 0.53);
        // Sway: a hand holding the phone. It only has to move the camera a few grid pitches for the
        // fringes to sweep across the picture, and the tremble shears rows through the rolling shutter
        const sway = params.moireSway || 0;
        const hand = (a, b, c) => Math.sin(time * a) + 0.6 * Math.sin(time * b + 1.3) + 0.3 * Math.sin(time * c + 0.4);
        const reach = sway * stripe * 26;
        U.uCamShift = [reach * hand(0.37, 0.91, 2.3), reach * hand(0.29, 0.83, 1.9)];
        U.uCamRoll = sway * stripe * 0.7;
        U.uCamTilt = [params.moireTiltX * 0.2, params.moireTiltY * 0.2];
        const turn = params.moireAngle + 0.5 * drift * Math.sin(time * 0.37) + 0.5 * sway * hand(0.23, 0.71, 1.7);
        // enough photosites to cover the frame at any camera angle, with room for the lens bend, the
        // tilt and the hand. The buffers are only replaced when they're well off the size needed,
        // so a control on an LFO doesn't reallocate them every frame.
        const a = Math.abs(params.moireAngle * Math.PI / 180) + 0.04, c = Math.cos(a), s = Math.sin(a);
        const spare = 1.2 + 0.9 * Math.max(Math.abs(params.moireTiltX), Math.abs(params.moireTiltY));
        const needW = (this.expW * c + this.expH * s) * spare / pitch + reach * 3.8 / pitch + 4;
        const needH = (this.expW * s + this.expH * c) * spare / pitch + reach * 3.8 / pitch + 4;
        const cur2 = this.sensor;
        if (!cur2 || needW > cur2.w || needH > cur2.h || needW < cur2.w * 0.65 || needH < cur2.h * 0.65) {
          this._free(this.sensor); this._free(this.camera);
          const size = (v) => Math.ceil((v * 1.12) / 2) * 2;
          this.sensor = this._target(size(needW), size(needH), false);   // raw photosites
          this.camera = this._target(this.sensor.w, this.sensor.h, true); // the developed photo, mipmapped
        }
        U.uSensorRes = [this.sensor.w, this.sensor.h]; U.uPitchS = pitch * breathe; U.uCamStripe = stripe;
        U.uCamAngle = turn;
        this._pass(this.progs.sensor, this.sensor, U, tube);
        this._pass(this.progs.demosaic, this.camera, U, { ...tube, uSensor: this.sensor.tex });
        this._mips(this.camera);
        cameraTex = this.camera.tex;
      }
      this._pass(this.progs.screen, null, U, { ...tube, uSensor: cameraTex, uCamera: cameraTex });
      this.ping = 1 - this.ping;
      return true;
    }
  }

  window.AtlasEngine = AtlasEngine;
})();
