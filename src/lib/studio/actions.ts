import { getBuffer, setBuffer } from "@/lib/audio/buffers";
import { engine, peakOf, renderProject } from "@/lib/audio/engine";
import { encodeMp3 } from "@/lib/audio/mp3";
import { computePeaks } from "@/lib/audio/peaks";
import { parseMellow, serializeProject } from "@/lib/audio/project-file";
import { createBuiltins } from "@/lib/audio/synth";
import { audioBufferToWav, downloadBlob, safeFilename } from "@/lib/audio/wav";
import { loadSession } from "@/lib/audio/session";
import { snapTime } from "@/lib/studio/time";
import type { AssetMeta } from "@/lib/studio/types";
import { useStudio } from "@/lib/studio/store";

function yieldFrame() {
  return new Promise((resolve) => window.setTimeout(resolve, 20));
}

function playheadSnapped() {
  const { project, snap } = useStudio.getState();
  return snapTime(engine.playhead(), project.bpm, snap);
}

export async function bootStudio() {
  const builtins = createBuiltins();
  for (const item of builtins) setBuffer(item.asset.id, item.buffer);
  const library = new Map(builtins.map((item) => [item.asset.id, item.asset]));
  try {
    const session = await loadSession();
    if (!session?.project) {
      useStudio.getState().setBooted([...library.values()]);
      return;
    }
    for (const item of session.imports ?? []) {
      const buffer = await engine.decode(item.wav);
      setBuffer(item.id, buffer);
      library.set(item.id, {
        id: item.id,
        name: item.name,
        group: item.group,
        duration: buffer.duration,
        peaks: computePeaks(buffer),
        builtin: false,
        hint: item.hint || "Imported",
      });
    }
    useStudio.setState({ snap: session.snap ?? true, pxPerSec: session.pxPerSec ?? 96 });
    useStudio.getState().loadProject(session.project, [...library.values()], "Restored your last session.");
  } catch {
    useStudio.getState().setBooted([...library.values()]);
    useStudio.getState().setStatus("Couldn't restore the last session, so First Light is open.");
  }
}

export async function togglePlay() {
  const { project, booted, setStatus } = useStudio.getState();
  if (!booted) return;
  try {
    if (engine.playing) engine.pause();
    else await engine.play(project);
  } catch {
    setStatus("Playback couldn't start. Click the page once, then press play again.");
  }
}

export function stopPlayback() {
  engine.stop();
}

export function rewind() {
  engine.seek(0);
}

export async function saveProjectFile() {
  const { project, assets, booted, busy, setBusy, setStatus } = useStudio.getState();
  if (!booted || busy) return;
  setBusy(true);
  setStatus("Preparing the project file…");
  await yieldFrame();
  try {
    const file = await serializeProject(project, assets);
    const missing = project.tracks.some((track) => track.clips.some((clip) => !getBuffer(clip.assetId)));
    const blob = new Blob([JSON.stringify(file)], { type: "application/json" });
    downloadBlob(blob, `${safeFilename(project.name)}.mellow`);
    setStatus(
      missing
        ? "Downloaded the project, but a sound was missing and left out."
        : `Downloaded ${safeFilename(project.name)}.mellow`,
    );
  } catch {
    setStatus("Couldn't save the project file.");
  } finally {
    setBusy(false);
  }
}

export async function openProjectFile(file: File) {
  const { assets, setBusy, setStatus, loadProject } = useStudio.getState();
  setBusy(true);
  setStatus(`Opening ${file.name}…`);
  await yieldFrame();
  try {
    const parsed = parseMellow(await file.text(), assets);
    const next = new Map(assets.filter((asset) => asset.builtin).map((asset) => [asset.id, asset]));
    for (const asset of parsed.assets) {
      const buffer = await engine.decode(base64ToBuffer(asset.wav));
      setBuffer(asset.id, buffer);
      const known = assets.find((item) => item.id === asset.id);
      next.set(asset.id, {
        id: asset.id,
        name: known?.name && asset.name === "Sound" ? known.name : asset.name,
        group: asset.group,
        duration: buffer.duration,
        peaks: computePeaks(buffer),
        builtin: asset.id.startsWith("builtin:"),
        hint: known?.hint ?? "From project",
      });
    }
    for (const builtin of assets) {
      if (builtin.builtin && !next.has(builtin.id)) next.set(builtin.id, builtin);
    }
    engine.stop();
    loadProject(parsed.project, [...next.values()], `Opened ${file.name}.`);
  } catch {
    setStatus("Couldn't open that project. Choose a .mellow file.");
  } finally {
    setBusy(false);
  }
}

function base64ToBuffer(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export async function importAudioFiles(files: File[]) {
  const { booted, setStatus, addAsset, layerAsset, project, snap } = useStudio.getState();
  if (!booted) return;
  for (const file of files) {
    try {
      const buffer = await engine.decode(await file.arrayBuffer());
      if (buffer.duration > 60 * 12) {
        setStatus("Files longer than 12 minutes are skipped.");
        continue;
      }
      const name = file.name.replace(/\.[^.]+$/, "") || "Imported";
      const asset: AssetMeta = {
        id: `import-${Math.random().toString(36).slice(2, 9)}`,
        name,
        group: "Imported",
        duration: buffer.duration,
        peaks: computePeaks(buffer),
        builtin: false,
        hint: "Imported",
      };
      setBuffer(asset.id, buffer);
      addAsset(asset);
      layerAsset(asset.id, snapTime(engine.playhead(), project.bpm, snap));
    } catch {
      setStatus(`Couldn't read ${file.name}.`);
    }
  }
}

async function mixdown() {
  const { project, setStatus } = useStudio.getState();
  setStatus("Mixing down…");
  await yieldFrame();
  const rendered = await renderProject(project);
  if (peakOf(rendered) < 0.001) throw new Error("The mix is silent. Unmute a track or add a sound.");
  return rendered;
}

export async function exportWav() {
  const { project, busy, booted, setBusy, setStatus } = useStudio.getState();
  if (!booted || busy) return;
  setBusy(true);
  try {
    const rendered = await mixdown();
    downloadBlob(new Blob([audioBufferToWav(rendered)], { type: "audio/wav" }), `${safeFilename(project.name)}.wav`);
    setStatus(`Downloaded ${safeFilename(project.name)}.wav`);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Couldn't export WAV.");
  } finally {
    setBusy(false);
  }
}

export async function exportMp3() {
  const { project, busy, booted, setBusy, setStatus } = useStudio.getState();
  if (!booted || busy) return;
  setBusy(true);
  try {
    const rendered = await mixdown();
    const mp3 = await encodeMp3(rendered);
    downloadBlob(mp3, `${safeFilename(project.name)}.mp3`);
    setStatus(`Downloaded ${safeFilename(project.name)}.mp3`);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Couldn't export MP3.");
  } finally {
    setBusy(false);
  }
}

let take: { recorder: MediaRecorder; stream: MediaStream; chunks: Blob[]; startedAt: number } | null = null;

export async function toggleRecord() {
  const { recording, booted, project, setRecording, setStatus, addAsset, layerAsset } = useStudio.getState();
  if (!booted) return;
  if (take && recording) {
    const current = take;
    const blob = await new Promise<Blob>((resolve) => {
      current.recorder.onstop = () => {
        resolve(new Blob(current.chunks, { type: current.recorder.mimeType || "audio/webm" }));
      };
      current.recorder.stop();
    });
    current.stream.getTracks().forEach((track) => track.stop());
    take = null;
    setRecording(false);
    engine.pause();
    try {
      const buffer = await engine.decode(await blob.arrayBuffer());
      const asset: AssetMeta = {
        id: `rec-${Date.now().toString(36)}`,
        name: "Recording",
        group: "Recordings",
        duration: buffer.duration,
        peaks: computePeaks(buffer),
        builtin: false,
        hint: "Recording",
      };
      setBuffer(asset.id, buffer);
      addAsset(asset);
      layerAsset(asset.id, current.startedAt);
      setStatus("Recording landed on a new track.");
    } catch {
      setStatus("The recording couldn't be decoded.");
    }
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) =>
      MediaRecorder.isTypeSupported(type),
    );
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    take = { recorder, stream, chunks, startedAt: engine.playhead() };
    recorder.start();
    setRecording(true);
    setStatus("Recording. Press the record button again to finish.");
    if (!engine.playing) await engine.play(project);
  } catch {
    setStatus("Microphone isn't available. Import a file instead.");
  }
}

export function layerAtPlayhead(assetId: string) {
  if (!useStudio.getState().booted) return;
  useStudio.getState().layerAsset(assetId, playheadSnapped());
}

export function placeAt(trackId: string, assetId: string, startSec: number) {
  const { booted, project, snap, placeOnTrack } = useStudio.getState();
  if (!booted) return;
  placeOnTrack(trackId, assetId, snapTime(startSec, project.bpm, snap));
}

export function releaseRecording() {
  if (!take) return;
  take.stream.getTracks().forEach((track) => track.stop());
  try {
    if (take.recorder.state !== "inactive") take.recorder.stop();
  } catch {
    /* already stopped */
  }
  take = null;
}
