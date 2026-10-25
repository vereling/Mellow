export function computePeaks(buffer: AudioBuffer, buckets = 180) {
  const left = buffer.getChannelData(0);
  const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : null;
  const count = Math.max(8, Math.min(buckets, left.length));
  const out = new Array<number>(count);
  const size = Math.max(1, Math.floor(left.length / count));
  for (let i = 0; i < count; i++) {
    const start = i * size;
    const end = Math.min(left.length, start + size);
    let max = 0;
    for (let j = start; j < end; j += 4) {
      const sample = Math.abs(left[j] ?? 0) + (right ? Math.abs(right[j] ?? 0) : 0);
      if (sample > max) max = sample;
    }
    out[i] = Math.min(1, max);
  }
  return out;
}
