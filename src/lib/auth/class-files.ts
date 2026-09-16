import "server-only";
import type { AuthUser } from "./session";
import { getInstructorManagedClass } from "./instructor-class";
import { getClassFileById } from "@/lib/db/class-files";
import { isClassFileId } from "@/lib/class-files/storage-key";

export async function getAuthorizedInstructorClassFile(id: string, classId: number, user: AuthUser) {
  if (!isClassFileId(id) || !Number.isSafeInteger(classId) || classId <= 0 ||
      !(await getInstructorManagedClass(classId, user))) return null;
  const file = await getClassFileById(id);
  return file?.classId === classId ? file : null;
}
