import "server-only";

export const MAX_LABORATORY_SUBMISSION_SIZE = 20 * 1024 * 1024;
export const MAX_LABORATORY_SUBMISSION_FILENAME_LENGTH = 255;

export const LABORATORY_SUBMISSION_MIME_TYPES = {
  pdf: ["application/pdf"],
  docx: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/zip",
    "application/x-zip-compressed",
  ],
  pptx: [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/zip",
    "application/x-zip-compressed",
  ],
  zip: ["application/zip", "application/x-zip-compressed"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
} as const satisfies Readonly<Record<string, readonly string[]>>;

export const LABORATORY_SUBMISSION_FILE_ACCEPT = Object.keys(
  LABORATORY_SUBMISSION_MIME_TYPES
).map((extension) => `.${extension}`).join(",");

export type LaboratorySubmissionCandidate = { name: string; size: number; type: string };
export type LaboratorySubmissionValidationResult =
  | { ok: true; extension: string; mimeType: string }
  | {
      ok: false;
      code: "INVALID_FILENAME" | "INVALID_FILE_SIZE" | "EMPTY_FILE" |
        "FILE_TOO_LARGE" | "UNSUPPORTED_FILE_TYPE" | "MISSING_MIME_TYPE" |
        "MIME_TYPE_MISMATCH";
      message: string;
    };

function getExtension(filename: string): string | null {
  const baseName = filename.split(/[\\/]/u).at(-1)?.trim() ?? "";
  const dot = baseName.lastIndexOf(".");
  return dot > 0 && dot < baseName.length - 1
    ? baseName.slice(dot + 1).toLowerCase()
    : null;
}

export function validateLaboratorySubmission(
  candidate: LaboratorySubmissionCandidate
): LaboratorySubmissionValidationResult {
  const filename = candidate.name.trim();
  if (
    filename.length === 0 ||
    filename.length > MAX_LABORATORY_SUBMISSION_FILENAME_LENGTH ||
    /[\u0000-\u001f\u007f]/u.test(filename) ||
    /[\\/]/u.test(filename)
  ) {
    return { ok: false, code: "INVALID_FILENAME", message: "Choose a file with a valid filename of 255 characters or fewer." };
  }
  if (!Number.isSafeInteger(candidate.size) || candidate.size < 0) {
    return { ok: false, code: "INVALID_FILE_SIZE", message: "The file size is invalid." };
  }
  if (candidate.size === 0) {
    return { ok: false, code: "EMPTY_FILE", message: "Empty files cannot be submitted." };
  }
  if (candidate.size > MAX_LABORATORY_SUBMISSION_SIZE) {
    return { ok: false, code: "FILE_TOO_LARGE", message: "Files must be 20 MB or smaller." };
  }

  const extension = getExtension(filename);
  const allowedMimeTypes = extension
    ? LABORATORY_SUBMISSION_MIME_TYPES[
        extension as keyof typeof LABORATORY_SUBMISSION_MIME_TYPES
      ]
    : undefined;
  if (!extension || !allowedMimeTypes) {
    return { ok: false, code: "UNSUPPORTED_FILE_TYPE", message: "Only PDF, DOCX, PPTX, ZIP, PNG, and JPG files are supported." };
  }

  const mimeType = candidate.type.trim().toLowerCase();
  if (!mimeType) {
    return { ok: false, code: "MISSING_MIME_TYPE", message: "The file content type could not be verified." };
  }
  if (!(allowedMimeTypes as readonly string[]).includes(mimeType)) {
    return { ok: false, code: "MIME_TYPE_MISMATCH", message: "The file content type does not match its filename." };
  }
  return { ok: true, extension, mimeType };
}
