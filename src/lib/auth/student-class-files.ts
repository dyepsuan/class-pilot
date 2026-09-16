import "server-only";

import type { AuthenticatedStudent } from "@/lib/auth/student-session";
import { canStudentAccessDropboxClass } from "@/lib/auth/dropbox";
import { getClassFileById } from "@/lib/db/class-files";

export async function getAuthorizedStudentClassFile(id: string, student: AuthenticatedStudent) {
  const file = await getClassFileById(id);
  if (!file || !(await canStudentAccessDropboxClass(student, file.classId))) return null;
  return file;
}
