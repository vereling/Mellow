import { getBuffer } from "@/lib/audio/buffers";
import { audioBufferToWav, bufferToBase64 } from "@/lib/audio/wav";
import type { AssetGroup, AssetMeta, Clip, Project, Track, TrackColor } from "@/lib/studio/types";
import { TRACK_COLORS } from "@/lib/studio/types";

type FileAsset = {
  id: string;
  name: string;
  group: AssetGroup;
  wav: string;
};

export type MellowFile = {
  format: "mellow";
  version: 1;
  project: Project;
  assets: FileAsset[];
};

const GROUPS: AssetGroup[] = ["Loops", "One-shots", "Imported", "Recordings"];

function clamp(value: unknown, fallback: number, min: number, max: number) {
  const number = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, number));
}

function asColor(value: unknown): TrackColor {
  return TRACK_COLORS.includes(value as TrackColor) ? (value as TrackColor) : "honey";
}

function asGroup(value: unknown): AssetGroup {
  return GROUPS.includes(value as AssetGroup) ? (value as AssetGroup) : "Imported";
}

export async function serializeProject(project: Project, library: AssetMeta[]): Promise<MellowFile> {
  const ids = new Set<string>();
  for (const track of project.tracks) {
    for (const clip of track.clips) ids.add(clip.assetId);
  }
  const assets: FileAsset[] = [];
  for (const id of ids) {
    const buffer = getBuffer(id);
    if (!buffer) continue;
    const known = library.find((item) => item.id === id);
    assets.push({
      id,
      name: known?.name ?? "Sound",
      group: known?.group ?? (id.startsWith("builtin:") ? "Loops" : "Imported"),
      wav: bufferToBase64(audioBufferToWav(buffer)),
    });
  }
  return { format: "mellow", version: 1, project, assets };
}

export function parseMellow(raw: string, library: AssetMeta[]): { project: Project; assets: FileAsset[] } {
  const data = JSON.parse(raw) as Partial<MellowFile>;
  if (data.format !== "mellow" || !data.project || !Array.isArray(data.assets)) {
    throw new Error("That file isn't a Mellow project.");
  }
  const source = data.project;
  const tracks = Array.isArray(source.tracks) ? source.tracks.map(sanitizeTrack) : [];
  const project: Project = {
    name: typeof source.name === "string" && source.name.trim() ? source.name.slice(0, 80) : "Untitled",
    bpm: clamp(source.bpm, 90, 40, 240),
    loop: Boolean(source.loop),
    masterVolume: clamp(source.masterVolume, 0.86, 0, 1),
    masterReverb: clamp(source.masterReverb, 0.2, 0, 1),
    masterReverbSize: clamp(source.masterReverbSize, 0.45, 0, 1),
    tracks,
  };
  const known = new Map(library.map((asset) => [asset.id, asset.name]));
  const assets = data.assets
    .filter((asset) => asset && typeof asset.id === "string" && typeof asset.wav === "string")
    .map((asset) => ({
      id: asset.id,
      name: known.get(asset.id) ?? (typeof asset.name === "string" ? asset.name : "Sound"),
      group: asGroup(asset.group),
      wav: asset.wav,
    }));
  return { project, assets };
}

function sanitizeTrack(value: Partial<Track>, index: number): Track {
  const clips = Array.isArray(value.clips) ? value.clips.map(sanitizeClip).filter((clip) => clip !== null) : [];
  return {
    id: typeof value.id === "string" ? value.id : `track-${index + 1}`,
    name: typeof value.name === "string" && value.name.trim() ? value.name.slice(0, 60) : `Track ${index + 1}`,
    color: asColor(value.color),
    volume: clamp(value.volume, 0.8, 0, 1),
    reverb: clamp(value.reverb, 0.2, 0, 1),
    reverbSize: clamp(value.reverbSize, 0.4, 0, 1),
    muted: Boolean(value.muted),
    solo: Boolean(value.solo),
    clips,
  };
}

function sanitizeClip(value: Partial<Clip>): Clip | null {
  if (typeof value.assetId !== "string") return null;
  const duration = clamp(value.durationSec, 0, 0.05, 60 * 30);
  return {
    id: typeof value.id === "string" ? value.id : `clip-${value.assetId}`,
    assetId: value.assetId,
    startSec: clamp(value.startSec, 0, 0, 60 * 60),
    offsetSec: clamp(value.offsetSec, 0, 0, 60 * 30),
    durationSec: duration,
  };
}
