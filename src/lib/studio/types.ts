export type TrackColor = "honey" | "sage" | "clay" | "mist";

export type AssetGroup = "Loops" | "One-shots" | "Imported" | "Recordings";

export type Clip = {
  id: string;
  assetId: string;
  startSec: number;
  offsetSec: number;
  durationSec: number;
};

export type Track = {
  id: string;
  name: string;
  color: TrackColor;
  volume: number;
  reverb: number;
  reverbSize: number;
  muted: boolean;
  solo: boolean;
  clips: Clip[];
};

export type Project = {
  name: string;
  bpm: number;
  loop: boolean;
  masterVolume: number;
  masterReverb: number;
  masterReverbSize: number;
  tracks: Track[];
};

export type AssetMeta = {
  id: string;
  name: string;
  group: AssetGroup;
  duration: number;
  peaks: number[];
  builtin: boolean;
  hint: string;
};

export const TRACK_COLORS: TrackColor[] = ["honey", "sage", "clay", "mist"];

export function nextColor(index: number): TrackColor {
  return TRACK_COLORS[index % TRACK_COLORS.length] ?? "honey";
}
