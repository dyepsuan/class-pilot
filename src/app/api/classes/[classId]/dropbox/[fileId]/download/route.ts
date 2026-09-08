import { getAuthorizedDropboxFileForInstructorClass } from "@/lib/auth/dropbox";
import { getCurrentUser } from "@/lib/auth/session";
import { createDropboxContentDisposition } from "@/lib/dropbox/download-headers";
import { isDropboxFileId } from "@/lib/dropbox/resource-id";
import { logDropboxServerError } from "@/lib/dropbox/logging";
import { getDropboxObject } from "@/lib/dropbox/storage";
import { getSafeDropboxDownloadMimeType } from "@/lib/dropbox/validation";

type RouteProps = {
  params: Promise<{
    classId: string;
    fileId: string;
  }>;
};

function fileNotFound(): Response {
  return Response.json(
    { code: "NOT_FOUND", message: "File not found." },
    { status: 404 }
  );
}

export async function GET(
  _request: Request,
  { params }: RouteProps
): Promise<Response> {
  const instructor = await getCurrentUser();

  if (!instructor) {
    return fileNotFound();
  }

  try {
    const { classId, fileId } = await params;
    const requestedClassId = Number(classId);

    if (
      !Number.isSafeInteger(requestedClassId) ||
      requestedClassId <= 0 ||
      !isDropboxFileId(fileId)
    ) {
      return fileNotFound();
    }

    const file = await getAuthorizedDropboxFileForInstructorClass(
      fileId,
      requestedClassId,
      instructor
    );

    if (!file) {
      return fileNotFound();
    }

    const object = await getDropboxObject(file.storageKey);

    if (!object) {
      return fileNotFound();
    }

    return new Response(object.body, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Disposition": createDropboxContentDisposition(
          file.originalFilename
        ),
        "Content-Length": String(object.size),
        "Content-Type": getSafeDropboxDownloadMimeType(file.mimeType),
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    logDropboxServerError(
      "[ClassPilot instructor Dropbox download error]",
      error
    );

    return Response.json(
      { code: "SERVER_ERROR", message: "Could not download the file." },
      { status: 500 }
    );
  }
}
