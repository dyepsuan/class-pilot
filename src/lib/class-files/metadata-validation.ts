export const MAX_CLASS_FILE_TITLE_LENGTH = 255;
export const MAX_CLASS_FILE_DESCRIPTION_LENGTH = 5000;

export class ClassFileOperationError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400) {
    super(message);
    this.name = "ClassFileOperationError";
  }
}

export function validateClassFileMetadata(title: unknown, description: unknown) {
  if (typeof title !== "string" || !title.trim() ||
      title.trim().length > MAX_CLASS_FILE_TITLE_LENGTH || /[\u0000-\u001f\u007f]/u.test(title)) {
    throw new ClassFileOperationError("INVALID_TITLE", "Enter a title of 1–255 characters.");
  }
  if (description !== null && description !== undefined && typeof description !== "string") {
    throw new ClassFileOperationError("INVALID_DESCRIPTION", "Enter a valid description.");
  }
  const normalizedDescription = typeof description === "string" ? description.trim() : "";
  if (normalizedDescription.length > MAX_CLASS_FILE_DESCRIPTION_LENGTH ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(normalizedDescription)) {
    throw new ClassFileOperationError("INVALID_DESCRIPTION", "Description must be 5,000 characters or fewer.");
  }
  return { title: title.trim(), description: normalizedDescription || null };
}

export function parseClassFileClassId(value: unknown): number | null {
  if (typeof value !== "string" || !/^[1-9]\d*$/u.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}
