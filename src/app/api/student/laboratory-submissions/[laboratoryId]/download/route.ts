import {
  getAuthorizedStudentGroupSubmission,
  resolveStudentOfficialLaboratoryGroup,
} from "@/lib/auth/laboratory-submissions";
import { getStudentSession } from "@/lib/auth/student-session";
import {
  createLaboratorySubmissionContentDisposition,
  getSafeLaboratorySubmissionDownloadMimeType,
} from "@/lib/laboratory-submissions/download-headers";
import { logLaboratorySubmissionServerError } from "@/lib/laboratory-submissions/logging";
import { getLaboratorySubmissionObject } from "@/lib/laboratory-submissions/storage";
import { getStudentPortalContext } from "@/lib/student-portal-class";

type RouteProps = {
  params: Promise<{ laboratoryId: string }>;
};

function fileUnavailable(): Response {
  return Response.json(
    { code: "NOT_FOUND", message: "Group submission file is unavailable." },
    { status: 404 }
  );
}

function parseLaboratoryId(value: string): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(
  _request: Request,
  { params }: RouteProps
): Promise<Response> {
  const student = await getStudentSession();

  if (!student) {
    return fileUnavailable();
  }

  try {
    const { selectedClass } = await getStudentPortalContext(student.id);
    const { laboratoryId: laboratoryIdParam } = await params;
    const laboratoryId = parseLaboratoryId(laboratoryIdParam);

    if (!selectedClass || !laboratoryId) {
      return fileUnavailable();
    }

    const group = await resolveStudentOfficialLaboratoryGroup(
      student,
      selectedClass.id,
      laboratoryId
    );

    if (!group) {
      return fileUnavailable();
    }

    const submission = await getAuthorizedStudentGroupSubmission(
      student,
      selectedClass.id,
      group.laboratoryId
    );

    if (!submission) {
      return fileUnavailable();
    }

    const object = await getLaboratorySubmissionObject(submission.r2Key);

    if (!object) {
      return fileUnavailable();
    }

    return new Response(object.body, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Disposition": createLaboratorySubmissionContentDisposition({
          filename: submission.originalFilename,
          mimeType: submission.mimeType,
        }),
        "Content-Length": String(object.size),
        "Content-Type": getSafeLaboratorySubmissionDownloadMimeType(
          submission.mimeType
        ),
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    logLaboratorySubmissionServerError(
      "[ClassPilot student laboratory submission download error]",
      error
    );

    return Response.json(
      { code: "SERVER_ERROR", message: "Could not download the submission." },
      { status: 500 }
    );
  }
}
