import "server-only";

export type AuthorizedDropboxDeleteResult =
  | "NOT_FOUND"
  | "DELETED"
  | "DELETE_FAILED";

export function hasAuthorizedDropboxFile<T>(
  authorizedFile: T | null
): authorizedFile is T {
  return authorizedFile !== null;
}

export async function executeAuthorizedDropboxDelete<T>({
  authorizedFile,
  deleteFile,
}: {
  authorizedFile: T | null;
  deleteFile: (file: T) => Promise<boolean>;
}): Promise<AuthorizedDropboxDeleteResult> {
  if (!hasAuthorizedDropboxFile(authorizedFile)) {
    return "NOT_FOUND";
  }

  return (await deleteFile(authorizedFile)) ? "DELETED" : "DELETE_FAILED";
}
