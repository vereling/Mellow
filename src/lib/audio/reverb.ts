import { mulberry32 } from "@/lib/audio/rng";

const cache = new WeakMap<BaseAudioContext, Map<number, AudioBuffer>>();

export function impulseFor(ctx: BaseAudioContext, size: number) {
  const quantized = Math.round(Math.min(1, Math.max(0, size)) * 16) / 16;
  let bucket = cache.get(ctx);
  if (!bucket) {
    bucket = new Map();
    cache.set(ctx, bucket);
  }
  const cached = bucket.get(quantized);
  if (cached) return cached;
  const made = makeImpulse(ctx, quantized);
  bucket.set(quantized, made);
  return made;
}

function makeImpulse(ctx: BaseAudioContext, size: number) {
  const seconds = 0.32 + size * 3.5;
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  const decay = 1.5 + (1 - size) * 5.2;
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    const rand = mulberry32((channel === 0 ? 0xa11ce : 0xbee5) + Math.round(size * 1000));
    for (let i = 0; i < length; i++) {
      const env = Math.pow(1 - i / length, decay);
      data[i] = (rand() * 2 - 1) * env;
    }
    const taps = [0.007, 0.013, 0.021, 0.034, 0.049];
    for (const tap of taps) {
      const index = Math.floor(tap * ctx.sampleRate * (0.65 + size));
      if (index > 0 && index < length) data[index] += (rand() > 0.5 ? 0.7 : -0.7);
    }
    let prev = 0;
    const damp = 0.32 + size * 0.48;
    for (let i = 0; i < length; i++) {
      prev = prev * damp + (data[i] ?? 0) * (1 - damp);
      data[i] = prev;
    }
  }
  return buffer;
}

export function equalPower(amount: number) {
  const wetness = Math.min(1, Math.max(0, amount));
  return {
    dry: Math.cos((wetness * Math.PI) / 2),
    wet: Math.sin((wetness * Math.PI) / 2),
  };
}
