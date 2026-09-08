import "server-only";

function encodeRfc5987Value(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/gu, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

export function createDropboxContentDisposition(filename: string): string {
  const sanitized = filename
    .toWellFormed()
    .replace(/[\u0000-\u001f\u007f]/gu, "")
    .replace(/[\\/]/gu, "_")
    .trim();
  const safeUnicode = Array.from(sanitized).slice(0, 255).join("");
  const fallback = (safeUnicode || "download")
    .replace(/[^\u0020-\u007e]/gu, "_")
    .replace(/["\\]/gu, "_");

  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeRfc5987Value(
    safeUnicode || "download"
  )}`;
}
