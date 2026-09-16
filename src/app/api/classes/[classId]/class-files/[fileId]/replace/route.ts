import { getCurrentUser } from "@/lib/auth/session";
import { getAuthorizedInstructorClassFile } from "@/lib/auth/class-files";
import { instructorClassFiles } from "@/lib/class-files/files";
import { ClassFileOperationError, parseClassFileClassId } from "@/lib/class-files/metadata-validation";
import { classFileErrorResponse, classFileNotFound, isClassFileRequestOriginAllowed,
  readClassFileFormData, refreshClassFilePages } from "@/lib/class-files/responses";

type Props = { params: Promise<{ classId: string; fileId: string }> };

export async function POST(request: Request, { params }: Props) {
  const user = await getCurrentUser();
  if (!user || user.role !== "INSTRUCTOR") return classFileNotFound();
  try {
    if (!isClassFileRequestOriginAllowed(request)) {
      throw new ClassFileOperationError("INVALID_ORIGIN", "Request not allowed.", 403);
    }
    const values = await params;
    const classId = parseClassFileClassId(values.classId);
    if (classId === null || !await getAuthorizedInstructorClassFile(values.fileId, classId, user)) {
      return classFileNotFound();
    }
    const data = await readClassFileFormData(request);
    const file = data.get("file");
    if (!(file instanceof File)) throw new ClassFileOperationError("MISSING_FILE", "Choose a replacement file.");
    const result = await instructorClassFiles.replace(user, classId, values.fileId, file);
    refreshClassFilePages(result.classIds);
    return Response.json({ code: "REPLACED", cleanupPending: result.cleanupPending,
      message: result.cleanupPending ? "Class file replaced. Previous file cleanup could not be completed; the issue was logged." : "Class file replaced." });
  } catch (error) { return classFileErrorResponse(error); }
}
