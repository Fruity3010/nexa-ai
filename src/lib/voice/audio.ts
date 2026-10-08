// Telephony audio conversion. Twilio Media Streams carry 8 kHz G.711 μ-law; Gemini Live takes
// 16-bit PCM (we declare 8 kHz and let it resample) and returns 16-bit PCM at 24 kHz.
// Pure functions, no dependencies: shared by the voice bridge and its tests.

const BIAS = 0x84;
const CLIP = 32635;

const DECODE = new Int16Array(256).map((_, i) => {
  const u = ~i & 0xff;
  const exp = (u >> 4) & 7;
  const s = (((u & 0x0f) << 3) + BIAS) << exp;
  return u & 0x80 ? BIAS - s : s - BIAS;
});

export function encodeMulawSample(sample: number): number {
  const sign = sample < 0 ? 0x80 : 0;
  let s = Math.min(Math.abs(sample), CLIP) + BIAS;
  let exp = 7;
  for (let mask = 0x4000; (s & mask) === 0 && exp > 0; exp--, mask >>= 1);
  s = (s >> (exp + 3)) & 0x0f;
  return ~(sign | (exp << 4) | s) & 0xff;
}

/** μ-law bytes → 16-bit little-endian PCM (same sample rate). */
export function mulawToPcm16(mulaw: Buffer): Buffer {
  const out = Buffer.alloc(mulaw.length * 2);
  for (let i = 0; i < mulaw.length; i++) out.writeInt16LE(DECODE[mulaw[i]], i * 2);
  return out;
}

/**
 * Stateful 24 kHz PCM16LE → 8 kHz μ-law converter. Chunks from the model are not guaranteed to be
 * a multiple of 3 samples (or even whole samples), so leftover bytes carry into the next call.
 * ponytail: 3-tap box filter as the anti-alias low-pass; fine for narrowband telephony, use a
 * proper FIR/polyphase resampler if audio quality complaints show up.
 */
export function createDownsampler24kTo8k() {
  let carry = Buffer.alloc(0);
  return (pcm24k: Buffer): Buffer => {
    const buf = carry.length ? Buffer.concat([carry, pcm24k]) : pcm24k;
    const frames = Math.floor(buf.length / 6); // 3 samples × 2 bytes
    const out = Buffer.alloc(frames);
    for (let i = 0; i < frames; i++) {
      const o = i * 6;
      out[i] = encodeMulawSample(Math.round((buf.readInt16LE(o) + buf.readInt16LE(o + 2) + buf.readInt16LE(o + 4)) / 3));
    }
    carry = Buffer.from(buf.subarray(frames * 6));
    return out;
  };
}
