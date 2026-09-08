export const MAX_DROPBOX_FILES_PER_BATCH = 10;

export function isDropboxBatchSizeAllowed(fileCount: number): boolean {
  return (
    Number.isSafeInteger(fileCount) &&
    fileCount >= 1 &&
    fileCount <= MAX_DROPBOX_FILES_PER_BATCH
  );
}

export function isStudentDropboxUploadContextAllowed({
  selectedClassId,
  hasActiveClassAccess,
}: {
  selectedClassId: number | null;
  hasActiveClassAccess: boolean;
}): boolean {
  return (
    selectedClassId !== null &&
    Number.isSafeInteger(selectedClassId) &&
    selectedClassId > 0 &&
    hasActiveClassAccess
  );
}
