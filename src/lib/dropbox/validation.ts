import "server-only";

export const MAX_DROPBOX_FILE_SIZE = 25 * 1024 * 1024;
export const MAX_DROPBOX_FILENAME_LENGTH = 255;

const DANGEROUS_EXTENSIONS = new Set([
  "exe",
  "bat",
  "cmd",
  "com",
  "scr",
  "ps1",
  "sh",
  "js",
  "mjs",
  "cjs",
  "html",
  "htm",
  "php",
]);

const MIME_TYPES_BY_EXTENSION: Readonly<Record<string, readonly string[]>> = {
  pdf: ["application/pdf"],
  doc: ["application/msword"],
  docx: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/zip",
  ],
  xls: ["application/vnd.ms-excel"],
  xlsx: [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/zip",
  ],
  ppt: ["application/vnd.ms-powerpoint"],
  pptx: [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/zip",
  ],
  txt: ["text/plain"],
  csv: ["text/csv", "application/csv", "text/plain"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  zip: ["application/zip", "application/x-zip-compressed"],
};

const GENERIC_MIME_TYPES = new Set([
  "application/octet-stream",
  "application/x-download",
]);

const ALLOWED_MIME_TYPES = new Set(Object.values(MIME_TYPES_BY_EXTENSION).flat());

export const DROPBOX_FILE_INPUT_ACCEPT = Object.keys(MIME_TYPES_BY_EXTENSION)
  .map((extension) => `.${extension}`)
  .join(",");

export type DropboxUploadCandidate = {
  name: string;
  size: number;
  type?: string;
};

export type DropboxValidationErrorCode =
  | "INVALID_FILENAME"
  | "EMPTY_FILE"
  | "FILE_TOO_LARGE"
  | "INVALID_FILE_SIZE"
  | "DANGEROUS_FILE_TYPE"
  | "UNSUPPORTED_FILE_TYPE"
  | "MIME_TYPE_MISMATCH";

export type DropboxValidationResult =
  | {
      ok: true;
      extension: string;
      mimeType: string;
    }
  | {
      ok: false;
      code: DropboxValidationErrorCode;
      message: string;
    };

function getFilenameExtension(filename: string): string | null {
  const baseName = filename.split(/[\\/]/u).at(-1)?.trim() ?? "";
  const lastDot = baseName.lastIndexOf(".");

  if (lastDot <= 0 || lastDot === baseName.length - 1) {
    return null;
  }

  return baseName.slice(lastDot + 1).toLowerCase();
}

export function validateDropboxUpload(
  file: DropboxUploadCandidate
): DropboxValidationResult {
  const filename = file.name.trim();

  if (
    filename.length === 0 ||
    filename.length > MAX_DROPBOX_FILENAME_LENGTH ||
    /[\u0000-\u001f\u007f]/u.test(filename) ||
    /[\\/]/u.test(filename)
  ) {
    return {
      ok: false,
      code: "INVALID_FILENAME",
      message: "Choose a file with a valid filename of 255 characters or fewer.",
    };
  }

  if (!Number.isSafeInteger(file.size) || file.size < 0) {
    return {
      ok: false,
      code: "INVALID_FILE_SIZE",
      message: "The file size is invalid.",
    };
  }

  if (file.size === 0) {
    return {
      ok: false,
      code: "EMPTY_FILE",
      message: "Empty files cannot be uploaded.",
    };
  }

  if (file.size > MAX_DROPBOX_FILE_SIZE) {
    return {
      ok: false,
      code: "FILE_TOO_LARGE",
      message: "Files must be 25 MB or smaller.",
    };
  }

  const extension = getFilenameExtension(filename);

  if (extension && DANGEROUS_EXTENSIONS.has(extension)) {
    return {
      ok: false,
      code: "DANGEROUS_FILE_TYPE",
      message: "That file type is not allowed.",
    };
  }

  const allowedMimeTypes = extension
    ? MIME_TYPES_BY_EXTENSION[extension]
    : undefined;

  if (!extension || !allowedMimeTypes) {
    return {
      ok: false,
      code: "UNSUPPORTED_FILE_TYPE",
      message: "That file type is not supported.",
    };
  }

  const suppliedMimeType = file.type?.trim().toLowerCase() ?? "";

  if (
    suppliedMimeType &&
    !GENERIC_MIME_TYPES.has(suppliedMimeType) &&
    !allowedMimeTypes.includes(suppliedMimeType)
  ) {
    return {
      ok: false,
      code: "MIME_TYPE_MISMATCH",
      message: "The file content type does not match its filename.",
    };
  }

  return {
    ok: true,
    extension,
    mimeType: suppliedMimeType || allowedMimeTypes[0],
  };
}

export function getSafeDropboxDownloadMimeType(mimeType: string): string {
  const normalized = mimeType.trim().toLowerCase();

  if (GENERIC_MIME_TYPES.has(normalized)) {
    return "application/octet-stream";
  }

  return ALLOWED_MIME_TYPES.has(normalized)
    ? normalized
    : "application/octet-stream";
}
