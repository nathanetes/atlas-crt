// Atlas CRT MP4 writer. Takes the encoded video and audio that WebCodecs produces and lays them out
// as a standard MP4, with the index at the front so the file plays as soon as it's opened.
(function () {
  const text = (s) => Uint8Array.from(s, (c) => c.charCodeAt(0));
  const u32 = (v) => [v >>> 24 & 255, v >>> 16 & 255, v >>> 8 & 255, v & 255];
  const u16 = (v) => [v >> 8 & 255, v & 255];
  const concat = (parts) => {
    let n = 0;
    for (const p of parts) n += p.length;
    const out = new Uint8Array(n);
    n = 0;
    for (const p of parts) { out.set(p, n); n += p.length; }
    return out;
  };
  const box = (type, ...parts) => {
    const body = concat(parts.map((p) => (p instanceof Uint8Array ? p : Uint8Array.from(p))));
    return concat([Uint8Array.from(u32(body.length + 8)), text(type), body]);
  };
  const full = (type, version, flags, ...parts) => box(type, [version, flags >> 16 & 255, flags >> 8 & 255, flags & 255], ...parts);
  const matrix = [...u32(0x10000), ...u32(0), ...u32(0), ...u32(0), ...u32(0x10000), ...u32(0), ...u32(0), ...u32(0), ...u32(0x40000000)];

  // a run-length table of how long each sample lasts
  function timeTable(durations) {
    const runs = [];
    for (const d of durations) {
      const last = runs[runs.length - 1];
      if (last && last[1] === d) last[0]++; else runs.push([1, d]);
    }
    return full('stts', 0, 0, u32(runs.length), runs.flatMap(([n, d]) => [...u32(n), ...u32(d)]));
  }

  function sampleTable(track, offset) {
    const sizes = track.samples.map((s) => s.data.length);
    const parts = [
      full('stsd', 0, 0, u32(1), track.entry),
      timeTable(track.samples.map((s) => s.duration)),
      full('stsc', 0, 0, u32(1), [...u32(1), ...u32(track.samples.length), ...u32(1)]),
      full('stsz', 0, 0, u32(0), u32(sizes.length), sizes.flatMap(u32)),
      full('stco', 0, 0, u32(1), u32(offset)),
    ];
    if (track.video) {
      const keys = track.samples.flatMap((s, i) => (s.key ? [i + 1] : []));
      parts.push(full('stss', 0, 0, u32(keys.length), keys.flatMap(u32)));
    }
    return box('stbl', ...parts);
  }

  function trackBox(track, id, offset, movieScale) {
    const length = track.samples.reduce((n, s) => n + s.duration, 0);
    const movieLength = Math.round((length / track.scale) * movieScale);
    const tkhd = full('tkhd', 0, 3, u32(0), u32(0), u32(id), u32(0), u32(movieLength), new Array(8).fill(0),
      u16(0), u16(0), u16(track.video ? 0 : 0x100), u16(0), matrix, u32((track.width || 0) * 65536), u32((track.height || 0) * 65536));
    const mdhd = full('mdhd', 0, 0, u32(0), u32(0), u32(track.scale), u32(length), u16(0x55c4), u16(0));
    const hdlr = full('hdlr', 0, 0, u32(0), text(track.video ? 'vide' : 'soun'), new Array(12).fill(0), text(track.video ? 'Atlas CRT video\0' : 'Atlas CRT sound\0'));
    const head = track.video ? full('vmhd', 0, 1, new Array(8).fill(0)) : full('smhd', 0, 0, new Array(4).fill(0));
    const dinf = box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1)));
    return box('trak', tkhd, box('mdia', mdhd, hdlr, box('minf', head, dinf, sampleTable(track, offset))));
  }

  const descriptor = (tag, body) => [tag, 0x80, 0x80, 0x80, body.length, ...body];

  class Mp4Writer {
    constructor() { this.tracks = []; }

    // codec 'avc' or 'hevc'; p3 tags the picture's colour as Display P3 rather than Rec. 709
    video({ width, height, codec, scale, description, p3 }) {
      const primaries = p3 ? 12 : 1, transfer = 1, matrixId = 1;
      const colr = box('colr', text('nclx'), u16(primaries), u16(transfer), u16(matrixId), [0]);
      const config = box(codec === 'hevc' ? 'hvcC' : 'avcC', new Uint8Array(description));
      const entry = box(codec === 'hevc' ? 'hvc1' : 'avc1', new Array(6).fill(0), u16(1), new Array(16).fill(0), u16(width), u16(height),
        u32(0x480000), u32(0x480000), u32(0), u16(1), new Array(32).fill(0), u16(0x18), u16(0xffff), config, colr);
      const track = { video: true, width, height, scale, entry, samples: [] };
      this.tracks.push(track);
      return track;
    }

    // AAC-LC; description is the encoder's AudioSpecificConfig
    audio({ sampleRate, channels, description, bitrate }) {
      const asc = [...new Uint8Array(description)];
      const decoder = descriptor(4, [0x40, 0x15, 0, 0, 0, ...u32(bitrate), ...u32(bitrate), ...descriptor(5, asc)]);
      const esds = full('esds', 0, 0, descriptor(3, [0, 1, 0, ...decoder, ...descriptor(6, [2])]));
      const entry = box('mp4a', new Array(6).fill(0), u16(1), new Array(8).fill(0), u16(channels), u16(16), u32(0), u32(sampleRate * 65536), esds);
      const track = { video: false, scale: sampleRate, entry, samples: [] };
      this.tracks.push(track);
      return track;
    }

    add(track, chunk, duration) {
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      track.samples.push({ data, duration, key: chunk.type === 'key' });
    }

    finish() {
      const ftyp = box('ftyp', text('isom'), u32(512), text('isomiso2avc1mp41'));
      const movieScale = 1000;
      const moovFor = (base) => {
        let offset = base;
        const traks = this.tracks.map((t, i) => {
          const b = trackBox(t, i + 1, offset, movieScale);
          offset += t.samples.reduce((n, s) => n + s.data.length, 0);
          return b;
        });
        const longest = Math.max(...this.tracks.map((t) => t.samples.reduce((n, s) => n + s.duration, 0) / t.scale));
        const mvhd = full('mvhd', 0, 0, u32(0), u32(0), u32(movieScale), u32(Math.round(longest * movieScale)), u32(0x10000), u16(0x100), new Array(10).fill(0),
          matrix, new Array(24).fill(0), u32(this.tracks.length + 1));
        return box('moov', mvhd, ...traks);
      };
      const moovSize = moovFor(0).length;
      const moov = moovFor(ftyp.length + moovSize + 8);
      const payload = this.tracks.reduce((n, t) => n + t.samples.reduce((m, s) => m + s.data.length, 0), 0);
      const mdat = concat([Uint8Array.from(u32(payload + 8)), text('mdat')]);
      return new Blob([ftyp, moov, mdat, ...this.tracks.flatMap((t) => t.samples.map((s) => s.data))], { type: 'video/mp4' });
    }
  }

  window.AtlasMp4 = Mp4Writer;
})();
