import type { Project, Track } from "@/lib/studio/types";

export function arrangementEnd(project: Project) {
  let end = 0;
  for (const track of project.tracks) {
    for (const clip of track.clips) {
      end = Math.max(end, clip.startSec + clip.durationSec);
    }
  }
  return end;
}

export function soloActive(project: Project) {
  return project.tracks.some((track) => track.solo);
}

export function isAudible(track: Track, solo: boolean) {
  if (track.muted) return false;
  if (solo && !track.solo) return false;
  return true;
}

export function arrangementSignature(project: Project) {
  return project.tracks
    .map((track) =>
      [
        track.id,
        ...track.clips.map(
          (clip) =>
            `${clip.id}@${clip.startSec.toFixed(4)}+${clip.offsetSec.toFixed(4)}~${clip.durationSec.toFixed(4)}>${clip.assetId}`,
        ),
      ].join(","),
    )
    .join("|");
}
