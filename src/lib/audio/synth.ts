import { CATALOG, DEMO_BPM, LOOP_BARS, LOOP_SEC } from "@/lib/audio/catalog";
import { computePeaks } from "@/lib/audio/peaks";
import { mulberry32 } from "@/lib/audio/rng";
import type { AssetMeta } from "@/lib/studio/types";

const SR = 44100;

function midiHz(midi: number) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function mix(left: Float32Array, right: Float32Array, index: number, sample: number, pan: number) {
  if (index < 0 || index >= left.length) return;
  if (pan === 0) {
    left[index] += sample;
    right[index] += sample;
    return;
  }
  const angle = ((pan + 1) * Math.PI) / 4;
  left[index] += sample * Math.cos(angle);
  right[index] += sample * Math.sin(angle);
}

function addNote(
  left: Float32Array,
  right: Float32Array,
  sr: number,
  t0: number,
  dur: number,
  freq: number,
  amp: number,
  timbre: "ep" | "bass" | "pad",
  pan: number,
) {
  const start = Math.floor(t0 * sr);
  const count = Math.floor(dur * sr);
  const w1 = (2 * Math.PI * freq) / sr;
  const w2 = (2 * Math.PI * freq * (timbre === "bass" ? 2 : 2.003)) / sr;
  const w3 = (2 * Math.PI * freq * 3.01) / sr;
  let p1 = 0;
  let p2 = 0;
  let p3 = 0;
  for (let i = 0; i < count; i++) {
    const idx = start + i;
    if (idx >= left.length) break;
    const t = i / sr;
    p1 += w1;
    p2 += w2;
    p3 += w3;
    let sample = 0;
    if (timbre === "ep") {
      const env = Math.min(1, t / 0.012) * Math.exp(-t * 1.35);
      const trem = 0.9 + 0.1 * Math.sin(2 * Math.PI * 4.4 * t);
      sample =
        (Math.sin(p1) * 0.72 +
          Math.sin(p2) * 0.22 * Math.exp(-t * 3.2) +
          Math.sin(p3) * 0.08 * Math.exp(-t * 6)) *
        env *
        trem *
        amp;
    } else if (timbre === "bass") {
      const env = Math.min(1, t / 0.008) * Math.exp(-t * 2.35);
      sample = Math.tanh((Math.sin(p1) + Math.sin(p2) * 0.28 * Math.exp(-t * 6)) * 1.35) * env * amp;
    } else {
      const release = t > dur - 0.45 ? Math.max(0, (dur - t) / 0.45) : 1;
      const env = Math.min(1, t / 0.3) * release;
      sample = (Math.sin(p1) * 0.62 + Math.sin(p2) * 0.26 + Math.sin(p3) * 0.12) * env * amp;
    }
    mix(left, right, idx, sample, pan);
  }
}

function addKick(left: Float32Array, right: Float32Array, sr: number, t0: number, amp: number) {
  const count = Math.floor(0.48 * sr);
  const start = Math.floor(t0 * sr);
  let phase = 0;
  for (let i = 0; i < count; i++) {
    const t = i / sr;
    const freq = 46 + 150 * Math.exp(-t * 24);
    phase += (2 * Math.PI * freq) / sr;
    const env = Math.exp(-t * 6.5);
    const click = i < 180 ? Math.sin(i * 0.55) * Math.exp(-t * 80) * 0.32 : 0;
    const sample = (Math.sin(phase) * env + click) * amp;
    const idx = start + i;
    if (idx >= left.length) break;
    left[idx] += sample;
    right[idx] += sample;
  }
}

function addSnare(
  left: Float32Array,
  right: Float32Array,
  sr: number,
  t0: number,
  amp: number,
  rand: () => number,
) {
  const count = Math.floor(0.24 * sr);
  const start = Math.floor(t0 * sr);
  let prev = 0;
  let band = 0;
  for (let i = 0; i < count; i++) {
    const t = i / sr;
    const noise = rand() * 2 - 1;
    band = band * 0.62 + noise * 0.38;
    const high = noise - prev;
    prev = noise;
    const body = Math.sin(2 * Math.PI * 186 * t) * Math.exp(-t * 18);
    const env = Math.exp(-t * 14);
    const sample = (high * 0.55 + band * 0.22 + body * 0.48) * env * amp;
    const idx = start + i;
    if (idx >= left.length) break;
    left[idx] += sample;
    right[idx] += sample * 0.95;
  }
}

function addHat(
  left: Float32Array,
  right: Float32Array,
  sr: number,
  t0: number,
  amp: number,
  open: boolean,
  rand: () => number,
) {
  const count = Math.floor((open ? 0.18 : 0.045) * sr);
  const start = Math.floor(t0 * sr);
  let prev = 0;
  for (let i = 0; i < count; i++) {
    const t = i / sr;
    const noise = rand() * 2 - 1;
    const high = noise - prev;
    prev = noise;
    const sample = high * Math.exp(-t * (open ? 12 : 58)) * amp;
    const idx = start + i;
    if (idx >= left.length) break;
    left[idx] += sample;
    const rightIndex = idx + (open ? 17 : 9);
    if (rightIndex < right.length) right[rightIndex] += sample * 0.82;
    else right[idx] += sample;
  }
}

function addShaker(left: Float32Array, right: Float32Array, sr: number, t0: number, amp: number, rand: () => number) {
  const count = Math.floor(0.07 * sr);
  const start = Math.floor(t0 * sr);
  let prev = 0;
  let band = 0;
  for (let i = 0; i < count; i++) {
    const t = i / sr;
    const noise = rand() * 2 - 1;
    band = band * 0.45 + noise * 0.55;
    const high = noise - prev;
    prev = noise;
    const sample = (high * 0.65 + band * 0.35) * Math.exp(-t * 28) * amp;
    const idx = start + i;
    if (idx >= left.length) break;
    left[idx] += sample * 0.85;
    right[idx] += sample;
  }
}

function renderKeys(left: Float32Array, right: Float32Array, sr: number) {
  const beat = 60 / DEMO_BPM;
  const chords = [
    [62, 66, 69, 73],
    [59, 62, 66, 69],
    [64, 67, 71, 74],
    [57, 61, 64, 66],
    [62, 66, 69, 73],
    [59, 62, 66, 69],
    [67, 71, 74, 78],
    [57, 61, 64, 66],
  ];
  const melody = [78, 74, 76, 73, 78, 74, 71, 73];
  for (let bar = 0; bar < LOOP_BARS; bar++) {
    const tBar = bar * 4 * beat;
    const chord = chords[bar] ?? chords[0]!;
    chord.forEach((note, index) => {
      addNote(left, right, sr, tBar, beat * 3.15, midiHz(note), 0.13, "ep", (index - 1.5) * 0.18);
    });
    addNote(left, right, sr, tBar + beat * 2, beat * 1.5, midiHz(melody[bar] ?? 74), 0.2, "ep", 0.22);
  }
}

function renderKit(left: Float32Array, right: Float32Array, sr: number) {
  const beat = 60 / DEMO_BPM;
  const step = beat / 4;
  for (let bar = 0; bar < LOOP_BARS; bar++) {
    for (let s = 0; s < 16; s++) {
      const t = bar * 4 * beat + s * step + (s % 2 === 1 ? step * 0.14 : 0);
      const rand = mulberry32(2000 + bar * 31 + s * 7);
      if (s === 6 || s === 14) addHat(left, right, sr, t, 0.26, true, rand);
      else addHat(left, right, sr, t, (s % 2 === 0 ? 0.16 : 0.08) * (0.92 + rand() * 0.12), false, rand);
      if (s === 0 || s === 10) addKick(left, right, sr, t, s === 0 ? 0.95 : 0.48);
      if (s === 4 || s === 12) addSnare(left, right, sr, t, s === 4 ? 0.52 : 0.4, rand);
    }
  }
  for (let i = 0; i < left.length; i++) {
    left[i] = Math.tanh((left[i] ?? 0) * 1.3);
    right[i] = Math.tanh((right[i] ?? 0) * 1.3);
  }
}

function renderBass(left: Float32Array, right: Float32Array, sr: number) {
  const beat = 60 / DEMO_BPM;
  const roots = [38, 35, 40, 45, 38, 35, 43, 45];
  const fifths = [45, 42, 47, 52, 45, 42, 50, 52];
  for (let bar = 0; bar < LOOP_BARS; bar++) {
    const tBar = bar * 4 * beat;
    addNote(left, right, sr, tBar, beat * 0.95, midiHz(roots[bar] ?? 38), 0.85, "bass", 0);
    addNote(left, right, sr, tBar + beat * 2, beat * 0.5, midiHz(fifths[bar] ?? 45), 0.42, "bass", 0);
    addNote(left, right, sr, tBar + beat * 3.5, beat * 0.32, midiHz(roots[bar] ?? 38), 0.32, "bass", 0);
  }
  dcBlock(left);
  dcBlock(right);
}

function renderPad(left: Float32Array, right: Float32Array, sr: number) {
  const beat = 60 / DEMO_BPM;
  const chords = [
    [50, 57, 62, 66, 69],
    [47, 54, 59, 62, 66],
    [52, 59, 64, 67, 71],
    [45, 52, 57, 61, 64],
    [50, 57, 62, 66, 69],
    [47, 54, 59, 62, 66],
    [55, 62, 67, 71, 74],
    [45, 52, 57, 61, 66],
  ];
  for (let bar = 0; bar < LOOP_BARS; bar++) {
    const tBar = bar * 4 * beat;
    const chord = chords[bar] ?? chords[0]!;
    chord.forEach((note, index) => {
      addNote(left, right, sr, tBar, beat * 4, midiHz(note), 0.11, "pad", (index - 2) * 0.22);
    });
  }
}

function renderShaker(left: Float32Array, right: Float32Array, sr: number) {
  const beat = 60 / DEMO_BPM;
  const step = beat / 4;
  for (let bar = 0; bar < LOOP_BARS; bar++) {
    for (let s = 0; s < 16; s++) {
      const t = bar * 4 * beat + s * step + (s % 2 === 1 ? step * 0.16 : 0);
      const accent = s % 4 === 0 ? 0.42 : 0.18;
      addShaker(left, right, sr, t, accent, mulberry32(8000 + bar * 13 + s));
    }
  }
}

function dcBlock(data: Float32Array) {
  const r = 0.995;
  let prevX = 0;
  let prevY = 0;
  for (let i = 0; i < data.length; i++) {
    const x = data[i] ?? 0;
    const y = x - prevX + r * prevY;
    prevX = x;
    prevY = y;
    data[i] = y;
  }
}

function fadeOut(left: Float32Array, right: Float32Array, sr: number) {
  const count = Math.min(left.length, Math.floor(sr * 0.012));
  for (let i = 0; i < count; i++) {
    const gain = i / count;
    const index = left.length - 1 - i;
    left[index] = (left[index] ?? 0) * gain;
    right[index] = (right[index] ?? 0) * gain;
  }
}

function normalize(left: Float32Array, right: Float32Array, peak: number) {
  let max = 0;
  for (let i = 0; i < left.length; i++) {
    max = Math.max(max, Math.abs(left[i] ?? 0), Math.abs(right[i] ?? 0));
  }
  if (max < 1e-5) return;
  const gain = peak / max;
  for (let i = 0; i < left.length; i++) {
    left[i] = (left[i] ?? 0) * gain;
    right[i] = (right[i] ?? 0) * gain;
  }
}

function renderItem(id: string) {
  const item = CATALOG.find((entry) => entry.id === id);
  const seconds = item?.seconds ?? 1;
  const length = Math.max(1, Math.floor(seconds * SR));
  const buffer = new AudioBuffer({ length, numberOfChannels: 2, sampleRate: SR });
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);
  if (id === "builtin:honey-keys") renderKeys(left, right, SR);
  else if (id === "builtin:dusty-kit") renderKit(left, right, SR);
  else if (id === "builtin:warm-bass") renderBass(left, right, SR);
  else if (id === "builtin:air-pad") renderPad(left, right, SR);
  else if (id === "builtin:soft-shaker") renderShaker(left, right, SR);
  else if (id === "builtin:kick") addKick(left, right, SR, 0, 0.95);
  else if (id === "builtin:snare") addSnare(left, right, SR, 0, 0.7, mulberry32(42));
  else if (id === "builtin:hat") addHat(left, right, SR, 0, 0.55, false, mulberry32(7));
  else if (id === "builtin:stab") {
    [62, 66, 69, 73].forEach((note, index) => {
      addNote(left, right, SR, 0, 1.25, midiHz(note), 0.22, "ep", (index - 1.5) * 0.2);
    });
  } else if (id === "builtin:sub") {
    addNote(left, right, SR, 0, 0.62, midiHz(38), 0.9, "bass", 0);
  }
  fadeOut(left, right, SR);
  normalize(left, right, id === "builtin:soft-shaker" ? 0.55 : 0.9);
  return buffer;
}

export function createBuiltins(): { asset: AssetMeta; buffer: AudioBuffer }[] {
  return CATALOG.map((item) => {
    const buffer = renderItem(item.id);
    return {
      buffer,
      asset: {
        id: item.id,
        name: item.name,
        group: item.group,
        duration: buffer.duration,
        peaks: computePeaks(buffer),
        builtin: true,
        hint: item.hint,
      },
    };
  });
}

export { LOOP_SEC };
