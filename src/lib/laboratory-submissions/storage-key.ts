import "server-only";

function requirePositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive integer.`);
  }
}

export function generateLaboratorySubmissionKey(laboratoryId: number, groupId: number): string {
  requirePositiveInteger(laboratoryId, "Laboratory ID");
  requirePositiveInteger(groupId, "Group ID");
  return `laboratories/${laboratoryId}/groups/${groupId}/${crypto.randomUUID()}`;
}

export function isLaboratorySubmissionKey(value: string): boolean {
  return /^laboratories\/[1-9]\d*\/groups\/[1-9]\d*\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}
