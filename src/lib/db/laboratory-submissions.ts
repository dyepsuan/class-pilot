import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

import { isLaboratorySubmissionKey } from "@/lib/laboratory-submissions/storage-key";
import { LABORATORY_EFFECTIVE_LOCK_SQL } from "./laboratory-grouping";

export type LaboratoryGroupSubmission = {
  id: string;
  laboratoryId: number;
  groupId: number;
  uploadedByStudentId: number;
  r2Key: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  submittedAt: string;
  updatedAt: string;
};

export type LaboratoryGroupSubmissionSummary = Omit<
  LaboratoryGroupSubmission,
  "r2Key"
> & {
  uploadedByName: string;
};

type SubmissionWriteInput = {
  laboratoryId: number;
  groupId: number;
  uploadedByStudentId: number;
  r2Key: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
};

type LaboratoryGroupSubmissionRow = {
  id: string;
  laboratory_id: number;
  group_id: number;
  uploaded_by_student_id: number;
  r2_key: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  submitted_at: string;
  updated_at: string;
};

type LaboratoryGroupSubmissionSummaryRow = Omit<
  LaboratoryGroupSubmissionRow,
  "r2_key"
> & {
  uploaded_by_name: string;
};

const SUBMISSION_FIELDS = `
  id, laboratory_id, group_id, uploaded_by_student_id, r2_key,
  original_filename, mime_type, file_size, submitted_at, updated_at
`;

function toSubmission(row: LaboratoryGroupSubmissionRow): LaboratoryGroupSubmission {
  return {
    id: row.id,
    laboratoryId: Number(row.laboratory_id),
    groupId: Number(row.group_id),
    uploadedByStudentId: Number(row.uploaded_by_student_id),
    r2Key: row.r2_key,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    fileSize: Number(row.file_size),
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
  };
}

function toSubmissionSummary(
  row: LaboratoryGroupSubmissionSummaryRow
): LaboratoryGroupSubmissionSummary {
  return {
    id: row.id,
    laboratoryId: Number(row.laboratory_id),
    groupId: Number(row.group_id),
    uploadedByStudentId: Number(row.uploaded_by_student_id),
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    fileSize: Number(row.file_size),
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
    uploadedByName: row.uploaded_by_name,
  };
}

function assertSubmissionWriteInput(input: SubmissionWriteInput): void {
  const expectedPrefix =
    `laboratories/${input.laboratoryId}/groups/${input.groupId}/`;

  if (
    !isLaboratorySubmissionKey(input.r2Key) ||
    !input.r2Key.startsWith(expectedPrefix)
  ) {
    throw new TypeError("The R2 key does not match the laboratory group.");
  }
}

export async function getGroupSubmission(
  laboratoryId: number,
  groupId: number
): Promise<LaboratoryGroupSubmission | null> {
  const { env } = getCloudflareContext();
  const row = await env.DB.prepare(
    `SELECT ${SUBMISSION_FIELDS}
     FROM laboratory_group_submissions
     WHERE laboratory_id = ?1 AND group_id = ?2
     LIMIT 1`
  ).bind(laboratoryId, groupId).first<LaboratoryGroupSubmissionRow>();
  return row ? toSubmission(row) : null;
}

export async function getLaboratoryGroupSubmissions(
  laboratoryId: number
): Promise<LaboratoryGroupSubmission[]> {
  const { env } = getCloudflareContext();
  const result = await env.DB.prepare(
    `SELECT ${SUBMISSION_FIELDS}
     FROM laboratory_group_submissions
     WHERE laboratory_id = ?1
     ORDER BY updated_at DESC, group_id ASC`
  ).bind(laboratoryId).all<LaboratoryGroupSubmissionRow>();
  return result.results.map(toSubmission);
}

export async function getLaboratoryGroupSubmissionSummaries(
  laboratoryId: number
): Promise<LaboratoryGroupSubmissionSummary[]> {
  const { env } = getCloudflareContext();
  const result = await env.DB.prepare(
    `
      SELECT
        lgs.id,
        lgs.laboratory_id,
        lgs.group_id,
        lgs.uploaded_by_student_id,
        lgs.original_filename,
        lgs.mime_type,
        lgs.file_size,
        lgs.submitted_at,
        lgs.updated_at,
        TRIM(
          uploader.last_name || ', ' || uploader.first_name ||
          CASE WHEN uploader.middle_name IS NOT NULL AND uploader.middle_name <> ''
            THEN ' ' || uploader.middle_name ELSE '' END ||
          CASE WHEN uploader.suffix IS NOT NULL AND uploader.suffix <> ''
            THEN ' ' || uploader.suffix ELSE '' END
        ) AS uploaded_by_name
      FROM laboratory_group_submissions lgs
      INNER JOIN students uploader ON uploader.id = lgs.uploaded_by_student_id
      WHERE lgs.laboratory_id = ?1
      ORDER BY lgs.updated_at DESC, lgs.group_id ASC
    `
  ).bind(laboratoryId).all<LaboratoryGroupSubmissionSummaryRow>();

  return result.results.map(toSubmissionSummary);
}

export async function createInitialGroupSubmissionMetadata({
  id,
  laboratoryId,
  groupId,
  uploadedByStudentId,
  r2Key,
  originalFilename,
  mimeType,
  fileSize,
}: SubmissionWriteInput & { id: string }): Promise<LaboratoryGroupSubmission | null> {
  assertSubmissionWriteInput({
    laboratoryId,
    groupId,
    uploadedByStudentId,
    r2Key,
    originalFilename,
    mimeType,
    fileSize,
  });

  const timestamp = new Date().toISOString();
  const { env } = getCloudflareContext();
  const result = await env.DB.prepare(
    `
      INSERT OR IGNORE INTO laboratory_group_submissions (
        id, laboratory_id, group_id, uploaded_by_student_id, r2_key,
        original_filename, mime_type, file_size, submitted_at, updated_at
      )
      SELECT ?1, l.id, lg.id, e.student_id, ?2, ?3, ?4, ?5, ?6, ?6
      FROM laboratories l
      INNER JOIN laboratory_groups lg ON lg.laboratory_id = l.id
      INNER JOIN laboratory_group_members lgm ON lgm.laboratory_group_id = lg.id
      INNER JOIN enrollments e
        ON e.class_id = l.class_id
        AND e.student_id = lgm.student_id
        AND e.status = 'ACTIVE'
      INNER JOIN classes c ON c.id = l.class_id AND c.status = 'ACTIVE'
      WHERE l.id = ?7
        AND lg.id = ?8
        AND e.student_id = ?9
        AND l.lab_type = 'group'
        AND l.status = 'open'
        AND ${LABORATORY_EFFECTIVE_LOCK_SQL}
    `
  ).bind(
    id, r2Key, originalFilename, mimeType, fileSize, timestamp,
    laboratoryId, groupId, uploadedByStudentId
  ).run();

  if (!result.success || result.meta.changes !== 1) return null;
  return getGroupSubmission(laboratoryId, groupId);
}

export async function replaceGroupSubmissionMetadata({
  laboratoryId,
  groupId,
  uploadedByStudentId,
  r2Key,
  originalFilename,
  mimeType,
  fileSize,
  expectedR2Key,
  expectedUpdatedAt,
}: SubmissionWriteInput & {
  expectedR2Key: string;
  expectedUpdatedAt: string;
}): Promise<LaboratoryGroupSubmission | null> {
  assertSubmissionWriteInput({
    laboratoryId,
    groupId,
    uploadedByStudentId,
    r2Key,
    originalFilename,
    mimeType,
    fileSize,
  });

  if (!isLaboratorySubmissionKey(expectedR2Key)) {
    throw new TypeError("The expected R2 key is invalid.");
  }

  const timestamp = new Date().toISOString();
  const { env } = getCloudflareContext();
  const result = await env.DB.prepare(
    `
      UPDATE laboratory_group_submissions
      SET
        uploaded_by_student_id = ?1,
        r2_key = ?2,
        original_filename = ?3,
        mime_type = ?4,
        file_size = ?5,
        updated_at = ?6
      WHERE laboratory_id = ?7
        AND group_id = ?8
        AND r2_key = ?9
        AND updated_at = ?10
        AND EXISTS (
          SELECT 1
          FROM laboratories l
          INNER JOIN classes c ON c.id = l.class_id AND c.status = 'ACTIVE'
          INNER JOIN laboratory_groups lg ON lg.laboratory_id = l.id
          INNER JOIN laboratory_group_members lgm
            ON lgm.laboratory_group_id = lg.id
            AND lgm.student_id = ?11
          INNER JOIN enrollments e
            ON e.class_id = l.class_id
            AND e.student_id = lgm.student_id
            AND e.status = 'ACTIVE'
          WHERE l.id = ?7
            AND lg.id = ?8
            AND l.lab_type = 'group'
            AND l.status = 'open'
            AND ${LABORATORY_EFFECTIVE_LOCK_SQL}
        )
    `
  ).bind(
    uploadedByStudentId, r2Key, originalFilename, mimeType, fileSize,
    timestamp, laboratoryId, groupId, expectedR2Key, expectedUpdatedAt,
    uploadedByStudentId
  ).run();

  if (!result.success || result.meta.changes !== 1) return null;
  return getGroupSubmission(laboratoryId, groupId);
}

export async function upsertGroupSubmissionMetadata({
  id,
  laboratoryId,
  groupId,
  uploadedByStudentId,
  r2Key,
  originalFilename,
  mimeType,
  fileSize,
}: {
  id: string;
  laboratoryId: number;
  groupId: number;
  uploadedByStudentId: number;
  r2Key: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
}): Promise<LaboratoryGroupSubmission | null> {
  assertSubmissionWriteInput({
    laboratoryId,
    groupId,
    uploadedByStudentId,
    r2Key,
    originalFilename,
    mimeType,
    fileSize,
  });

  const timestamp = new Date().toISOString();
  const { env } = getCloudflareContext();

  // Phase 2 replacement order: put the new object, call this atomic upsert,
  // then delete the previous key. If this fails, delete the new object while
  // retaining the previous metadata and object.
  const result = await env.DB.prepare(
    `
      INSERT INTO laboratory_group_submissions (
        id, laboratory_id, group_id, uploaded_by_student_id, r2_key,
        original_filename, mime_type, file_size, submitted_at, updated_at
      )
      SELECT ?1, l.id, lg.id, e.student_id, ?2, ?3, ?4, ?5, ?6, ?6
      FROM laboratories l
      INNER JOIN laboratory_groups lg ON lg.laboratory_id = l.id
      INNER JOIN laboratory_group_members lgm ON lgm.laboratory_group_id = lg.id
      INNER JOIN enrollments e
        ON e.class_id = l.class_id
        AND e.student_id = lgm.student_id
        AND e.status = 'ACTIVE'
      INNER JOIN classes c ON c.id = l.class_id AND c.status = 'ACTIVE'
      WHERE l.id = ?7
        AND lg.id = ?8
        AND e.student_id = ?9
        AND l.lab_type = 'group'
        AND ${LABORATORY_EFFECTIVE_LOCK_SQL}
      ON CONFLICT(laboratory_id, group_id) DO UPDATE SET
        uploaded_by_student_id = excluded.uploaded_by_student_id,
        r2_key = excluded.r2_key,
        original_filename = excluded.original_filename,
        mime_type = excluded.mime_type,
        file_size = excluded.file_size,
        updated_at = excluded.updated_at
    `
  ).bind(
    id, r2Key, originalFilename, mimeType, fileSize, timestamp,
    laboratoryId, groupId, uploadedByStudentId
  ).run();

  if (!result.success || result.meta.changes !== 1) return null;
  return getGroupSubmission(laboratoryId, groupId);
}

export async function deleteGroupSubmissionMetadata(
  laboratoryId: number,
  groupId: number
): Promise<boolean> {
  const { env } = getCloudflareContext();
  const result = await env.DB.prepare(
    `DELETE FROM laboratory_group_submissions
     WHERE laboratory_id = ?1 AND group_id = ?2`
  ).bind(laboratoryId, groupId).run();
  return result.success && result.meta.changes === 1;
}
