import { Inspector } from "@/components/studio/Inspector";
import { Library } from "@/components/studio/Library";
import { Timeline } from "@/components/studio/Timeline";
import { Transport } from "@/components/studio/Transport";
import { engine } from "@/lib/audio/engine";
import { saveSession } from "@/lib/audio/session";
import { bootStudio, importAudioFiles, openProjectFile, releaseRecording, saveProjectFile, togglePlay } from "@/lib/studio/actions";
import { useStudio } from "@/lib/studio/store";
import { useEffect, useRef, useState } from "react";

export function Studio() {
  const openRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const depth = useRef(0);

  useEffect(() => {
    engine.onChange = (playing) => useStudio.getState().setPlaying(playing);
    let saveTimer = 0;
    const unsub = useStudio.subscribe((state, previous) => {
      if (state.project !== previous.project) engine.sync(state.project);
      if (!state.booted) return;
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => {
        const latest = useStudio.getState();
        void saveSession(latest.project, latest.assets, latest.snap, latest.pxPerSec).catch(() => {
          /* session save is best-effort */
        });
      }, 700);
    });
    void bootStudio();
    return () => {
      unsub();
      window.clearTimeout(saveTimer);
      engine.onChange = null;
      releaseRecording();
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveProjectFile();
        return;
      }
      if (typing) return;
      if (event.code === "Space") {
        event.preventDefault();
        void togglePlay();
      } else if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        useStudio.getState().deleteSelectedClip();
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) useStudio.getState().redo();
        else useStudio.getState().undo();
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        useStudio.getState().redo();
      } else if (event.key.toLowerCase() === "m") {
        const id = useStudio.getState().selectedTrackId;
        if (id) useStudio.getState().toggleMute(id);
      } else if (event.key.toLowerCase() === "s" && !event.metaKey && !event.ctrlKey) {
        const id = useStudio.getState().selectedTrackId;
        if (id) useStudio.getState().toggleSolo(id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <main
      className="relative flex h-dvh flex-col bg-bg text-fg"
      onDragEnter={(event) => {
        if (![...event.dataTransfer.types].includes("Files")) return;
        event.preventDefault();
        depth.current += 1;
        setDragOver(true);
      }}
      onDragOver={(event) => {
        if ([...event.dataTransfer.types].includes("Files")) event.preventDefault();
      }}
      onDragLeave={() => {
        depth.current -= 1;
        if (depth.current <= 0) {
          depth.current = 0;
          setDragOver(false);
        }
      }}
      onDrop={(event) => {
        if (![...event.dataTransfer.types].includes("Files")) return;
        event.preventDefault();
        depth.current = 0;
        setDragOver(false);
        const files = [...event.dataTransfer.files];
        const projectFile = files.find((file) => file.name.toLowerCase().endsWith(".mellow"));
        if (projectFile) void openProjectFile(projectFile);
        else if (files.length) void importAudioFiles(files);
      }}
    >
      <Transport onOpen={() => openRef.current?.click()} onImport={() => importRef.current?.click()} />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <Library onImport={() => importRef.current?.click()} />
        <Timeline />
      </div>
      <Inspector />
      <input
        ref={openRef}
        type="file"
        accept=".mellow,application/json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void openProjectFile(file);
        }}
      />
      <input
        ref={importRef}
        type="file"
        accept="audio/*"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          event.target.value = "";
          if (files.length) void importAudioFiles(files);
        }}
      />
      {dragOver ? (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-bg/80">
          <p className="rounded-2xl border border-line bg-surface px-6 py-4 text-sm text-fg">
            Drop audio or a .mellow project
          </p>
        </div>
      ) : null}
    </main>
  );
}
