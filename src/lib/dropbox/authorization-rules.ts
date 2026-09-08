import "server-only";

export function isStudentDropboxAccessAllowed({
  authenticatedStudentId,
  fileStudentId,
  hasActiveEnrollment,
}: {
  authenticatedStudentId: number;
  fileStudentId: number;
  hasActiveEnrollment: boolean;
}): boolean {
  return authenticatedStudentId === fileStudentId && hasActiveEnrollment;
}

export function isInstructorDropboxAccessAllowed({
  fileClassId,
  managedClassId,
}: {
  fileClassId: number;
  managedClassId: number | null;
}): boolean {
  return managedClassId === fileClassId;
}

export function isInstructorDropboxClassFileAccessAllowed({
  managedClassId,
  requestedClassId,
  fileClassId,
}: {
  managedClassId: number | null;
  requestedClassId: number;
  fileClassId: number | null;
}): boolean {
  return (
    fileClassId === requestedClassId &&
    isInstructorDropboxAccessAllowed({ fileClassId, managedClassId })
  );
}
