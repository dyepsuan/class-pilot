import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { DropboxObjectBody } from "@/lib/dropbox/storage";
import { isClassFileStorageKey } from "./storage-key";

function bucketForKey(storageKey: string): R2Bucket {
  if (!isClassFileStorageKey(storageKey)) {
    throw new TypeError("Invalid Class File storage key.");
  }
  return getCloudflareContext().env.DROPBOX_BUCKET;
}

// Internal storage primitives. Callers must authorize the session/class first.
// No public URL or presigned URL is generated.
export async function putClassFileObject({ storageKey, body, contentType }: {
  storageKey: string;
  body: DropboxObjectBody;
  contentType: string;
}): Promise<R2Object> {
  return bucketForKey(storageKey).put(storageKey, body, {
    httpMetadata: { contentType },
  });
}

export async function getClassFileObject(storageKey: string): Promise<R2ObjectBody | null> {
  return bucketForKey(storageKey).get(storageKey);
}

export async function deleteClassFileObject(storageKey: string): Promise<void> {
  await bucketForKey(storageKey).delete(storageKey);
}
