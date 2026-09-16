import "server-only";
import type { AuthUser } from "@/lib/auth/session";
import { instructorManagedClassCondition } from "@/lib/auth/instructor-class";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isClassFileId, isClassFileStorageKey } from "@/lib/class-files/storage-key";

export type ClassFileMetadata = {
  id: string;
  classId: number;
  title: string;
  description: string | null;
  originalFilename: string;
  storageKey: string;
  mimeType: string;
  fileSize: number;
  uploadedBy: number;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type ClassFileListItem = Omit<ClassFileMetadata, "storageKey">;

type ClassFileRow = {
  id: string;
  class_id: number;
  title: string;
  description: string | null;
  original_filename: string;
  storage_key: string;
  mime_type: string;
  file_size: number;
  uploaded_by: number;
  version: number;
  created_at: string;
  updated_at: string;
};

// Internal metadata primitives, like db/dropbox.ts. Future routes must derive
// uploadedBy from the session and authorize through getInstructorManagedClass
// (including its existing legacy-class ownership rule), or active enrollment.
export async function createClassFileMetadata(input: Omit<ClassFileMetadata,
  "version" | "createdAt" | "updatedAt"
>): Promise<ClassFileMetadata | null> {
  if (!isClassFileId(input.id) || !isClassFileStorageKey(input.storageKey) ||
      !input.storageKey.startsWith(`class-files/${input.classId}/${input.id}/`)) {
    throw new TypeError("Invalid Class File identifiers or storage key.");
  }
  const { env } = getCloudflareContext();
  const now = new Date().toISOString();
  const result = await env.DB.prepare(`
    INSERT INTO class_files (id, class_id, title, description, original_filename,
      storage_key, mime_type, file_size, uploaded_by, created_at, updated_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)
  `).bind(input.id, input.classId, input.title.trim(), input.description?.trim() || null,
    input.originalFilename, input.storageKey, input.mimeType, input.fileSize,
    input.uploadedBy, now).run();
  if (!result.success || result.meta.changes !== 1) return null;
  return { ...input, title: input.title.trim(), description: input.description?.trim() || null,
    version: 1, createdAt: now, updatedAt: now };
}

export async function getClassFileById(id: string): Promise<ClassFileMetadata | null> {
  if (!isClassFileId(id)) return null;
  const { env } = getCloudflareContext();
  const row = await env.DB.prepare("SELECT * FROM class_files WHERE id = ?1 LIMIT 1")
    .bind(id).first<ClassFileRow>();
  if (!row) return null;
  return {
    id: row.id, classId: row.class_id, title: row.title, description: row.description,
    originalFilename: row.original_filename, storageKey: row.storage_key,
    mimeType: row.mime_type, fileSize: row.file_size, uploadedBy: row.uploaded_by,
    version: row.version, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export async function listClassFilesForInstructorClass(classId: number): Promise<ClassFileListItem[]> {
  const { env } = getCloudflareContext();
  const rows = await env.DB.prepare(`SELECT id, class_id AS classId, title, description,
    original_filename AS originalFilename, mime_type AS mimeType, file_size AS fileSize,
    uploaded_by AS uploadedBy, version, created_at AS createdAt, updated_at AS updatedAt
    FROM class_files WHERE class_id = ?1 ORDER BY created_at DESC, id DESC`)
    .bind(classId).all<ClassFileListItem>();
  return rows.results;
}

export type NewClassFileMetadata = Omit<ClassFileMetadata, "version" | "createdAt" | "updatedAt">;

export async function createClassFileMetadataBatch(files: NewClassFileMetadata[]): Promise<void> {
  const { env } = getCloudflareContext();
  const now = new Date().toISOString();
  const statements = files.map((file) => {
    if (!isClassFileId(file.id) || !isClassFileStorageKey(file.storageKey) ||
        !file.storageKey.startsWith(`class-files/${file.classId}/${file.id}/`)) {
      throw new TypeError("Invalid Class File storage key.");
    }
    return env.DB.prepare(`INSERT INTO class_files
      (id, class_id, title, description, original_filename, storage_key, mime_type,
       file_size, uploaded_by, created_at, updated_at)
      SELECT ?1, c.id, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10
      FROM classes c INNER JOIN users owner ON owner.id = c.instructor_id
      WHERE c.id = ?2 AND ${instructorManagedClassCondition("?9")}`)
      .bind(file.id, file.classId, file.title, file.description, file.originalFilename,
        file.storageKey, file.mimeType, file.fileSize, file.uploadedBy, now);
  });
  const results = await env.DB.batch(statements);
  if (results.some((result) => !result.success || result.meta.changes !== 1)) {
    throw new Error("Class File metadata batch could not be completed.");
  }
}

export async function removeClassFileUploadMetadata(ids: string[]): Promise<void> {
  const { env } = getCloudflareContext();
  const results = await env.DB.batch(ids.map((id) =>
    env.DB.prepare("DELETE FROM class_files WHERE id = ?1").bind(id)));
  if (results.some((result) => !result.success)) throw new Error("Upload rollback failed.");
}

function managedFileCondition(placeholder: string): string {
  return `EXISTS (SELECT 1 FROM classes c
    INNER JOIN users owner ON owner.id = c.instructor_id
    WHERE c.id = class_files.class_id AND ${instructorManagedClassCondition(placeholder)})`;
}

export async function updateClassFileMetadata(file: ClassFileMetadata, instructorId: number,
  metadata: { title: string; description: string | null }): Promise<boolean> {
  const { env } = getCloudflareContext();
  const result = await env.DB.prepare(`UPDATE class_files
    SET title = ?1, description = ?2, updated_at = ?3
    WHERE id = ?4 AND class_id = ?5 AND ${managedFileCondition("?6")}`)
    .bind(metadata.title, metadata.description, new Date().toISOString(),
      file.id, file.classId, instructorId).run();
  return result.success && result.meta.changes === 1;
}

export async function replaceClassFileMetadata(file: ClassFileMetadata, instructorId: number,
  replacement: { originalFilename: string; storageKey: string; mimeType: string; fileSize: number }): Promise<boolean> {
  if (!isClassFileStorageKey(replacement.storageKey) ||
      !replacement.storageKey.startsWith(`class-files/${file.classId}/${file.id}/`)) {
    throw new TypeError("Invalid replacement storage key.");
  }
  const { env } = getCloudflareContext();
  const result = await env.DB.prepare(`UPDATE class_files SET
    original_filename = ?1, storage_key = ?2, mime_type = ?3, file_size = ?4,
    version = version + 1, updated_at = ?5
    WHERE id = ?6 AND class_id = ?7 AND version = ?8 AND storage_key = ?9
      AND ${managedFileCondition("?10")}`)
    .bind(replacement.originalFilename, replacement.storageKey, replacement.mimeType,
      replacement.fileSize, new Date().toISOString(), file.id, file.classId,
      file.version, file.storageKey, instructorId).run();
  return result.success && result.meta.changes === 1;
}

export async function deleteClassFileMetadata(file: ClassFileMetadata, instructorId: number): Promise<boolean> {
  const { env } = getCloudflareContext();
  const result = await env.DB.prepare(`DELETE FROM class_files
    WHERE id = ?1 AND class_id = ?2 AND version = ?3 AND storage_key = ?4
      AND ${managedFileCondition("?5")}`)
    .bind(file.id, file.classId, file.version, file.storageKey, instructorId).run();
  return result.success && result.meta.changes >= 1;
}


export type StudentClassFileListItem = Pick<ClassFileMetadata,
  "id" | "classId" | "title" | "description" | "originalFilename" | "mimeType" | "fileSize" | "createdAt"> & { isViewed: number };

function studentCurrentVersionViewedCondition(): string {
  return `EXISTS (SELECT 1 FROM class_file_views v WHERE v.class_file_id = f.id
    AND v.student_id = ?2 AND v.version = f.version)`;
}

function activeStudentClassFileScopeCondition(): string {
  return `f.class_id = ?1 AND c.status = 'ACTIVE'
    AND EXISTS (SELECT 1 FROM enrollments e WHERE e.class_id = f.class_id
      AND e.student_id = ?2 AND e.status = 'ACTIVE')`;
}

// Identity comes from requireStudent and class scope from the existing portal context.
// Listing and dashboard count share both access and current-version read predicates.
export async function listClassFilesForActiveStudentClass(selectedClassId: number,
  authenticatedStudentId: number): Promise<StudentClassFileListItem[]> {
  const { env } = getCloudflareContext();
  const rows = await env.DB.prepare(`SELECT f.id, f.class_id AS classId, f.title, f.description,
    f.original_filename AS originalFilename, f.mime_type AS mimeType,
    f.file_size AS fileSize, f.created_at AS createdAt,
    ${studentCurrentVersionViewedCondition()} AS isViewed
    FROM class_files f INNER JOIN classes c ON c.id = f.class_id
    WHERE ${activeStudentClassFileScopeCondition()}
    ORDER BY f.created_at DESC, f.id DESC`)
    .bind(selectedClassId, authenticatedStudentId).all<StudentClassFileListItem>();
  return rows.results;
}

export async function countUnreadClassFilesForActiveStudentClass(selectedClassId: number,
  authenticatedStudentId: number): Promise<number> {
  const { env } = getCloudflareContext();
  const row = await env.DB.prepare(`SELECT COUNT(*) AS unreadCount
    FROM class_files f INNER JOIN classes c ON c.id = f.class_id
    WHERE ${activeStudentClassFileScopeCondition()}
      AND NOT ${studentCurrentVersionViewedCondition()}`)
    .bind(selectedClassId, authenticatedStudentId).first<{ unreadCount: number }>();
  return row?.unreadCount ?? 0;
}

// Use the authorized snapshot, never a browser-supplied version. The SQL rechecks
// enrollment and the snapshot key/version so a concurrent replacement cannot be
// marked viewed when the response actually contains the previous object.
export async function markClassFileVersionViewed(file: ClassFileMetadata,
  authenticatedStudentId: number): Promise<boolean> {
  const { env } = getCloudflareContext();
  const result = await env.DB.prepare(`INSERT INTO class_file_views
    (class_file_id, student_id, version, first_viewed_at, last_viewed_at)
    SELECT f.id, ?2, f.version, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    FROM class_files f INNER JOIN classes c ON c.id = f.class_id
    WHERE f.id = ?1 AND f.version = ?3 AND f.storage_key = ?4 AND c.status = 'ACTIVE'
      AND EXISTS (SELECT 1 FROM enrollments e WHERE e.class_id = f.class_id
        AND e.student_id = ?2 AND e.status = 'ACTIVE')
    ON CONFLICT(class_file_id, student_id, version) DO UPDATE
      SET last_viewed_at = MAX(class_file_views.last_viewed_at, excluded.last_viewed_at)`)
    .bind(file.id, authenticatedStudentId, file.version, file.storageKey).run();
  if (!result.success) throw new Error("Could not record Class File access.");
  return result.meta.changes === 1;
}

export type InstructorClassFileListItem = ClassFileListItem & {
  viewedCount: number;
  activeStudentCount: number;
};

export async function listClassFilesWithViewStatsForInstructorClass(classId: number,
  instructor: AuthUser): Promise<InstructorClassFileListItem[]> {
  if (instructor.role !== "INSTRUCTOR") return [];
  const { env } = getCloudflareContext();
  const rows = await env.DB.prepare(`SELECT class_files.id, class_files.class_id AS classId,
    title, description, original_filename AS originalFilename, mime_type AS mimeType,
    file_size AS fileSize, uploaded_by AS uploadedBy, class_files.version,
    class_files.created_at AS createdAt, class_files.updated_at AS updatedAt,
    COUNT(DISTINCT e.student_id) AS activeStudentCount,
    COUNT(DISTINCT v.student_id) AS viewedCount
    FROM class_files LEFT JOIN enrollments e
      ON e.class_id = class_files.class_id AND e.status = 'ACTIVE'
    LEFT JOIN class_file_views v ON v.class_file_id = class_files.id
      AND v.student_id = e.student_id AND v.version = class_files.version
    WHERE class_files.class_id = ?1 AND ${managedFileCondition("?2")}
    GROUP BY class_files.id ORDER BY class_files.created_at DESC, class_files.id DESC`)
    .bind(classId, instructor.id).all<InstructorClassFileListItem>();
  return rows.results;
}

export type ClassFileStudentViewDetail = {
  studentId: number;
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  isViewed: number;
  lastViewedAt: string | null;
};

export async function listClassFileStudentViewDetails(fileId: string, classId: number,
  instructor: AuthUser): Promise<ClassFileStudentViewDetail[]> {
  if (instructor.role !== "INSTRUCTOR" || !isClassFileId(fileId)) return [];
  const { env } = getCloudflareContext();
  const rows = await env.DB.prepare(`SELECT s.id AS studentId, s.first_name AS firstName,
    s.middle_name AS middleName, s.last_name AS lastName, s.suffix,
    (v.student_id IS NOT NULL) AS isViewed, v.last_viewed_at AS lastViewedAt
    FROM class_files INNER JOIN enrollments e
      ON e.class_id = class_files.class_id AND e.status = 'ACTIVE'
    INNER JOIN students s ON s.id = e.student_id
    LEFT JOIN class_file_views v ON v.class_file_id = class_files.id
      AND v.student_id = s.id AND v.version = class_files.version
    WHERE class_files.id = ?1 AND class_files.class_id = ?2 AND ${managedFileCondition("?3")}
    ORDER BY s.last_name COLLATE NOCASE, s.first_name COLLATE NOCASE,
      s.middle_name COLLATE NOCASE, s.id`)
    .bind(fileId, classId, instructor.id).all<ClassFileStudentViewDetail>();
  return rows.results;
}
