import { deleteBuffer } from "@/lib/audio/buffers";
import { blankProject, catalogAssets, demoProject } from "@/lib/studio/demo";
import type { AssetMeta, Clip, Project, Track } from "@/lib/studio/types";
import { nextColor } from "@/lib/studio/types";
import { create } from "zustand";

type TrackPatch = Partial<Pick<Track, "name" | "volume" | "reverb" | "reverbSize" | "muted" | "solo">>;

type StudioState = {
  project: Project;
  assets: AssetMeta[];
  selectedTrackId: string | null;
  selectedClipId: string | null;
  snap: boolean;
  pxPerSec: number;
  booted: boolean;
  playing: boolean;
  recording: boolean;
  busy: boolean;
  status: string;
  history: Project[];
  future: Project[];
  setBooted: (assets: AssetMeta[]) => void;
  setPlaying: (playing: boolean) => void;
  setRecording: (recording: boolean) => void;
  setBusy: (busy: boolean) => void;
  setStatus: (status: string) => void;
  setSnap: (snap: boolean) => void;
  setZoom: (pxPerSec: number) => void;
  selectTrack: (id: string | null) => void;
  selectClip: (trackId: string, clipId: string | null) => void;
  snapshot: () => void;
  undo: () => void;
  redo: () => void;
  setName: (name: string) => void;
  setBpm: (bpm: number) => void;
  setLoop: (loop: boolean) => void;
  setMaster: (patch: Partial<Pick<Project, "masterVolume" | "masterReverb" | "masterReverbSize">>) => void;
  setTrack: (id: string, patch: TrackPatch) => void;
  setClip: (trackId: string, clipId: string, patch: Partial<Clip>) => void;
  toggleMute: (id: string) => void;
  toggleSolo: (id: string) => void;
  addTrack: () => void;
  deleteTrack: (id: string) => void;
  deleteSelectedClip: () => void;
  placeOnTrack: (trackId: string, assetId: string, startSec: number) => void;
  layerAsset: (assetId: string, startSec: number) => void;
  addAsset: (asset: AssetMeta) => void;
  removeAsset: (id: string) => void;
  newProject: () => void;
  loadProject: (project: Project, assets: AssetMeta[], status: string) => void;
};

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-2)}`;
}

function withHistory(state: StudioState, project: Project): Pick<StudioState, "project" | "history" | "future"> {
  return {
    project,
    history: [...state.history, state.project].slice(-50),
    future: [],
  };
}

export const useStudio = create<StudioState>((set, get) => ({
  project: demoProject(),
  assets: catalogAssets(),
  selectedTrackId: "track-keys",
  selectedClipId: null,
  snap: true,
  pxPerSec: 96,
  booted: false,
  playing: false,
  recording: false,
  busy: false,
  status: "Preparing sounds…",
  history: [],
  future: [],

  setBooted: (assets) => set({ booted: true, assets, status: "First Light is ready. Press play." }),
  setPlaying: (playing) => set({ playing }),
  setRecording: (recording) => set({ recording }),
  setBusy: (busy) => set({ busy }),
  setStatus: (status) => set({ status }),
  setSnap: (snap) => set({ snap }),
  setZoom: (pxPerSec) => set({ pxPerSec: Math.min(220, Math.max(48, pxPerSec)) }),
  selectTrack: (id) => set({ selectedTrackId: id, selectedClipId: null }),
  selectClip: (trackId, clipId) => set({ selectedTrackId: trackId, selectedClipId: clipId }),
  snapshot: () => set((state) => ({ history: [...state.history, state.project].slice(-50), future: [] })),
  undo: () =>
    set((state) => {
      const previous = state.history[state.history.length - 1];
      if (!previous) return state;
      return {
        project: previous,
        history: state.history.slice(0, -1),
        future: [state.project, ...state.future].slice(0, 50),
        status: "Undid the last change.",
      };
    }),
  redo: () =>
    set((state) => {
      const next = state.future[0];
      if (!next) return state;
      return {
        project: next,
        future: state.future.slice(1),
        history: [...state.history, state.project].slice(-50),
        status: "Redid the change.",
      };
    }),
  setName: (name) => set((state) => ({ project: { ...state.project, name } })),
  setBpm: (bpm) => set((state) => ({ project: { ...state.project, bpm } })),
  setLoop: (loop) => set((state) => ({ project: { ...state.project, loop } })),
  setMaster: (patch) => set((state) => ({ project: { ...state.project, ...patch } })),
  setTrack: (id, patch) =>
    set((state) => ({
      project: {
        ...state.project,
        tracks: state.project.tracks.map((track) => (track.id === id ? { ...track, ...patch } : track)),
      },
    })),
  setClip: (trackId, clipId, patch) =>
    set((state) => ({
      project: {
        ...state.project,
        tracks: state.project.tracks.map((track) =>
          track.id === trackId
            ? { ...track, clips: track.clips.map((clip) => (clip.id === clipId ? { ...clip, ...patch } : clip)) }
            : track,
        ),
      },
    })),
  toggleMute: (id) => {
    const state = get();
    const track = state.project.tracks.find((item) => item.id === id);
    if (!track) return;
    set({
      ...withHistory(state, {
        ...state.project,
        tracks: state.project.tracks.map((item) => (item.id === id ? { ...item, muted: !item.muted } : item)),
      }),
    });
  },
  toggleSolo: (id) => {
    const state = get();
    const track = state.project.tracks.find((item) => item.id === id);
    if (!track) return;
    set({
      ...withHistory(state, {
        ...state.project,
        tracks: state.project.tracks.map((item) => (item.id === id ? { ...item, solo: !item.solo } : item)),
      }),
    });
  },
  addTrack: () => {
    const state = get();
    const id = uid("track");
    const track: Track = {
      id,
      name: `Track ${state.project.tracks.length + 1}`,
      color: nextColor(state.project.tracks.length),
      volume: 0.8,
      reverb: 0.22,
      reverbSize: 0.42,
      muted: false,
      solo: false,
      clips: [],
    };
    set({
      ...withHistory(state, { ...state.project, tracks: [...state.project.tracks, track] }),
      selectedTrackId: id,
      selectedClipId: null,
      status: "Added an empty track.",
    });
  },
  deleteTrack: (id) => {
    const state = get();
    const tracks = state.project.tracks.filter((track) => track.id !== id);
    set({
      ...withHistory(state, { ...state.project, tracks }),
      selectedTrackId: state.selectedTrackId === id ? (tracks[0]?.id ?? null) : state.selectedTrackId,
      selectedClipId: null,
      status: "Removed the track.",
    });
  },
  deleteSelectedClip: () => {
    const state = get();
    if (!state.selectedTrackId || !state.selectedClipId) return;
    set({
      ...withHistory(state, {
        ...state.project,
        tracks: state.project.tracks.map((track) =>
          track.id === state.selectedTrackId
            ? { ...track, clips: track.clips.filter((clip) => clip.id !== state.selectedClipId) }
            : track,
        ),
      }),
      selectedClipId: null,
      status: "Removed the clip.",
    });
  },
  placeOnTrack: (trackId, assetId, startSec) => {
    const state = get();
    const sound = state.assets.find((item) => item.id === assetId);
    if (!sound) return;
    const clipId = uid("clip");
    set({
      ...withHistory(state, {
        ...state.project,
        tracks: state.project.tracks.map((track) =>
          track.id === trackId
            ? {
                ...track,
                clips: [
                  ...track.clips,
                  {
                    id: clipId,
                    assetId,
                    startSec: Math.max(0, startSec),
                    offsetSec: 0,
                    durationSec: sound.duration,
                  },
                ],
              }
            : track,
        ),
      }),
      selectedTrackId: trackId,
      selectedClipId: clipId,
      status: `Placed ${sound.name}.`,
    });
  },
  layerAsset: (assetId, startSec) => {
    const state = get();
    const sound = state.assets.find((item) => item.id === assetId);
    if (!sound) return;
    const id = uid("track");
    const clipId = uid("clip");
    const track: Track = {
      id,
      name: sound.name,
      color: nextColor(state.project.tracks.length),
      volume: 0.8,
      reverb: 0.26,
      reverbSize: 0.48,
      muted: false,
      solo: false,
      clips: [
        {
          id: clipId,
          assetId,
          startSec: Math.max(0, startSec),
          offsetSec: 0,
          durationSec: sound.duration,
        },
      ],
    };
    set({
      ...withHistory(state, { ...state.project, tracks: [...state.project.tracks, track] }),
      selectedTrackId: id,
      selectedClipId: clipId,
      status: `Layered ${sound.name}.`,
    });
  },
  addAsset: (asset) => set((state) => ({ assets: [...state.assets.filter((item) => item.id !== asset.id), asset] })),
  removeAsset: (id) => {
    const state = get();
    const sound = state.assets.find((item) => item.id === id);
    if (!sound || sound.builtin) return;
    deleteBuffer(id);
    set({
      assets: state.assets.filter((item) => item.id !== id),
      ...withHistory(state, {
        ...state.project,
        tracks: state.project.tracks.map((track) => ({
          ...track,
          clips: track.clips.filter((clip) => clip.assetId !== id),
        })),
      }),
      selectedClipId: null,
      status: `Removed ${sound.name}.`,
    });
  },
  newProject: () => {
    const state = get();
    const project = blankProject();
    set({
      ...withHistory(state, project),
      selectedTrackId: project.tracks[0]?.id ?? null,
      selectedClipId: null,
      status: "New project. Undo brings the last one back.",
    });
  },
  loadProject: (project, assets, status) =>
    set({
      project,
      assets,
      booted: true,
      history: [],
      future: [],
      selectedTrackId: project.tracks[0]?.id ?? null,
      selectedClipId: null,
      status,
    }),
}));
