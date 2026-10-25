import { placeAt } from "@/lib/studio/actions";
import { engine } from "@/lib/audio/engine";
import { Waveform } from "@/components/studio/Waveform";
import { cn } from "@/lib/cn";
import { useStudio } from "@/lib/studio/store";
import { barLength, snapTime } from "@/lib/studio/time";
import type { Clip, Track, TrackColor } from "@/lib/studio/types";
import { Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

const FACE: Record<TrackColor, string> = {
  honey: "bg-honey text-ink",
  sage: "bg-sage text-ink",
  clay: "bg-clay text-ink",
  mist: "bg-mist text-ink",
};

const DOT: Record<TrackColor, string> = {
  honey: "bg-honey",
  sage: "bg-sage",
  clay: "bg-clay",
  mist: "bg-mist",
};

export function Timeline() {
  const tracks = useStudio((state) => state.project.tracks);
  const bpm = useStudio((state) => state.project.bpm);
  const px = useStudio((state) => state.pxPerSec);
  const snap = useStudio((state) => state.snap);
  const assets = useStudio((state) => state.assets);
  const selectedTrackId = useStudio((state) => state.selectedTrackId);
  const selectedClipId = useStudio((state) => state.selectedClipId);
  const selectTrack = useStudio((state) => state.selectTrack);
  const selectClip = useStudio((state) => state.selectClip);
  const setTrack = useStudio((state) => state.setTrack);
  const setClip = useStudio((state) => state.setClip);
  const toggleMute = useStudio((state) => state.toggleMute);
  const toggleSolo = useStudio((state) => state.toggleSolo);
  const deleteTrack = useStudio((state) => state.deleteTrack);
  const snapshot = useStudio((state) => state.snapshot);
  const lanesRef = useRef<HTMLDivElement>(null);
  const capRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const pxRef = useRef(px);
  pxRef.current = px;
  const [overId, setOverId] = useState<string | null>(null);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const x = engine.playhead() * pxRef.current;
      const transform = `translate3d(${x}px,0,0)`;
      if (capRef.current) capRef.current.style.transform = transform;
      if (lineRef.current) lineRef.current.style.transform = transform;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const end = tracks.reduce(
    (max, track) => Math.max(max, ...track.clips.map((clip) => clip.startSec + clip.durationSec), 0),
    0,
  );
  const bar = barLength(bpm);
  const bars = Math.max(16, Math.ceil(end / bar) + 2);
  const width = bars * bar * px + 48;
  const beat = bar / 4;

  function timeFromEvent(event: { clientX: number }) {
    const rect = lanesRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return Math.max(0, (event.clientX - rect.left) / px);
  }

  function seek(event: ReactPointerEvent) {
    if ((event.target as HTMLElement).closest("[data-clip]")) return;
    const trackId = (event.target as HTMLElement).closest("[data-track]")?.getAttribute("data-track");
    if (trackId) selectTrack(trackId);
    engine.seek(snapTime(timeFromEvent(event), bpm, snap));
  }

  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-auto bg-bg">
      <div className="flex w-max min-w-full">
        <div className="sticky left-0 z-20 w-36 shrink-0 border-r border-line bg-surface md:w-56">
          <div className="sticky top-0 z-30 flex h-10 items-center border-b border-line bg-surface px-3 text-xs text-muted">
            Tracks
          </div>
          {tracks.map((track) => (
            <TrackHeader
              key={track.id}
              track={track}
              selected={track.id === selectedTrackId}
              onSelect={() => selectTrack(track.id)}
              onName={(name) => setTrack(track.id, { name })}
              onMute={() => toggleMute(track.id)}
              onSolo={() => toggleSolo(track.id)}
              onDelete={() => deleteTrack(track.id)}
              onFocusName={snapshot}
            />
          ))}
          {tracks.length === 0 ? (
            <p className="px-3 py-6 text-sm text-muted">No tracks yet. Add one from Sounds.</p>
          ) : null}
        </div>
        <div className="relative" style={{ width }}>
          <div className="sticky top-0 z-30 h-10 border-b border-line bg-bg">
            {Array.from({ length: bars + 1 }, (_, index) => (
              <span
                key={index}
                className="absolute top-2 font-mono text-xs tabular-nums text-muted"
                style={{ left: index * bar * px + 6 }}
              >
                {index + 1}
              </span>
            ))}
            <div ref={capRef} className="pointer-events-none absolute top-0 left-0 h-10">
              <div className="absolute top-1.5 left-0 h-2.5 w-2.5 -translate-x-1/2 rotate-45 bg-honey" />
            </div>
          </div>
          <div ref={lanesRef} className="relative select-none" onPointerDown={seek}>
            <div className="pointer-events-none absolute inset-0">
              {Array.from({ length: bars * 4 + 1 }, (_, index) => (
                <div
                  key={index}
                  className={cn("absolute top-0 bottom-0 w-px", index % 4 === 0 ? "bg-line" : "bg-line/40")}
                  style={{ left: index * beat * px }}
                />
              ))}
            </div>
            {tracks.map((track) => (
              <div
                key={track.id}
                data-track={track.id}
                className={cn("relative h-24 border-b border-line", overId === track.id && "bg-elevated")}
                onDragOver={(event) => {
                  if (![...event.dataTransfer.types].includes("application/x-mellow-asset")) return;
                  event.preventDefault();
                  setOverId(track.id);
                }}
                onDragLeave={() => setOverId((current) => (current === track.id ? null : current))}
                onDrop={(event) => {
                  event.preventDefault();
                  setOverId(null);
                  const assetId = event.dataTransfer.getData("application/x-mellow-asset");
                  if (assetId) placeAt(track.id, assetId, timeFromEvent(event));
                }}
              >
                {track.clips.length === 0 ? (
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xs text-muted">
                    Drop a sound
                  </span>
                ) : null}
                {track.clips.map((clip) => (
                  <ClipView
                    key={clip.id}
                    clip={clip}
                    color={track.color}
                    px={px}
                    selected={clip.id === selectedClipId}
                    name={assets.find((asset) => asset.id === clip.assetId)?.name ?? "Sound"}
                    peaks={assets.find((asset) => asset.id === clip.assetId)?.peaks ?? []}
                    maxDuration={assets.find((asset) => asset.id === clip.assetId)?.duration ?? clip.durationSec}
                    onSelect={() => selectClip(track.id, clip.id)}
                    onChange={(patch, first) => {
                      if (first) snapshot();
                      setClip(track.id, clip.id, patch);
                    }}
                  />
                ))}
              </div>
            ))}
            <div ref={lineRef} className="pointer-events-none absolute top-0 bottom-0 left-0 z-30 w-px bg-honey" />
          </div>
        </div>
      </div>
    </div>
  );
}

function TrackHeader({
  track,
  selected,
  onSelect,
  onName,
  onMute,
  onSolo,
  onDelete,
  onFocusName,
}: {
  track: Track;
  selected: boolean;
  onSelect: () => void;
  onName: (name: string) => void;
  onMute: () => void;
  onSolo: () => void;
  onDelete: () => void;
  onFocusName: () => void;
}) {
  return (
    <div
      className={cn("flex h-24 flex-col justify-center gap-2 border-b border-line px-3", selected && "bg-elevated")}
      onPointerDown={onSelect}
    >
      <div className="flex items-center gap-2">
        <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", DOT[track.color])} />
        <input
          aria-label={`${track.name} name`}
          value={track.name}
          onFocus={onFocusName}
          onChange={(event) => onName(event.target.value.slice(0, 60))}
          className="w-full min-w-0 truncate bg-transparent text-sm font-medium text-fg outline-none"
        />
      </div>
      <div className="flex items-center gap-1">
        <Toggle label="Mute" pressed={track.muted} hot={track.muted} onClick={onMute}>
          M
        </Toggle>
        <Toggle label="Solo" pressed={track.solo} hot={track.solo} onClick={onSolo}>
          S
        </Toggle>
        <button
          type="button"
          aria-label={`Delete ${track.name}`}
          onClick={onDelete}
          className="ml-auto flex h-10 w-10 items-center justify-center rounded-full text-muted hover:text-fg"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function Toggle({
  label,
  pressed,
  hot,
  onClick,
  children,
}: {
  label: string;
  pressed: boolean;
  hot: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={cn(
        "h-10 min-w-10 rounded-full text-xs font-semibold",
        hot ? "bg-honey text-ink" : "bg-inset text-muted",
        label === "Mute" && hot && "bg-clay text-ink",
      )}
    >
      {children}
    </button>
  );
}

function ClipView({
  clip,
  color,
  px,
  selected,
  name,
  peaks,
  maxDuration,
  onSelect,
  onChange,
}: {
  clip: Clip;
  color: TrackColor;
  px: number;
  selected: boolean;
  name: string;
  peaks: number[];
  maxDuration: number;
  onSelect: () => void;
  onChange: (patch: Partial<Clip>, first: boolean) => void;
}) {
  const width = Math.max(8, clip.durationSec * px);
  const drag = (mode: "move" | "start" | "end") => (event: ReactPointerEvent) => {
    event.stopPropagation();
    event.preventDefault();
    onSelect();
    const originX = event.clientX;
    const origin = { ...clip };
    let changed = false;
    const move = (ev: PointerEvent) => {
      const delta = (ev.clientX - originX) / px;
      if (Math.abs(ev.clientX - originX) < 2) return;
      const first = !changed;
      changed = true;
      if (mode === "move") {
        onChange({ startSec: Math.max(0, snapTime(origin.startSec + delta, useStudio.getState().project.bpm, useStudio.getState().snap)) }, first);
        return;
      }
      if (mode === "start") {
        let shift = delta;
        if (origin.offsetSec + shift < 0) shift = -origin.offsetSec;
        if (origin.durationSec - shift < 0.08) shift = origin.durationSec - 0.08;
        const { project, snap } = useStudio.getState();
        const snapped = snapTime(origin.startSec + shift, project.bpm, snap);
        shift = snapped - origin.startSec;
        if (origin.offsetSec + shift < 0) shift = -origin.offsetSec;
        if (origin.durationSec - shift < 0.08) shift = origin.durationSec - 0.08;
        onChange(
          {
            startSec: Math.max(0, origin.startSec + shift),
            offsetSec: Math.max(0, origin.offsetSec + shift),
            durationSec: origin.durationSec - shift,
          },
          first,
        );
        return;
      }
      const limit = Math.max(0.08, maxDuration - origin.offsetSec);
      let duration = Math.min(limit, Math.max(0.08, origin.durationSec + delta));
      const { project, snap } = useStudio.getState();
      if (snap) {
        const end = snapTime(origin.startSec + duration, project.bpm, true);
        duration = Math.min(limit, Math.max(0.08, end - origin.startSec));
      }
      onChange({ durationSec: duration }, first);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      data-clip
      className={cn(
        "absolute top-2 bottom-2 overflow-hidden rounded-xl",
        FACE[color],
        selected && "outline-2 outline-solid outline-fg",
      )}
      style={{ left: clip.startSec * px, width }}
      onPointerDown={drag("move")}
    >
      <div className="pointer-events-none absolute inset-0 opacity-80">
        <Waveform peaks={peaks} />
      </div>
      <span className="pointer-events-none absolute top-1 right-2 left-2 truncate text-xs font-semibold">{name}</span>
      {width > 36 ? (
        <>
          <button
            type="button"
            aria-label="Trim start"
            className="absolute inset-y-0 left-0 w-3 cursor-ew-resize"
            onPointerDown={drag("start")}
          />
          <button
            type="button"
            aria-label="Trim end"
            className="absolute inset-y-0 right-0 w-3 cursor-ew-resize"
            onPointerDown={drag("end")}
          />
        </>
      ) : null}
    </div>
  );
}
