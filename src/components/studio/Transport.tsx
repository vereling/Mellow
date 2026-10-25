import {
  exportMp3,
  exportWav,
  openProjectFile,
  rewind,
  saveProjectFile,
  stopPlayback,
  togglePlay,
  toggleRecord,
} from "@/lib/studio/actions";
import { cn } from "@/lib/cn";
import { formatTime } from "@/lib/studio/time";
import { useStudio } from "@/lib/studio/store";
import { engine } from "@/lib/audio/engine";
import { Minus, Pause, Play, Plus, Redo2, Repeat, SkipBack, Square, Undo2 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

function TimeReadout() {
  const [time, setTime] = useState("0:00.0");
  useEffect(() => {
    const id = window.setInterval(() => setTime(formatTime(engine.playhead())), 80);
    return () => window.clearInterval(id);
  }, []);
  return (
    <span className="min-w-24 text-center font-mono text-xl font-medium tabular-nums text-fg" aria-live="off">
      {time}
    </span>
  );
}

function Menu({
  label,
  disabled,
  items,
}: {
  label: string;
  disabled?: boolean;
  items: { label: string; onSelect: () => void }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-11 items-center rounded-full bg-elevated px-4 text-sm font-medium text-fg disabled:opacity-40"
      >
        {label}
      </button>
      {open ? (
        <div className="panel-pop absolute right-0 z-40 mt-2 min-w-44 rounded-2xl border border-line bg-elevated p-1">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              className="flex h-11 w-full items-center rounded-xl px-3 text-left text-sm text-fg hover:bg-surface"
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function Transport({
  onOpen,
  onImport,
}: {
  onOpen: () => void;
  onImport: () => void;
}) {
  const name = useStudio((state) => state.project.name);
  const bpm = useStudio((state) => state.project.bpm);
  const loop = useStudio((state) => state.project.loop);
  const snap = useStudio((state) => state.snap);
  const playing = useStudio((state) => state.playing);
  const recording = useStudio((state) => state.recording);
  const booted = useStudio((state) => state.booted);
  const busy = useStudio((state) => state.busy);
  const status = useStudio((state) => state.status);
  const setName = useStudio((state) => state.setName);
  const setBpm = useStudio((state) => state.setBpm);
  const setLoop = useStudio((state) => state.setLoop);
  const setSnap = useStudio((state) => state.setSnap);
  const setZoom = useStudio((state) => state.setZoom);
  const px = useStudio((state) => state.pxPerSec);
  const snapshot = useStudio((state) => state.snapshot);
  const undo = useStudio((state) => state.undo);
  const redo = useStudio((state) => state.redo);
  const newProject = useStudio((state) => state.newProject);

  return (
    <header className="shrink-0 border-b border-line bg-surface">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <img src="/favicon.svg" alt="" className="h-9 w-9 rounded-lg" />
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight text-fg">Mellow</p>
            <input
              aria-label="Project name"
              value={name}
              onFocus={() => snapshot()}
              onChange={(event) => setName(event.target.value.slice(0, 80))}
              className="w-40 truncate bg-transparent text-xs text-muted outline-none md:w-52"
            />
          </div>
        </div>

        <div className="flex flex-1 flex-wrap items-center justify-center gap-1.5">
          <IconButton label="Back to start" onClick={() => rewind()}>
            <SkipBack className="h-4 w-4" />
          </IconButton>
          <button
            type="button"
            aria-label={playing ? "Pause" : "Play"}
            disabled={!booted}
            onClick={() => void togglePlay()}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-honey text-ink disabled:opacity-40"
          >
            {playing ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
          </button>
          <IconButton label="Stop" onClick={() => stopPlayback()}>
            <Square className="h-4 w-4" />
          </IconButton>
          <TimeReadout />
          <IconButton label={loop ? "Loop is on" : "Loop is off"} pressed={loop} onClick={() => setLoop(!loop)}>
            <Repeat className="h-4 w-4" />
          </IconButton>
          <button
            type="button"
            aria-label={recording ? "Stop recording" : "Record"}
            aria-pressed={recording}
            disabled={!booted}
            onClick={() => void toggleRecord()}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-full disabled:opacity-40",
              recording ? "bg-clay text-ink" : "bg-elevated text-fg",
            )}
          >
            <span className={cn("h-3.5 w-3.5 rounded-full", recording ? "rec-live bg-ink" : "bg-clay")} />
          </button>
          <label className="ml-1 flex items-center gap-2 text-xs text-muted">
            BPM
            <input
              aria-label="Tempo"
              type="number"
              min={40}
              max={240}
              value={bpm}
              onFocus={() => snapshot()}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isFinite(value)) setBpm(Math.min(240, Math.max(40, Math.round(value))));
              }}
              className="h-11 w-16 rounded-xl border border-line bg-inset text-center font-mono text-sm text-fg tabular-nums"
            />
          </label>
          <IconButton label={snap ? "Snap is on" : "Snap is off"} pressed={snap} onClick={() => setSnap(!snap)}>
            <span className="text-xs font-semibold">Snap</span>
          </IconButton>
          <IconButton label="Zoom out" onClick={() => setZoom(px - 16)} className="hidden sm:inline-flex">
            <Minus className="h-4 w-4" />
          </IconButton>
          <IconButton label="Zoom in" onClick={() => setZoom(px + 16)} className="hidden sm:inline-flex">
            <Plus className="h-4 w-4" />
          </IconButton>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <IconButton label="Undo" onClick={() => undo()} className="hidden md:inline-flex">
            <Undo2 className="h-4 w-4" />
          </IconButton>
          <IconButton label="Redo" onClick={() => redo()} className="hidden md:inline-flex">
            <Redo2 className="h-4 w-4" />
          </IconButton>
          <button
            type="button"
            onClick={() => newProject()}
            className="hidden h-11 items-center rounded-full px-3 text-sm text-muted hover:text-fg md:inline-flex"
          >
            New
          </button>
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex h-11 items-center rounded-full bg-elevated px-4 text-sm font-medium text-fg"
          >
            Open
          </button>
          <button
            type="button"
            onClick={onImport}
            className="inline-flex h-11 items-center rounded-full bg-elevated px-4 text-sm font-medium text-fg"
          >
            Import
          </button>
          <button
            type="button"
            disabled={!booted || busy}
            onClick={() => void saveProjectFile()}
            className="inline-flex h-11 items-center rounded-full bg-fg px-4 text-sm font-semibold text-ink disabled:opacity-40"
          >
            Save
          </button>
          <Menu
            label={busy ? "Mixing…" : "Export"}
            disabled={!booted || busy}
            items={[
              { label: "Export WAV", onSelect: () => void exportWav() },
              { label: "Export MP3", onSelect: () => void exportMp3() },
            ]}
          />
        </div>
      </div>
      <p className="truncate px-4 pb-2 text-xs text-muted">{status}</p>
    </header>
  );
}

function IconButton({
  label,
  pressed,
  onClick,
  className,
  children,
}: {
  label: string;
  pressed?: boolean;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      onClick={onClick}
      className={cn(
        "inline-flex h-11 min-w-11 items-center justify-center rounded-full px-2",
        pressed ? "bg-honey text-ink" : "bg-elevated text-fg",
        className,
      )}
    >
      {children}
    </button>
  );
}
