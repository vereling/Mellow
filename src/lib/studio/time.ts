export function formatTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const tenth = Math.floor((sec % 1) * 10);
  return `${m}:${s.toString().padStart(2, "0")}.${tenth}`;
}

export function formatDuration(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function barLength(bpm: number) {
  return 240 / Math.min(240, Math.max(40, bpm));
}

export function snapTime(sec: number, bpm: number, enabled: boolean) {
  const safe = Math.max(0, Number.isFinite(sec) ? sec : 0);
  if (!enabled) return safe;
  const grid = 30 / Math.min(240, Math.max(40, bpm));
  return Math.round(safe / grid) * grid;
}

export function sizeLabel(amount: number) {
  if (amount < 0.34) return "Room";
  if (amount < 0.67) return "Chamber";
  return "Hall";
}
