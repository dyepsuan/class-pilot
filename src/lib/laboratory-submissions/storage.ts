import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isLaboratorySubmissionKey } from "./storage-key";

export type LaboratorySubmissionObjectBody = ReadableStream | ArrayBuffer |
  ArrayBufferView | string | Blob;

function getLaboratorySubmissionsBucket(): R2Bucket {
  return getCloudflareContext().env.LABORATORY_SUBMISSIONS;
}

function assertSubmissionKey(r2Key: string): void {
  if (!isLaboratorySubmissionKey(r2Key)) {
    throw new TypeError("Invalid laboratory submission storage key.");
  }
}

export async function putLaboratorySubmissionObject({
  r2Key,
  body,
  contentType,
  originalFilename,
}: {
  r2Key: string;
  body: LaboratorySubmissionObjectBody;
  contentType: string;
  originalFilename?: string;
}): Promise<R2Object> {
  assertSubmissionKey(r2Key);
  return getLaboratorySubmissionsBucket().put(r2Key, body, {
    httpMetadata: { contentType },
    customMetadata: originalFilename ? { originalFilename } : undefined,
  });
}

export async function getLaboratorySubmissionObject(r2Key: string): Promise<R2ObjectBody | null> {
  assertSubmissionKey(r2Key);
  return getLaboratorySubmissionsBucket().get(r2Key);
}

export async function deleteLaboratorySubmissionObject(r2Key: string): Promise<void> {
  assertSubmissionKey(r2Key);
  await getLaboratorySubmissionsBucket().delete(r2Key);
}
