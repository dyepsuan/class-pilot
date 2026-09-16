import { getCurrentUser } from "@/lib/auth/session";
import { getAuthorizedInstructorClassFile } from "@/lib/auth/class-files";
import { listClassFileStudentViewDetails } from "@/lib/db/class-files";
import { parseClassFileClassId } from "@/lib/class-files/metadata-validation";
import { logDropboxServerError } from "@/lib/dropbox/logging";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };
const notFound = () => Response.json({ code: "NOT_FOUND", message: "File not found." }, { status: 404, headers });

export async function GET(_request: Request,
  { params }: { params: Promise<{ classId: string; fileId: string }> }) {
  try {
    const instructor = await getCurrentUser();
    if (!instructor || instructor.role !== "INSTRUCTOR") return notFound();
    const { classId: value, fileId } = await params;
    const classId = parseClassFileClassId(value);
    if (classId === null || !await getAuthorizedInstructorClassFile(fileId, classId, instructor)) return notFound();
    const students = await listClassFileStudentViewDetails(fileId, classId, instructor);
    return Response.json({ students }, { headers });
  } catch (error) {
    logDropboxServerError("[ClassPilot Class File view details error]", error);
    return Response.json({ code: "SERVER_ERROR", message: "Could not load view details. Please try again." }, { status: 500, headers });
  }
}
