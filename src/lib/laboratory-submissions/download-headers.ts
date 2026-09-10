import "server-only";

import { LABORATORY_SUBMISSION_MIME_TYPES } from "./validation";

const SAFE_DOWNLOAD_MIME_TYPES = new Set<string>(
  Object.values(LABORATORY_SUBMISSION_MIME_TYPES).flat()
);

const INLINE_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
]);

function encodeRfc5987Value(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/gu, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function sanitizeDownloadFilename(filename: string): string {
  const sanitized = filename
    .toWellFormed()
    .replace(/[\u0000-\u001f\u007f]/gu, "")
    .replace(/[\\/]/gu, "_")
    .trim();

  return Array.from(sanitized).slice(0, 255).join("") || "submission";
}

export function getSafeLaboratorySubmissionDownloadMimeType(
  mimeType: string
): string {
  const normalized = mimeType.trim().toLowerCase();
  return SAFE_DOWNLOAD_MIME_TYPES.has(normalized)
    ? normalized
    : "application/octet-stream";
}

export function createLaboratorySubmissionContentDisposition({
  filename,
  mimeType,
}: {
  filename: string;
  mimeType: string;
}): string {
  const safeUnicode = sanitizeDownloadFilename(filename);
  const fallback = safeUnicode
    .replace(/[^\u0020-\u007e]/gu, "_")
    .replace(/["\\]/gu, "_");
  const disposition = INLINE_MIME_TYPES.has(
    getSafeLaboratorySubmissionDownloadMimeType(mimeType)
  )
    ? "inline"
    : "attachment";

  return `${disposition}; filename="${fallback}"; filename*=UTF-8''${encodeRfc5987Value(
    safeUnicode
  )}`;
}
