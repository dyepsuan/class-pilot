import "server-only";

export function logLaboratorySubmissionServerError(
  context: string,
  error: unknown
): void {
  console.error(context, {
    errorName: error instanceof Error ? error.name : "UnknownError",
  });
}
