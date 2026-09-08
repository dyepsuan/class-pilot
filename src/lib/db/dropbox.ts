import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

import {
  getDropboxFileCategoryExtensions,
  type DropboxFileCategory,
} from "@/lib/dropbox/file-categories";
import {
  buildInstructorDropboxWhereClause,
  INSTRUCTOR_DROPBOX_ENROLLMENT_STATUS_SELECT,
  INSTRUCTOR_DROPBOX_ORDER_BY,
} from "@/lib/dropbox/instructor-query";

export const INSTRUCTOR_DROPBOX_PAGE_SIZE = 50;

export type DropboxFileMetadata = {
  id: string;
  classId: number;
  studentId: number;
  storageKey: string;
  originalFilename: string;
  displayName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  updatedAt: string;
};

export type DropboxFileListItem = Omit<DropboxFileMetadata, "storageKey">;

export type InstructorDropboxSummary = {
  totalFiles: number;
  studentsWithFiles: number;
  storageUsed: number;
};

export type InstructorDropboxStudentOption = {
  studentId: number;
  studentNumber: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  enrollmentStatus: string;
};

export type InstructorDropboxFileListItem = DropboxFileListItem & {
  studentNumber: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  enrollmentStatus: string | null;
};

export type InstructorDropboxListing = {
  files: InstructorDropboxFileListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type InstructorDropboxFilters = {
  search?: string | null;
  studentId?: number | null;
  fileType?: DropboxFileCategory | null;
  page?: number;
};

type DropboxFileRow = {
  id: string;
  class_id: number;
  student_id: number;
  storage_key: string;
  original_filename: string;
  display_name: string;
  mime_type: string;
  file_size: number;
  created_at: string;
  updated_at: string;
};

type DropboxFileListRow = Omit<DropboxFileRow, "storage_key">;

type InstructorDropboxFileRow = DropboxFileListRow & {
  student_number: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
  enrollment_status: string | null;
};

type InstructorDropboxStudentRow = {
  student_id: number;
  student_number: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
  enrollment_status: string;
};

function toDropboxFileMetadata(row: DropboxFileRow): DropboxFileMetadata {
  return {
    id: row.id,
    classId: row.class_id,
    studentId: row.student_id,
    storageKey: row.storage_key,
    originalFilename: row.original_filename,
    displayName: row.display_name,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toDropboxFileListItem(row: DropboxFileListRow): DropboxFileListItem {
  return {
    id: row.id,
    classId: row.class_id,
    studentId: row.student_id,
    originalFilename: row.original_filename,
    displayName: row.display_name,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toInstructorDropboxFileListItem(
  row: InstructorDropboxFileRow
): InstructorDropboxFileListItem {
  return {
    ...toDropboxFileListItem(row),
    studentNumber: row.student_number,
    firstName: row.first_name,
    middleName: row.middle_name,
    lastName: row.last_name,
    suffix: row.suffix,
    enrollmentStatus: row.enrollment_status,
  };
}

const LIST_FIELDS = `
  id,
  class_id,
  student_id,
  original_filename,
  display_name,
  mime_type,
  file_size,
  created_at,
  updated_at
`;

export async function createDropboxFileMetadata({
  id,
  classId,
  studentId,
  storageKey,
  originalFilename,
  displayName,
  mimeType,
  fileSize,
  createdAt,
}: {
  id: string;
  classId: number;
  studentId: number;
  storageKey: string;
  originalFilename: string;
  displayName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
}): Promise<DropboxFileMetadata | null> {
  const { env } = getCloudflareContext();
  const result = await env.DB.prepare(
    `
      INSERT INTO dropbox_files (
        id,
        class_id,
        student_id,
        storage_key,
        original_filename,
        display_name,
        mime_type,
        file_size,
        created_at,
        updated_at
      )
      SELECT ?1, e.class_id, e.student_id, ?2, ?3, ?4, ?5, ?6, ?7, ?7
      FROM enrollments e
      INNER JOIN classes c ON c.id = e.class_id
      WHERE e.class_id = ?8
        AND e.student_id = ?9
        AND e.status = 'ACTIVE'
        AND c.status = 'ACTIVE'
    `
  )
    .bind(
      id,
      storageKey,
      originalFilename,
      displayName,
      mimeType,
      fileSize,
      createdAt,
      classId,
      studentId
    )
    .run();

  if (!result.success || result.meta.changes !== 1) {
    return null;
  }

  return {
    id,
    classId,
    studentId,
    storageKey,
    originalFilename,
    displayName,
    mimeType,
    fileSize,
    createdAt,
    updatedAt: createdAt,
  };
}

export async function getDropboxFileById(
  fileId: string
): Promise<DropboxFileMetadata | null> {
  const { env } = getCloudflareContext();
  const row = await env.DB.prepare(
    `
      SELECT
        id,
        class_id,
        student_id,
        storage_key,
        original_filename,
        display_name,
        mime_type,
        file_size,
        created_at,
        updated_at
      FROM dropbox_files
      WHERE id = ?1
      LIMIT 1
    `
  )
    .bind(fileId)
    .first<DropboxFileRow>();

  return row ? toDropboxFileMetadata(row) : null;
}

export async function listDropboxFilesForStudent(
  classId: number,
  studentId: number
): Promise<DropboxFileListItem[]> {
  const { env } = getCloudflareContext();
  const result = await env.DB.prepare(
    `
      SELECT ${LIST_FIELDS}
      FROM dropbox_files
      WHERE class_id = ?1 AND student_id = ?2
      ORDER BY created_at DESC, id DESC
    `
  )
    .bind(classId, studentId)
    .all<DropboxFileListRow>();

  return result.results.map(toDropboxFileListItem);
}

export async function listDropboxFilesForClass(
  classId: number
): Promise<DropboxFileListItem[]> {
  const { env } = getCloudflareContext();
  const result = await env.DB.prepare(
    `
      SELECT ${LIST_FIELDS}
      FROM dropbox_files
      WHERE class_id = ?1
      ORDER BY created_at DESC, id DESC
    `
  )
    .bind(classId)
    .all<DropboxFileListRow>();

  return result.results.map(toDropboxFileListItem);
}

export async function getInstructorDropboxSummary(
  classId: number
): Promise<InstructorDropboxSummary> {
  const { env } = getCloudflareContext();
  const row = await env.DB.prepare(
    `
      SELECT
        COUNT(*) AS total_files,
        COUNT(DISTINCT student_id) AS students_with_files,
        COALESCE(SUM(file_size), 0) AS storage_used
      FROM dropbox_files
      WHERE class_id = ?1
    `
  )
    .bind(classId)
    .first<{
      total_files: number;
      students_with_files: number;
      storage_used: number;
    }>();

  return {
    totalFiles: Number(row?.total_files ?? 0),
    studentsWithFiles: Number(row?.students_with_files ?? 0),
    storageUsed: Number(row?.storage_used ?? 0),
  };
}

export async function listInstructorDropboxStudentOptions(
  classId: number
): Promise<InstructorDropboxStudentOption[]> {
  const { env } = getCloudflareContext();
  const result = await env.DB.prepare(
    `
      SELECT
        s.id AS student_id,
        s.student_number,
        s.first_name,
        s.middle_name,
        s.last_name,
        s.suffix,
        e.status AS enrollment_status
      FROM enrollments e
      INNER JOIN students s ON s.id = e.student_id
      WHERE e.class_id = ?1
        AND e.id = (
          SELECT e2.id
          FROM enrollments e2
          WHERE e2.class_id = e.class_id
            AND e2.student_id = e.student_id
          ORDER BY
            CASE WHEN e2.status = 'ACTIVE' THEN 0 ELSE 1 END,
            datetime(e2.updated_at) DESC,
            e2.id DESC
          LIMIT 1
        )
      ORDER BY
        CASE WHEN e.status = 'ACTIVE' THEN 0 ELSE 1 END,
        s.last_name ASC,
        s.first_name ASC,
        s.student_number ASC
    `
  )
    .bind(classId)
    .all<InstructorDropboxStudentRow>();

  return result.results.map((row) => ({
    studentId: row.student_id,
    studentNumber: row.student_number,
    firstName: row.first_name,
    middleName: row.middle_name,
    lastName: row.last_name,
    suffix: row.suffix,
    enrollmentStatus: row.enrollment_status,
  }));
}

export async function listDropboxFilesForInstructorClass(
  classId: number,
  filters: InstructorDropboxFilters = {}
): Promise<InstructorDropboxListing> {
  const { env } = getCloudflareContext();
  const normalizedSearch = filters.search?.trim().slice(0, 100) || null;
  const normalizedStudentId =
    filters.studentId &&
    Number.isSafeInteger(filters.studentId) &&
    filters.studentId > 0
      ? filters.studentId
      : null;
  const requestedPage =
    filters.page && Number.isSafeInteger(filters.page) && filters.page > 0
      ? filters.page
      : 1;
  const extensions = getDropboxFileCategoryExtensions(
    filters.fileType ?? null
  );
  const where = buildInstructorDropboxWhereClause({
    classId,
    search: normalizedSearch,
    studentId: normalizedStudentId,
    extensions,
  });
  const count = await env.DB.prepare(
    `
      SELECT COUNT(*) AS total_count
      FROM dropbox_files df
      INNER JOIN students s ON s.id = df.student_id
      WHERE ${where.sql}
    `
  )
    .bind(...where.bindings)
    .first<{ total_count: number }>();
  const totalCount = Number(count?.total_count ?? 0);
  const totalPages = Math.max(
    1,
    Math.ceil(totalCount / INSTRUCTOR_DROPBOX_PAGE_SIZE)
  );
  const page = Math.min(requestedPage, totalPages);
  const offset = (page - 1) * INSTRUCTOR_DROPBOX_PAGE_SIZE;
  const limitPlaceholder = `?${where.bindings.length + 1}`;
  const offsetPlaceholder = `?${where.bindings.length + 2}`;
  const result = await env.DB.prepare(
    `
      SELECT
        df.id,
        df.class_id,
        df.student_id,
        df.original_filename,
        df.display_name,
        df.mime_type,
        df.file_size,
        df.created_at,
        df.updated_at,
        s.student_number,
        s.first_name,
        s.middle_name,
        s.last_name,
        s.suffix,
        ${INSTRUCTOR_DROPBOX_ENROLLMENT_STATUS_SELECT} AS enrollment_status
      FROM dropbox_files df
      INNER JOIN students s ON s.id = df.student_id
      WHERE ${where.sql}
      ORDER BY ${INSTRUCTOR_DROPBOX_ORDER_BY}
      LIMIT ${limitPlaceholder}
      OFFSET ${offsetPlaceholder}
    `
  )
    .bind(...where.bindings, INSTRUCTOR_DROPBOX_PAGE_SIZE, offset)
    .all<InstructorDropboxFileRow>();

  return {
    files: result.results.map(toInstructorDropboxFileListItem),
    totalCount,
    page,
    pageSize: INSTRUCTOR_DROPBOX_PAGE_SIZE,
    totalPages,
  };
}

export async function deleteDropboxFileMetadata(
  fileId: string
): Promise<boolean> {
  const { env } = getCloudflareContext();
  const result = await env.DB.prepare(
    "DELETE FROM dropbox_files WHERE id = ?1"
  )
    .bind(fileId)
    .run();

  return result.success;
}

export async function updateDropboxDisplayName(
  fileId: string,
  displayName: string
): Promise<boolean> {
  const { env } = getCloudflareContext();
  const result = await env.DB.prepare(
    `
      UPDATE dropbox_files
      SET display_name = ?1, updated_at = ?2
      WHERE id = ?3
    `
  )
    .bind(displayName, new Date().toISOString(), fileId)
    .run();

  return result.success && result.meta.changes === 1;
}
