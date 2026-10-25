import type { AssetGroup } from "@/lib/studio/types";

export const DEMO_BPM = 90;
export const LOOP_BARS = 8;
export const LOOP_SEC = (LOOP_BARS * 4 * 60) / DEMO_BPM;

export type CatalogItem = {
  id: string;
  name: string;
  group: AssetGroup;
  seconds: number;
  hint: string;
};

export const CATALOG: CatalogItem[] = [
  {
    id: "builtin:honey-keys",
    name: "Honey Keys",
    group: "Loops",
    seconds: LOOP_SEC,
    hint: "8 bars · 90 BPM",
  },
  {
    id: "builtin:dusty-kit",
    name: "Dusty Kit",
    group: "Loops",
    seconds: LOOP_SEC,
    hint: "8 bars · 90 BPM",
  },
  {
    id: "builtin:warm-bass",
    name: "Warm Bass",
    group: "Loops",
    seconds: LOOP_SEC,
    hint: "8 bars · 90 BPM",
  },
  {
    id: "builtin:air-pad",
    name: "Air Pad",
    group: "Loops",
    seconds: LOOP_SEC,
    hint: "8 bars · 90 BPM",
  },
  {
    id: "builtin:soft-shaker",
    name: "Soft Shaker",
    group: "Loops",
    seconds: LOOP_SEC,
    hint: "8 bars · 90 BPM",
  },
  { id: "builtin:kick", name: "Kick", group: "One-shots", seconds: 0.55, hint: "One-shot" },
  { id: "builtin:snare", name: "Snare", group: "One-shots", seconds: 0.34, hint: "One-shot" },
  { id: "builtin:hat", name: "Hat", group: "One-shots", seconds: 0.2, hint: "One-shot" },
  { id: "builtin:stab", name: "Key Stab", group: "One-shots", seconds: 1.4, hint: "One-shot" },
  { id: "builtin:sub", name: "Sub", group: "One-shots", seconds: 0.72, hint: "One-shot" },
];
