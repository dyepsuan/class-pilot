import "server-only";

export function logDropboxServerError(context: string, error: unknown): void {
  console.error(context, {
    errorName: error instanceof Error ? error.name : "UnknownError",
  });
}
