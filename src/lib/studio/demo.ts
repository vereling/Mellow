import { CATALOG } from "@/lib/audio/catalog";
import type { AssetMeta, Project, Track, TrackColor } from "@/lib/studio/types";

function asset(id: string): AssetMeta {
  const item = CATALOG.find((entry) => entry.id === id);
  if (!item) throw new Error(`Missing sound ${id}`);
  return {
    id: item.id,
    name: item.name,
    group: item.group,
    duration: item.seconds,
    peaks: [],
    builtin: true,
    hint: item.hint,
  };
}

function layer(
  id: string,
  name: string,
  color: TrackColor,
  volume: number,
  reverb: number,
  reverbSize: number,
  sound: AssetMeta,
): Track {
  return {
    id,
    name,
    color,
    volume,
    reverb,
    reverbSize,
    muted: false,
    solo: false,
    clips: [
      {
        id: `clip-${id}`,
        assetId: sound.id,
        startSec: 0,
        offsetSec: 0,
        durationSec: sound.duration,
      },
    ],
  };
}

export function catalogAssets() {
  return CATALOG.map((item) => asset(item.id));
}

export function demoProject(): Project {
  const keys = asset("builtin:honey-keys");
  const kit = asset("builtin:dusty-kit");
  const bass = asset("builtin:warm-bass");
  const air = asset("builtin:air-pad");
  return {
    name: "First Light",
    bpm: 90,
    loop: true,
    masterVolume: 0.86,
    masterReverb: 0.28,
    masterReverbSize: 0.52,
    tracks: [
      layer("track-keys", "Honey Keys", "honey", 0.74, 0.36, 0.58, keys),
      layer("track-kit", "Dusty Kit", "clay", 0.58, 0.16, 0.28, kit),
      layer("track-bass", "Warm Bass", "sage", 0.66, 0.22, 0.36, bass),
      layer("track-air", "Air", "mist", 0.4, 0.66, 0.8, air),
    ],
  };
}

export function blankProject(): Project {
  return {
    name: "Untitled",
    bpm: 90,
    loop: false,
    masterVolume: 0.86,
    masterReverb: 0.22,
    masterReverbSize: 0.45,
    tracks: [
      {
        id: "track-1",
        name: "Track 1",
        color: "honey",
        volume: 0.8,
        reverb: 0.2,
        reverbSize: 0.4,
        muted: false,
        solo: false,
        clips: [],
      },
    ],
  };
}
