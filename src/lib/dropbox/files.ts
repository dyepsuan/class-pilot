import "server-only";

import {
  createDropboxFileMetadata,
  deleteDropboxFileMetadata,
  type DropboxFileMetadata,
} from "@/lib/db/dropbox";

import { deleteDropboxObject, putDropboxObject } from "./storage";
import { generateDropboxStorageKey } from "./storage-key";
import {
  MAX_DROPBOX_FILENAME_LENGTH,
  validateDropboxUpload,
  type DropboxValidationErrorCode,
} from "./validation";
import { logDropboxServerError } from "./logging";

export class DropboxUploadValidationError extends Error {
  readonly code: DropboxValidationErrorCode;

  constructor(code: DropboxValidationErrorCode, message: string) {
    super(message);
    this.name = "DropboxUploadValidationError";
    this.code = code;
  }
}

export type DropboxUploadFile = {
  name: string;
  size: number;
  type: string;
  stream(): ReadableStream;
};

function normalizeDisplayName(
  displayName: string | undefined,
  originalFilename: string
): string {
  const normalized = displayName?.trim() || originalFilename.trim();

  if (
    normalized.length === 0 ||
    normalized.length > MAX_DROPBOX_FILENAME_LENGTH
  ) {
    throw new DropboxUploadValidationError(
      "INVALID_FILENAME",
      "The display name must be between 1 and 255 characters."
    );
  }

  return normalized;
}

export async function storeDropboxFile({
  classId,
  studentId,
  file,
  displayName,
}: {
  classId: number;
  studentId: number;
  file: DropboxUploadFile;
  displayName?: string;
}): Promise<DropboxFileMetadata> {
  const validation = validateDropboxUpload(file);

  if (!validation.ok) {
    throw new DropboxUploadValidationError(validation.code, validation.message);
  }

  const normalizedDisplayName = normalizeDisplayName(displayName, file.name);
  const storageKey = generateDropboxStorageKey(classId, studentId);
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  await putDropboxObject({
    storageKey,
    body: file.stream(),
    contentType: validation.mimeType,
  });

  try {
    const metadata = await createDropboxFileMetadata({
      id,
      classId,
      studentId,
      storageKey,
      originalFilename: file.name.trim(),
      displayName: normalizedDisplayName,
      mimeType: validation.mimeType,
      fileSize: file.size,
      createdAt,
    });

    if (!metadata) {
      throw new Error("Dropbox metadata was not created for an active enrollment.");
    }

    return metadata;
  } catch (error) {
    try {
      await deleteDropboxObject(storageKey);
    } catch (cleanupError) {
      logDropboxServerError(
        "[ClassPilot Dropbox upload cleanup error]",
        cleanupError
      );
    }

    throw error;
  }
}

export async function deleteDropboxFile(
  file: Pick<DropboxFileMetadata, "id" | "storageKey">
): Promise<boolean> {
  await deleteDropboxObject(file.storageKey);
  return deleteDropboxFileMetadata(file.id);
}
