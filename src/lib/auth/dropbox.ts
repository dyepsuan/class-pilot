import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

import { getDropboxFileById, type DropboxFileMetadata } from "@/lib/db/dropbox";
import {
  isInstructorDropboxClassFileAccessAllowed,
  isInstructorDropboxAccessAllowed,
  isStudentDropboxAccessAllowed,
} from "@/lib/dropbox/authorization-rules";

import { getInstructorManagedClass } from "./instructor-class";
import type { AuthUser } from "./session";
import type { AuthenticatedStudent } from "./student-session";

type ActiveEnrollmentRow = { allowed: 1 };

export async function canStudentAccessDropboxClass(
  student: AuthenticatedStudent,
  classId: number
): Promise<boolean> {
  if (!Number.isSafeInteger(classId) || classId <= 0) {
    return false;
  }

  const { env } = getCloudflareContext();
  const enrollment = await env.DB.prepare(
    `
      SELECT 1 AS allowed
      FROM enrollments e
      INNER JOIN classes c ON c.id = e.class_id
      WHERE e.class_id = ?1
        AND e.student_id = ?2
        AND e.status = 'ACTIVE'
        AND c.status = 'ACTIVE'
      LIMIT 1
    `
  )
    .bind(classId, student.id)
    .first<ActiveEnrollmentRow>();

  return Boolean(enrollment);
}

export async function canStudentAccessDropboxFile(
  student: AuthenticatedStudent,
  file: Pick<DropboxFileMetadata, "classId" | "studentId">
): Promise<boolean> {
  if (student.id !== file.studentId) {
    return false;
  }

  return isStudentDropboxAccessAllowed({
    authenticatedStudentId: student.id,
    fileStudentId: file.studentId,
    hasActiveEnrollment: await canStudentAccessDropboxClass(
      student,
      file.classId
    ),
  });
}

export async function canInstructorAccessDropboxClass(
  instructor: AuthUser,
  classId: number
): Promise<boolean> {
  const managedClass = await getInstructorManagedClass(classId, instructor);

  return managedClass?.id === classId;
}

export async function canInstructorAccessDropboxFile(
  instructor: AuthUser,
  file: Pick<DropboxFileMetadata, "classId">
): Promise<boolean> {
  const managesFileClass = await canInstructorAccessDropboxClass(
    instructor,
    file.classId
  );

  return isInstructorDropboxAccessAllowed({
    fileClassId: file.classId,
    managedClassId: managesFileClass ? file.classId : null,
  });
}

export async function getAuthorizedDropboxFileForStudent(
  fileId: string,
  student: AuthenticatedStudent
): Promise<DropboxFileMetadata | null> {
  const file = await getDropboxFileById(fileId);

  if (!file || !(await canStudentAccessDropboxFile(student, file))) {
    return null;
  }

  return file;
}

export async function getAuthorizedDropboxFileForInstructor(
  fileId: string,
  instructor: AuthUser
): Promise<DropboxFileMetadata | null> {
  const file = await getDropboxFileById(fileId);

  if (!file || !(await canInstructorAccessDropboxFile(instructor, file))) {
    return null;
  }

  return file;
}

export async function getAuthorizedDropboxFileForInstructorClass(
  fileId: string,
  requestedClassId: number,
  instructor: AuthUser
): Promise<DropboxFileMetadata | null> {
  const managedClass = await getInstructorManagedClass(
    requestedClassId,
    instructor
  );

  if (!managedClass) {
    return null;
  }

  const file = await getDropboxFileById(fileId);

  if (
    !file ||
    !isInstructorDropboxClassFileAccessAllowed({
      managedClassId: managedClass.id,
      requestedClassId,
      fileClassId: file.classId,
    })
  ) {
    return null;
  }

  return file;
}
