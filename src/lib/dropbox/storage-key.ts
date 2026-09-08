import "server-only";

function requirePositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive integer.`);
  }
}

export function generateDropboxStorageKey(
  classId: number,
  studentId: number
): string {
  requirePositiveInteger(classId, "Class ID");
  requirePositiveInteger(studentId, "Student ID");

  return `dropbox/${classId}/${studentId}/${crypto.randomUUID()}`;
}

export function isDropboxStorageKey(storageKey: string): boolean {
  return /^dropbox\/[1-9]\d*\/[1-9]\d*\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
    storageKey
  );
}
