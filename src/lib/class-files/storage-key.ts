import "server-only";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const FILE_ID_PATTERN = new RegExp(`^${UUID}$`, "iu");
const KEY_PATTERN = new RegExp(`^class-files/[1-9]\\d*/${UUID}/${UUID}$`, "iu");

export function isClassFileId(id: string): boolean {
  return FILE_ID_PATTERN.test(id);
}

export function generateClassFileStorageKey(classId: number, classFileId: string): string {
  if (!Number.isSafeInteger(classId) || classId <= 0 || !isClassFileId(classFileId)) {
    throw new TypeError("Invalid Class File identifiers.");
  }
  // A random stored filename preserves the original Unicode name only in metadata.
  // Each replacement can generate a new object without overwriting the old object.
  return `class-files/${classId}/${classFileId}/${crypto.randomUUID()}`;
}

export function isClassFileStorageKey(key: string): boolean {
  const classId = Number(key.split("/")[1]);
  return Number.isSafeInteger(classId) && KEY_PATTERN.test(key);
}
