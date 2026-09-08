import { getStudentSession } from "@/lib/auth/student-session";
import { canStudentAccessDropboxClass } from "@/lib/auth/dropbox";
import { storeDropboxFile, DropboxUploadValidationError } from "@/lib/dropbox/files";
import {
  isDropboxBatchSizeAllowed,
  isStudentDropboxUploadContextAllowed,
  MAX_DROPBOX_FILES_PER_BATCH,
} from "@/lib/dropbox/upload-rules";
import { getStudentPortalContext } from "@/lib/student-portal-class";
import { logDropboxServerError } from "@/lib/dropbox/logging";

type UploadFailure = {
  filename: string;
  message: string;
};

function safeClientFilename(filename: string): string {
  const normalized = filename
    .toWellFormed()
    .replace(/[\u0000-\u001f\u007f]/gu, "")
    .trim()
    .slice(0, 255);

  return normalized || "Unnamed file";
}

export async function POST(request: Request): Promise<Response> {
  const student = await getStudentSession();

  if (!student) {
    return Response.json(
      { code: "UNAUTHORIZED", message: "Authentication required." },
      { status: 401 }
    );
  }

  try {
    const { selectedClass } = await getStudentPortalContext(student.id);
    const hasActiveClassAccess = selectedClass
      ? await canStudentAccessDropboxClass(student, selectedClass.id)
      : false;

    if (
      !isStudentDropboxUploadContextAllowed({
        selectedClassId: selectedClass?.id ?? null,
        hasActiveClassAccess,
      }) ||
      !selectedClass
    ) {
      return Response.json(
        {
          code: "CLASS_NOT_FOUND",
          message: "No active class is available for this upload.",
        },
        { status: 403 }
      );
    }

    let formData: FormData;

    try {
      formData = await request.formData();
    } catch {
      return Response.json(
        { code: "INVALID_REQUEST", message: "Could not read the uploaded files." },
        { status: 400 }
      );
    }

    const submittedFiles = formData.getAll("files");

    if (!isDropboxBatchSizeAllowed(submittedFiles.length)) {
      return Response.json(
        {
          code: "INVALID_BATCH_SIZE",
          message: `Choose between 1 and ${MAX_DROPBOX_FILES_PER_BATCH} files per upload.`,
        },
        { status: 400 }
      );
    }

    if (submittedFiles.some((entry) => !(entry instanceof File))) {
      return Response.json(
        { code: "INVALID_REQUEST", message: "The upload contains an invalid file." },
        { status: 400 }
      );
    }

    const failures: UploadFailure[] = [];
    let uploadedCount = 0;

    for (const file of submittedFiles) {
      if (!(file instanceof File)) {
        continue;
      }

      try {
        await storeDropboxFile({
          classId: selectedClass.id,
          studentId: student.id,
          file,
        });
        uploadedCount += 1;
      } catch (error) {
        if (error instanceof DropboxUploadValidationError) {
          failures.push({
            filename: safeClientFilename(file.name),
            message: error.message,
          });
          continue;
        }

        logDropboxServerError(
          "[ClassPilot student Dropbox upload error]",
          error
        );
        failures.push({
          filename: safeClientFilename(file.name),
          message: "Could not upload this file. Please try again.",
        });
      }
    }

    const failedCount = failures.length;
    const uploadedLabel = `${uploadedCount} ${
      uploadedCount === 1 ? "file" : "files"
    } uploaded`;
    const message =
      failedCount === 0
        ? `${uploadedLabel} successfully.`
        : uploadedCount === 0
          ? "No files were uploaded."
          : `${uploadedLabel}. ${failedCount} ${
              failedCount === 1 ? "file" : "files"
            } could not be uploaded.`;
    const status =
      failedCount === 0 ? 200 : uploadedCount === 0 ? 422 : 207;

    return Response.json(
      {
        code:
          failedCount === 0
            ? "UPLOADED"
            : uploadedCount === 0
              ? "UPLOAD_FAILED"
              : "PARTIAL_UPLOAD",
        message,
        uploadedCount,
        failedCount,
        failures,
      },
      { status }
    );
  } catch (error) {
    logDropboxServerError(
      "[ClassPilot student Dropbox request error]",
      error
    );

    return Response.json(
      {
        code: "SERVER_ERROR",
        message: "Could not upload files right now. Please try again.",
      },
      { status: 500 }
    );
  }
}
