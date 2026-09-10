import { getCloudflareContext } from "@opennextjs/cloudflare";

import { getInstructorManagedClass } from "@/lib/auth/instructor-class";
import { getCurrentUser } from "@/lib/auth/session";
import { getGroupSubmission } from "@/lib/db/laboratory-submissions";
import {
  createLaboratorySubmissionContentDisposition,
  getSafeLaboratorySubmissionDownloadMimeType,
} from "@/lib/laboratory-submissions/download-headers";
import { logLaboratorySubmissionServerError } from "@/lib/laboratory-submissions/logging";
import { getLaboratorySubmissionObject } from "@/lib/laboratory-submissions/storage";

type RouteProps = {
  params: Promise<{
    classId: string;
    laboratoryId: string;
    groupId: string;
  }>;
};

function fileUnavailable(): Response {
  return Response.json(
    { code: "NOT_FOUND", message: "Group submission file is unavailable." },
    { status: 404 }
  );
}

function parsePositiveInteger(value: string): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(
  _request: Request,
  { params }: RouteProps
): Promise<Response> {
  const instructor = await getCurrentUser();

  if (!instructor) {
    return fileUnavailable();
  }

  try {
    const {
      classId: classIdParam,
      laboratoryId: laboratoryIdParam,
      groupId: groupIdParam,
    } = await params;
    const classId = parsePositiveInteger(classIdParam);
    const laboratoryId = parsePositiveInteger(laboratoryIdParam);
    const groupId = parsePositiveInteger(groupIdParam);

    if (!classId || !laboratoryId || !groupId) {
      return fileUnavailable();
    }

    const managedClass = await getInstructorManagedClass(classId, instructor);

    if (!managedClass) {
      return fileUnavailable();
    }

    const { env } = getCloudflareContext();
    const group = await env.DB.prepare(
      `
        SELECT lg.id
        FROM laboratory_groups lg
        INNER JOIN laboratories l ON l.id = lg.laboratory_id
        WHERE lg.id = ?1
          AND lg.laboratory_id = ?2
          AND l.class_id = ?3
          AND l.lab_type = 'group'
        LIMIT 1
      `
    ).bind(groupId, laboratoryId, managedClass.id).first<{ id: number }>();

    if (!group) {
      return fileUnavailable();
    }

    const submission = await getGroupSubmission(laboratoryId, groupId);

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
      "[ClassPilot instructor laboratory submission download error]",
      error
    );

    return Response.json(
      { code: "SERVER_ERROR", message: "Could not download the submission." },
      { status: 500 }
    );
  }
}
