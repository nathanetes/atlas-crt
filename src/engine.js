// Atlas CRT WebGL2 engine: source upload -> (datamosh) -> signal raster -> glow pyramids -> screen.
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
      };
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

    _target(w, h, mip) {
      const gl = this.gl;
      w = Math.max(2, Math.round(w)); h = Math.max(2, Math.round(h));
      const tex = this._texture(mip);
      if (this.half) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
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
      const aspect = this.srcW / this.srcH;
      // SD/HI line counts are set on the short side, so portrait clips keep the same pitch
      const lines = r.lines ? Math.round(r.lines / Math.min(1, aspect)) : Math.min(this.srcH, this.expH);
      const width = Math.min(this.maxTex, Math.round(lines * aspect * r.wide));
      [this.sig, this.low, this.mosh, this.A, this.B, this.C, this.D, this.comp].forEach(set => set && set.forEach(t => this._free(t)));
      const pair = () => [this._target(width, lines, true), this._target(width, lines, true)];
      this.sig = pair();
      this.comp = [this._target(COMP_W, lines, false), this._target(COMP_W, lines, true)]; // encoded wire, decoded picture
      this.low = pair();   // this frame's and last frame's source at raster size, for motion
      this.mosh = pair();  // datamosh feedback
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
      return true;
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
      gl.bindVertexArray(this.vao);
      gl.disable(gl.BLEND);
      // interlaced rasters draw one field per frame: 0 = even rows, 1 = odd rows; -1 = progressive
      const U = { uTime: time, uFrame: frame % 8192, uField: RASTER[this.quality].interlaced ? frame & 1 : -1 };
      for (const k in params) U['u_' + k] = params[k];
      Object.assign(U, extra);

      const cur = this.sig[this.ping], prev = this.sig[1 - this.ping];
      U.uRes = [cur.w, cur.h];

      // keep the last two source frames at raster size so datamosh can estimate motion
      const lowCur = this.low[this.lowPing], lowPrev = this.low[1 - this.lowPing];
      this._pass(this.progs.copy, lowCur, {}, { uTex: this.srcTex });
      this._mips(lowCur);
      this.lowPing = 1 - this.lowPing;

      let signalSrc = this.srcTex, srcRes = [this.srcW, this.srcH];
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
      U.uSrcRes = srcRes;
      U.uSrcAspect = this.srcW / this.srcH;
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
      this._pass(this.progs.screen, null, U, {
        uSig: picture, uBlurA: this.A[0].tex, uBlurB: this.B[0].tex, uBlurC: this.C[0].tex, uBlurD: this.D[0].tex, uSrc: this.srcTex,
      });
      this.ping = 1 - this.ping;
      return true;
    }
  }

  window.AtlasEngine = AtlasEngine;
})();
