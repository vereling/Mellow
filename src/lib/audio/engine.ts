import { getBuffer } from "@/lib/audio/buffers";
import { equalPower, impulseFor } from "@/lib/audio/reverb";
import { arrangementEnd, arrangementSignature, isAudible, soloActive } from "@/lib/studio/project";
import type { Project } from "@/lib/studio/types";

type TrackNodes = {
  volume: GainNode;
  dry: GainNode;
  wet: GainNode;
  verb: ConvolverNode;
};

type MixGraph = {
  master: GainNode;
  masterDry: GainNode;
  masterWet: GainNode;
  masterVerb: ConvolverNode;
  tracks: Map<string, TrackNodes>;
};

type LiveSource = {
  source: AudioBufferSourceNode;
  gain: GainNode;
};

const shaperCurve = (() => {
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * 1.15);
  }
  return curve;
})();

const impulseSize = new WeakMap<ConvolverNode, number>();

function setImpulse(node: ConvolverNode, ctx: BaseAudioContext, size: number) {
  const quantized = Math.round(Math.min(1, Math.max(0, size)) * 16) / 16;
  if (impulseSize.get(node) === quantized && node.buffer) return;
  node.buffer = impulseFor(ctx, quantized);
  impulseSize.set(node, quantized);
}

function writeParam(param: AudioParam, value: number, ctx: BaseAudioContext) {
  const now = ctx.currentTime;
  param.cancelScheduledValues(now);
  if (typeof OfflineAudioContext !== "undefined" && ctx instanceof OfflineAudioContext) {
    param.setValueAtTime(value, 0);
    return;
  }
  param.setValueAtTime(param.value, now);
  param.linearRampToValueAtTime(value, now + 0.02);
}

export function buildMix(ctx: BaseAudioContext, destination: AudioNode, project: Project): MixGraph {
  const sum = ctx.createGain();
  const masterDry = ctx.createGain();
  const masterWet = ctx.createGain();
  const masterVerb = ctx.createConvolver();
  masterVerb.normalize = true;
  const glue = ctx.createGain();
  const shaper = ctx.createWaveShaper();
  shaper.curve = shaperCurve;
  shaper.oversample = "none";
  const master = ctx.createGain();

  sum.connect(masterDry);
  masterDry.connect(glue);
  sum.connect(masterWet);
  masterWet.connect(masterVerb);
  masterVerb.connect(glue);
  glue.connect(shaper);
  shaper.connect(master);
  master.connect(destination);

  const tracks = new Map<string, TrackNodes>();
  for (const track of project.tracks) {
    const volume = ctx.createGain();
    const dry = ctx.createGain();
    const wet = ctx.createGain();
    const verb = ctx.createConvolver();
    verb.normalize = true;
    volume.connect(dry);
    dry.connect(sum);
    volume.connect(wet);
    wet.connect(verb);
    verb.connect(sum);
    tracks.set(track.id, { volume, dry, wet, verb });
  }

  applyMix({ master, masterDry, masterWet, masterVerb, tracks }, project, ctx);
  return { master, masterDry, masterWet, masterVerb, tracks };
}

export function applyMix(graph: MixGraph, project: Project, ctx: BaseAudioContext) {
  const masterMix = equalPower(project.masterReverb);
  writeParam(graph.master.gain, project.masterVolume, ctx);
  writeParam(graph.masterDry.gain, masterMix.dry, ctx);
  writeParam(graph.masterWet.gain, masterMix.wet, ctx);
  setImpulse(graph.masterVerb, ctx, project.masterReverbSize);

  const solo = soloActive(project);
  for (const track of project.tracks) {
    const nodes = graph.tracks.get(track.id);
    if (!nodes) continue;
    const mix = equalPower(track.reverb);
    writeParam(nodes.volume.gain, isAudible(track, solo) ? track.volume : 0, ctx);
    writeParam(nodes.dry.gain, mix.dry, ctx);
    writeParam(nodes.wet.gain, mix.wet, ctx);
    setImpulse(nodes.verb, ctx, track.reverbSize);
  }
}

export function scheduleClips(
  ctx: BaseAudioContext,
  graph: MixGraph,
  project: Project,
  when: number,
  from: number,
) {
  const sources: LiveSource[] = [];
  const solo = soloActive(project);
  for (const track of project.tracks) {
    if (!isAudible(track, solo)) continue;
    const nodes = graph.tracks.get(track.id);
    if (!nodes) continue;
    for (const clip of track.clips) {
      const clipEnd = clip.startSec + clip.durationSec;
      if (clipEnd <= from + 0.001) continue;
      const buffer = getBuffer(clip.assetId);
      if (!buffer) continue;
      const into = Math.max(0, from - clip.startSec);
      const offset = clip.offsetSec + into;
      if (offset >= buffer.duration - 0.01) continue;
      const playDur = Math.min(clip.durationSec - into, buffer.duration - offset - 0.001);
      if (playDur <= 0.012) continue;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      source.connect(gain);
      gain.connect(nodes.volume);
      const at = when + Math.max(0, clip.startSec - from);
      const fade = Math.min(0.01, playDur / 3);
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(1, at + fade);
      if (playDur > fade * 2) {
        gain.gain.setValueAtTime(1, at + playDur - fade);
        gain.gain.linearRampToValueAtTime(0, at + playDur);
      }
      source.start(at, Math.max(0, offset), playDur);
      sources.push({ source, gain });
    }
  }
  return sources;
}

function tailSeconds(project: Project) {
  const trackTail = project.tracks.reduce((max, track) => Math.max(max, track.reverbSize), 0);
  return 0.3 + project.masterReverbSize * 3.4 + trackTail * 0.8;
}

export async function renderProject(project: Project) {
  const end = arrangementEnd(project);
  if (end <= 0.01) throw new Error("Add a sound before exporting.");
  const seconds = end + tailSeconds(project);
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * 44100), 44100);
  const graph = buildMix(ctx, ctx.destination, project);
  scheduleClips(ctx, graph, project, 0, 0);
  return ctx.startRendering();
}

export function peakOf(buffer: AudioBuffer) {
  const left = buffer.getChannelData(0);
  const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;
  let max = 0;
  for (let i = 0; i < left.length; i += 32) {
    max = Math.max(max, Math.abs(left[i] ?? 0), Math.abs(right[i] ?? 0));
  }
  return max;
}

export class StudioEngine {
  private ctx: AudioContext | null = null;
  private graph: MixGraph | null = null;
  private sources: LiveSource[] = [];
  private project: Project | null = null;
  private signature = "";
  private trackKey = "";
  private anchorFrom = 0;
  private anchorCtx = 0;
  private watch = 0;
  private rescheduleQueued = false;
  playing = false;
  onChange: ((playing: boolean) => void) | null = null;

  context() {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext({ sampleRate: 44100 });
      } catch {
        this.ctx = new AudioContext();
      }
    }
    return this.ctx;
  }

  async resume() {
    const ctx = this.context();
    if (ctx.state !== "running") await ctx.resume();
    return ctx;
  }

  async decode(bytes: ArrayBuffer) {
    const ctx = this.context();
    return ctx.decodeAudioData(bytes.slice(0));
  }

  playhead() {
    if (!this.playing || !this.ctx) return this.anchorFrom;
    return Math.max(0, this.anchorFrom + (this.ctx.currentTime - this.anchorCtx));
  }

  async play(project: Project) {
    const ctx = await this.resume();
    this.project = project;
    const end = Math.max(arrangementEnd(project), 0.5);
    if (this.anchorFrom >= end - 0.03) this.anchorFrom = 0;
    this.ensureGraph(ctx, project);
    this.signature = arrangementSignature(project);
    this.stopSources();
    const from = this.anchorFrom;
    this.anchorCtx = ctx.currentTime + 0.05;
    this.anchorFrom = from;
    this.sources = scheduleClips(ctx, this.graph!, project, this.anchorCtx, from);
    this.playing = true;
    this.onChange?.(true);
    this.armWatch();
  }

  pause() {
    if (this.playing) this.anchorFrom = this.playhead();
    this.playing = false;
    this.stopSources();
    this.clearWatch();
    this.onChange?.(false);
  }

  stop() {
    this.pause();
    this.anchorFrom = 0;
  }

  seek(sec: number) {
    const next = Math.max(0, sec);
    if (!this.playing || !this.ctx || !this.project || !this.graph) {
      this.anchorFrom = next;
      return;
    }
    this.stopSources();
    this.anchorFrom = next;
    this.anchorCtx = this.ctx.currentTime + 0.03;
    this.sources = scheduleClips(this.ctx, this.graph, this.project, this.anchorCtx, next);
  }

  sync(project: Project) {
    this.project = project;
    const ctx = this.ctx;
    if (!ctx || !this.graph) return;
    const trackKey = project.tracks.map((track) => track.id).join("|");
    let structural = false;
    if (trackKey !== this.trackKey) {
      this.rebuild(ctx, project);
      structural = true;
    } else {
      applyMix(this.graph, project, ctx);
    }
    const signature = arrangementSignature(project);
    if (signature !== this.signature) {
      this.signature = signature;
      structural = true;
    }
    if (structural && this.playing) this.queueReschedule();
  }

  private ensureGraph(ctx: AudioContext, project: Project) {
    const trackKey = project.tracks.map((track) => track.id).join("|");
    if (!this.graph || trackKey !== this.trackKey) this.rebuild(ctx, project);
    else applyMix(this.graph, project, ctx);
  }

  private rebuild(ctx: AudioContext, project: Project) {
    this.graph?.master.disconnect();
    this.graph = buildMix(ctx, ctx.destination, project);
    this.trackKey = project.tracks.map((track) => track.id).join("|");
  }

  private queueReschedule() {
    if (this.rescheduleQueued) return;
    this.rescheduleQueued = true;
    requestAnimationFrame(() => {
      this.rescheduleQueued = false;
      if (!this.playing || !this.ctx || !this.project || !this.graph) return;
      const at = this.playhead();
      this.stopSources();
      this.anchorFrom = at;
      this.anchorCtx = this.ctx.currentTime + 0.03;
      this.sources = scheduleClips(this.ctx, this.graph, this.project, this.anchorCtx, at);
    });
  }

  private stopSources() {
    const ctx = this.ctx;
    const now = ctx?.currentTime ?? 0;
    for (const item of this.sources) {
      try {
        item.gain.gain.cancelScheduledValues(now);
        item.gain.gain.setValueAtTime(item.gain.gain.value, now);
        item.gain.gain.linearRampToValueAtTime(0, now + 0.015);
        item.source.stop(now + 0.02);
      } catch {
        /* already stopped */
      }
    }
    this.sources = [];
  }

  private armWatch() {
    this.clearWatch();
    this.watch = window.setInterval(() => {
      if (!this.playing || !this.project) return;
      const end = Math.max(arrangementEnd(this.project), 0.5);
      if (this.playhead() < end) return;
      if (this.project.loop) this.seek(0);
      else {
        this.anchorFrom = end;
        this.playing = false;
        this.stopSources();
        this.clearWatch();
        this.onChange?.(false);
      }
    }, 40);
  }

  private clearWatch() {
    if (this.watch) window.clearInterval(this.watch);
    this.watch = 0;
  }
}

export const engine = new StudioEngine();
