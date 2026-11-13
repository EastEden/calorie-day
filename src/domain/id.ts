export function createId(prefix: string): string {
  const cryptoObject = globalThis.crypto;

  if (cryptoObject && typeof cryptoObject.randomUUID === 'function') {
    return `${prefix}_${cryptoObject.randomUUID()}`;
  }

  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${randomPart}`;
}
