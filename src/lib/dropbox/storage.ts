import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

import { isDropboxStorageKey } from "./storage-key";

export type DropboxObjectBody =
  | ReadableStream
  | ArrayBuffer
  | ArrayBufferView
  | string
  | Blob;

function getDropboxBucket(): R2Bucket {
  return getCloudflareContext().env.DROPBOX_BUCKET;
}

function assertDropboxStorageKey(storageKey: string): void {
  if (!isDropboxStorageKey(storageKey)) {
    throw new TypeError("Invalid Dropbox storage key.");
  }
}

export async function putDropboxObject({
  storageKey,
  body,
  contentType,
}: {
  storageKey: string;
  body: DropboxObjectBody;
  contentType?: string;
}): Promise<R2Object> {
  assertDropboxStorageKey(storageKey);

  return getDropboxBucket().put(storageKey, body, {
    httpMetadata: contentType ? { contentType } : undefined,
  });
}

export async function getDropboxObject(
  storageKey: string
): Promise<R2ObjectBody | null> {
  assertDropboxStorageKey(storageKey);
  return getDropboxBucket().get(storageKey);
}

export async function deleteDropboxObject(storageKey: string): Promise<void> {
  assertDropboxStorageKey(storageKey);
  await getDropboxBucket().delete(storageKey);
}
