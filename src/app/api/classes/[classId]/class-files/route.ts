import { getCurrentUser } from "@/lib/auth/session";
import { getInstructorManagedClass } from "@/lib/auth/instructor-class";
import { instructorClassFiles } from "@/lib/class-files/files";
import { ClassFileOperationError, parseClassFileClassId } from "@/lib/class-files/metadata-validation";
import { classFileErrorResponse, classFileNotFound, isClassFileRequestOriginAllowed,
  readClassFileFormData, refreshClassFilePages } from "@/lib/class-files/responses";

type Props = { params: Promise<{ classId: string }> };

export async function POST(request: Request, { params }: Props) {
  const user = await getCurrentUser();
  if (!user || user.role !== "INSTRUCTOR") return classFileNotFound();
  try {
    if (!isClassFileRequestOriginAllowed(request)) {
      throw new ClassFileOperationError("INVALID_ORIGIN", "Request not allowed.", 403);
    }
    const classId = parseClassFileClassId((await params).classId);
    if (classId === null || !await getInstructorManagedClass(classId, user)) return classFileNotFound();
    const data = await readClassFileFormData(request);
    const file = data.get("file");
    if (!(file instanceof File)) throw new ClassFileOperationError("MISSING_FILE", "Choose a file.");
    const result = await instructorClassFiles.upload(user, data.get("class"), data.get("title"),
      data.get("description"), file);
    refreshClassFilePages(result.classIds);
    return Response.json({ code: "UPLOADED", count: result.count,
      message: result.count === 1 ? "Class file uploaded." : `Class file uploaded to ${result.count} classes.` });
  } catch (error) { return classFileErrorResponse(error); }
}
