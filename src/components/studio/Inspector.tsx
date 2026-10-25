import { cn } from "@/lib/cn";
import { useStudio } from "@/lib/studio/store";
import { sizeLabel } from "@/lib/studio/time";
import { useState } from "react";

function Fader({
  label,
  value,
  display,
  onChange,
  onCommit,
}: {
  label: string;
  value: number;
  display?: string;
  onChange: (value: number) => void;
  onCommit: () => void;
}) {
  return (
    <label className="flex min-h-11 flex-col justify-center gap-1">
      <span className="flex items-center justify-between text-xs text-muted">
        <span>{label}</span>
        <span className="font-mono tabular-nums text-fg">{display ?? Math.round(value * 100)}</span>
      </span>
      <input
        className="fader"
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        aria-label={label}
        onPointerDown={onCommit}
        onChange={(event) => onChange(Number(event.target.value) / 100)}
      />
    </label>
  );
}

export function Inspector() {
  const project = useStudio((state) => state.project);
  const selectedId = useStudio((state) => state.selectedTrackId);
  const snapshot = useStudio((state) => state.snapshot);
  const setTrack = useStudio((state) => state.setTrack);
  const setMaster = useStudio((state) => state.setMaster);
  const [which, setWhich] = useState<"track" | "project">("track");
  const track = project.tracks.find((item) => item.id === selectedId) ?? project.tracks[0];

  return (
    <section className="shrink-0 border-t border-line bg-surface px-4 py-3">
      <p className="pb-3 text-xs text-muted">Track reverb stays on that layer. Project reverb covers the whole mix.</p>
      <div className="mb-3 grid grid-cols-2 rounded-full bg-inset p-1 md:hidden">
        {(["track", "project"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setWhich(id)}
            className={cn(
              "h-10 rounded-full text-sm",
              which === id ? "bg-elevated font-medium text-fg" : "text-muted",
            )}
          >
            {id === "track" ? "Track" : "Project"}
          </button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className={cn(which === "track" ? "block" : "hidden", "md:block")}>
          {track ? (
            <div className="grid grid-cols-3 gap-3">
              <Fader
                label="Volume"
                value={track.volume}
                onCommit={snapshot}
                onChange={(value) => setTrack(track.id, { volume: value })}
              />
              <Fader
                label="Reverb"
                value={track.reverb}
                onCommit={snapshot}
                onChange={(value) => setTrack(track.id, { reverb: value })}
              />
              <Fader
                label="Size"
                value={track.reverbSize}
                display={sizeLabel(track.reverbSize)}
                onCommit={snapshot}
                onChange={(value) => setTrack(track.id, { reverbSize: value })}
              />
            </div>
          ) : (
            <p className="text-sm text-muted">Add a track to shape its level and reverb.</p>
          )}
          {track ? <p className="mt-2 truncate text-xs text-muted">{track.name}</p> : null}
        </div>
        <div className={cn(which === "project" ? "block" : "hidden", "md:block md:border-l md:border-line md:pl-4")}>
          <div className="grid grid-cols-3 gap-3">
            <Fader
              label="Master"
              value={project.masterVolume}
              onCommit={snapshot}
              onChange={(value) => setMaster({ masterVolume: value })}
            />
            <Fader
              label="Reverb"
              value={project.masterReverb}
              onCommit={snapshot}
              onChange={(value) => setMaster({ masterReverb: value })}
            />
            <Fader
              label="Size"
              value={project.masterReverbSize}
              display={sizeLabel(project.masterReverbSize)}
              onCommit={snapshot}
              onChange={(value) => setMaster({ masterReverbSize: value })}
            />
          </div>
          <p className="mt-2 text-xs text-muted">Project</p>
        </div>
      </div>
    </section>
  );
}
