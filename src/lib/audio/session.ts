import { getBuffer } from "@/lib/audio/buffers";
import { audioBufferToWav } from "@/lib/audio/wav";
import type { AssetMeta, Project } from "@/lib/studio/types";

const DB_NAME = "mellow";
const STORE = "session";

type SessionRecord = {
  project: Project;
  snap: boolean;
  pxPerSec: number;
  imports: { id: string; name: string; group: AssetMeta["group"]; hint: string; wav: ArrayBuffer }[];
};

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveSession(project: Project, assets: AssetMeta[], snap: boolean, pxPerSec: number) {
  const imports: SessionRecord["imports"] = [];
  for (const asset of assets) {
    if (asset.builtin) continue;
    const buffer = getBuffer(asset.id);
    if (!buffer) continue;
    imports.push({
      id: asset.id,
      name: asset.name,
      group: asset.group,
      hint: asset.hint,
      wav: audioBufferToWav(buffer),
    });
  }
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ project, snap, pxPerSec, imports } satisfies SessionRecord, "current");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function loadSession() {
  const db = await openDb();
  const record = await new Promise<SessionRecord | null>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get("current");
    request.onsuccess = () => resolve((request.result as SessionRecord | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return record;
}
