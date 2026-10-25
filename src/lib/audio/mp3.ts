function floatTo16(input: Float32Array) {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const sample = Math.max(-1, Math.min(1, input[i] ?? 0));
    out[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return out;
}

export async function encodeMp3(buffer: AudioBuffer, kbps = 192) {
  const { Mp3Encoder } = await import("@breezystack/lamejs");
  const encoder = new Mp3Encoder(2, buffer.sampleRate, kbps);
  const left = floatTo16(buffer.getChannelData(0));
  const right = floatTo16(buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : buffer.getChannelData(0));
  const block = 1152;
  const parts: Uint8Array[] = [];
  for (let i = 0; i < left.length; i += block) {
    const chunk = encoder.encodeBuffer(left.subarray(i, i + block), right.subarray(i, i + block));
    if (chunk.length) parts.push(chunk);
  }
  const end = encoder.flush();
  if (end.length) parts.push(end);
  return new Blob(parts as BlobPart[], { type: "audio/mpeg" });
}
