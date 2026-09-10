import { resolveStudentOfficialLaboratoryGroup } from "@/lib/auth/laboratory-submissions";
import { getStudentSession } from "@/lib/auth/student-session";
import {
  LaboratorySubmissionUploadError,
  storeStudentLaboratoryGroupSubmission,
} from "@/lib/laboratory-submissions/files";
import { logLaboratorySubmissionServerError } from "@/lib/laboratory-submissions/logging";
import { getStudentPortalContext } from "@/lib/student-portal-class";

function jsonError(code: string, message: string, status: number): Response {
  return Response.json({ code, message }, { status });
}

function parsePositiveInteger(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string") return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function optionalString(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function POST(request: Request): Promise<Response> {
  const student = await getStudentSession();

  if (!student) {
    return jsonError("UNAUTHORIZED", "Authentication required.", 401);
  }

  try {
    let formData: FormData;

    try {
      formData = await request.formData();
    } catch {
      return jsonError(
        "INVALID_REQUEST",
        "Could not read the uploaded file.",
        400
      );
    }

    const laboratoryId = parsePositiveInteger(formData.get("laboratoryId"));
    const file = formData.get("file");

    if (!laboratoryId || !(file instanceof File)) {
      return jsonError(
        "INVALID_REQUEST",
        "Choose a valid laboratory and file.",
        400
      );
    }

    const { selectedClass } = await getStudentPortalContext(student.id);

    if (!selectedClass) {
      return jsonError(
        "CLASS_NOT_FOUND",
        "No active class is available for this submission.",
        403
      );
    }

    const group = await resolveStudentOfficialLaboratoryGroup(
      student,
      selectedClass.id,
      laboratoryId
    );

    if (!group) {
      return jsonError(
        "NOT_FOUND",
        "Group submission is not available for this laboratory.",
        404
      );
    }

    const submission = await storeStudentLaboratoryGroupSubmission({
      student,
      group,
      file,
      expectedSubmissionId: optionalString(formData.get("expectedSubmissionId")),
      expectedUpdatedAt: optionalString(formData.get("expectedUpdatedAt")),
    });

    return Response.json({
      code: "SUBMITTED",
      message: "Group submission uploaded.",
      submission: {
        id: submission.id,
        originalFilename: submission.originalFilename,
        mimeType: submission.mimeType,
        fileSize: submission.fileSize,
        submittedAt: submission.submittedAt,
        updatedAt: submission.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof LaboratorySubmissionUploadError) {
      const status = error.code === "SUBMISSION_CONFLICT"
        ? 409
        : error.code === "SUBMISSIONS_CLOSED"
          ? 403
          : 422;

      return jsonError(error.code, error.message, status);
    }

    logLaboratorySubmissionServerError(
      "[ClassPilot student laboratory submission upload error]",
      error
    );

    return jsonError(
      "SERVER_ERROR",
      "Could not upload the group submission. Please try again.",
      500
    );
  }
}
