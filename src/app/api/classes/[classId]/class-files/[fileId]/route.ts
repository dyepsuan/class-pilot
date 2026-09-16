import { getCurrentUser } from "@/lib/auth/session";
import { instructorClassFiles } from "@/lib/class-files/files";
import { ClassFileOperationError, parseClassFileClassId } from "@/lib/class-files/metadata-validation";
import { classFileErrorResponse, classFileNotFound, isClassFileRequestOriginAllowed,
  readClassFileJson, refreshClassFilePages } from "@/lib/class-files/responses";

type Props = { params: Promise<{ classId: string; fileId: string }> };

async function mutate(request: Request, props: Props, deleting: boolean) {
  const user = await getCurrentUser();
  if (!user || user.role !== "INSTRUCTOR") return classFileNotFound();
  try {
    if (!isClassFileRequestOriginAllowed(request)) {
      throw new ClassFileOperationError("INVALID_ORIGIN", "Request not allowed.", 403);
    }
    const params = await props.params;
    const classId = parseClassFileClassId(params.classId);
    if (classId === null) return classFileNotFound();
    if (deleting) {
      const result = await instructorClassFiles.delete(user, classId, params.fileId);
      refreshClassFilePages(result.classIds);
      return Response.json({ code: "DELETED", cleanupPending: result.cleanupPending,
        message: result.cleanupPending ? "Class file deleted. Storage cleanup could not be completed; the issue was logged." : "Class file deleted." });
    }
    const data = await readClassFileJson(request);
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new ClassFileOperationError("INVALID_METADATA", "Enter valid file details.");
    }
    const metadata = data as Record<string, unknown>;
    const result = await instructorClassFiles.edit(user, classId, params.fileId, metadata.title, metadata.description);
    refreshClassFilePages(result.classIds);
    return Response.json({ code: "UPDATED", message: "Class file details updated." });
  } catch (error) { return classFileErrorResponse(error); }
}

export async function PATCH(request: Request, props: Props) { return mutate(request, props, false); }
export async function DELETE(request: Request, props: Props) { return mutate(request, props, true); }
