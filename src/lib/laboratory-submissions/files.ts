import "server-only";

import type { AuthorizedLaboratoryGroup } from "@/lib/auth/laboratory-submissions";
import type { AuthenticatedStudent } from "@/lib/auth/student-session";
import {
  createInitialGroupSubmissionMetadata,
  getGroupSubmission,
  replaceGroupSubmissionMetadata,
  type LaboratoryGroupSubmission,
} from "@/lib/db/laboratory-submissions";

import { logLaboratorySubmissionServerError } from "./logging";
import {
  deleteLaboratorySubmissionObject,
  putLaboratorySubmissionObject,
} from "./storage";
import { generateLaboratorySubmissionKey } from "./storage-key";
import {
  validateLaboratorySubmission,
  type LaboratorySubmissionValidationResult,
} from "./validation";

export type LaboratorySubmissionUploadFile = {
  name: string;
  size: number;
  type: string;
  stream(): ReadableStream;
};

type LaboratorySubmissionValidationCode = Extract<
  LaboratorySubmissionValidationResult,
  { ok: false }
>["code"];

type LaboratorySubmissionUploadErrorCode =
  | LaboratorySubmissionValidationCode
  | "SUBMISSIONS_CLOSED"
  | "SUBMISSION_CONFLICT";

export class LaboratorySubmissionUploadError extends Error {
  readonly code: LaboratorySubmissionUploadErrorCode;

  constructor(code: LaboratorySubmissionUploadErrorCode, message: string) {
    super(message);
    this.name = "LaboratorySubmissionUploadError";
    this.code = code;
  }
}

function normalizeOriginalFilename(filename: string): string {
  return filename.toWellFormed().trim();
}

async function cleanupCandidateObject(r2Key: string): Promise<void> {
  try {
    await deleteLaboratorySubmissionObject(r2Key);
  } catch (error) {
    logLaboratorySubmissionServerError(
      "[ClassPilot laboratory submission candidate cleanup error]",
      error
    );
  }
}

export async function storeStudentLaboratoryGroupSubmission({
  student,
  group,
  file,
  expectedSubmissionId,
  expectedUpdatedAt,
}: {
  student: AuthenticatedStudent;
  group: AuthorizedLaboratoryGroup;
  file: LaboratorySubmissionUploadFile;
  expectedSubmissionId?: string | null;
  expectedUpdatedAt?: string | null;
}): Promise<LaboratoryGroupSubmission> {
  if (group.status !== "open") {
    throw new LaboratorySubmissionUploadError(
      "SUBMISSIONS_CLOSED",
      "This laboratory is completed and no longer accepts submissions."
    );
  }

  const currentSubmission = await getGroupSubmission(
    group.laboratoryId,
    group.groupId
  );
  const expectsReplacement =
    Boolean(expectedSubmissionId) || Boolean(expectedUpdatedAt);

  if (!currentSubmission && expectsReplacement) {
    throw new LaboratorySubmissionUploadError(
      "SUBMISSION_CONFLICT",
      "The group submission changed. Refresh the page and try again."
    );
  }

  if (
    currentSubmission &&
    (
      expectedSubmissionId !== currentSubmission.id ||
      expectedUpdatedAt !== currentSubmission.updatedAt
    )
  ) {
    throw new LaboratorySubmissionUploadError(
      "SUBMISSION_CONFLICT",
      "The group submission changed. Refresh the page and try again."
    );
  }

  const validation = validateLaboratorySubmission(file);

  if (!validation.ok) {
    throw new LaboratorySubmissionUploadError(
      validation.code,
      validation.message
    );
  }

  const r2Key = generateLaboratorySubmissionKey(
    group.laboratoryId,
    group.groupId
  );
  const originalFilename = normalizeOriginalFilename(file.name);

  await putLaboratorySubmissionObject({
    r2Key,
    body: file.stream(),
    contentType: validation.mimeType,
    originalFilename,
  });

  if (!currentSubmission) {
    const submission = await createInitialGroupSubmissionMetadata({
      id: crypto.randomUUID(),
      laboratoryId: group.laboratoryId,
      groupId: group.groupId,
      uploadedByStudentId: student.id,
      r2Key,
      originalFilename,
      mimeType: validation.mimeType,
      fileSize: file.size,
    });

    if (!submission) {
      await cleanupCandidateObject(r2Key);
      throw new LaboratorySubmissionUploadError(
        "SUBMISSION_CONFLICT",
        "The group submission changed. Refresh the page and try again."
      );
    }

    return submission;
  }

  const replacement = await replaceGroupSubmissionMetadata({
    laboratoryId: group.laboratoryId,
    groupId: group.groupId,
    uploadedByStudentId: student.id,
    r2Key,
    originalFilename,
    mimeType: validation.mimeType,
    fileSize: file.size,
    expectedR2Key: currentSubmission.r2Key,
    expectedUpdatedAt: currentSubmission.updatedAt,
  });

  if (!replacement) {
    await cleanupCandidateObject(r2Key);
    throw new LaboratorySubmissionUploadError(
      "SUBMISSION_CONFLICT",
      "The group submission changed. Refresh the page and try again."
    );
  }

  try {
    await deleteLaboratorySubmissionObject(currentSubmission.r2Key);
  } catch (error) {
    logLaboratorySubmissionServerError(
      "[ClassPilot laboratory submission old object cleanup error]",
      error
    );
  }

  return replacement;
}
