const buffers = new Map<string, AudioBuffer>();

export function setBuffer(id: string, buffer: AudioBuffer) {
  buffers.set(id, buffer);
}

export function getBuffer(id: string) {
  return buffers.get(id);
}

export function deleteBuffer(id: string) {
  buffers.delete(id);
}
