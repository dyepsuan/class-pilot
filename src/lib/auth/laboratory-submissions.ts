import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

import {
  getGroupSubmission,
  getLaboratoryGroupSubmissionSummaries,
  getLaboratoryGroupSubmissions,
  type LaboratoryGroupSubmission,
  type LaboratoryGroupSubmissionSummary,
} from "@/lib/db/laboratory-submissions";
import {
  LABORATORY_EFFECTIVE_LOCK_SQL,
  isLaboratoryGroupingEffectivelyLocked,
} from "@/lib/db/laboratory-grouping";

import { getInstructorManagedClass } from "./instructor-class";
import type { AuthUser } from "./session";
import type { AuthenticatedStudent } from "./student-session";

export type AuthorizedLaboratoryGroup = {
  classId: number;
  laboratoryId: number;
  groupId: number;
  groupName: string;
  dueDate: string | null;
  status: "open" | "completed";
};

export async function resolveStudentOfficialLaboratoryGroup(
  student: AuthenticatedStudent,
  classId: number,
  laboratoryId: number
): Promise<AuthorizedLaboratoryGroup | null> {
  if (!Number.isSafeInteger(classId) || classId <= 0 ||
      !Number.isSafeInteger(laboratoryId) || laboratoryId <= 0) return null;

  const { env } = getCloudflareContext();
  if (!(await isLaboratoryGroupingEffectivelyLocked(env.DB, laboratoryId))) {
    return null;
  }

  const row = await env.DB.prepare(
    `
      SELECT l.class_id, l.id AS laboratory_id, lg.id AS group_id,
        lg.name AS group_name, l.due_date, l.status
      FROM laboratories l
      INNER JOIN classes c ON c.id = l.class_id AND c.status = 'ACTIVE'
      INNER JOIN enrollments e
        ON e.class_id = l.class_id AND e.student_id = ?1 AND e.status = 'ACTIVE'
      INNER JOIN laboratory_groups lg ON lg.laboratory_id = l.id
      INNER JOIN laboratory_group_members lgm
        ON lgm.laboratory_group_id = lg.id AND lgm.student_id = e.student_id
      WHERE l.id = ?2 AND l.class_id = ?3 AND l.lab_type = 'group'
        AND ${LABORATORY_EFFECTIVE_LOCK_SQL}
      ORDER BY lg.id ASC
      LIMIT 1
    `
  ).bind(student.id, laboratoryId, classId).first<{
    class_id: number;
    laboratory_id: number;
    group_id: number;
    group_name: string;
    due_date: string | null;
    status: "open" | "completed";
  }>();

  return row ? {
    classId: Number(row.class_id),
    laboratoryId: Number(row.laboratory_id),
    groupId: Number(row.group_id),
    groupName: row.group_name,
    dueDate: row.due_date,
    status: row.status,
  } : null;
}

export async function getAuthorizedStudentGroupSubmission(
  student: AuthenticatedStudent,
  classId: number,
  laboratoryId: number
): Promise<LaboratoryGroupSubmission | null> {
  const group = await resolveStudentOfficialLaboratoryGroup(
    student, classId, laboratoryId
  );
  return group ? getGroupSubmission(group.laboratoryId, group.groupId) : null;
}

export async function getAuthorizedInstructorLaboratorySubmissions(
  instructor: AuthUser,
  classId: number,
  laboratoryId: number
): Promise<LaboratoryGroupSubmission[] | null> {
  const managedClass = await getInstructorManagedClass(classId, instructor);
  if (!managedClass) return null;

  const { env } = getCloudflareContext();
  const laboratory = await env.DB.prepare(
    `SELECT id FROM laboratories
     WHERE id = ?1 AND class_id = ?2 AND lab_type = 'group'
     LIMIT 1`
  ).bind(laboratoryId, managedClass.id).first<{ id: number }>();

  return laboratory ? getLaboratoryGroupSubmissions(laboratoryId) : null;
}

export async function getAuthorizedInstructorLaboratorySubmissionSummaries(
  instructor: AuthUser,
  classId: number,
  laboratoryId: number
): Promise<LaboratoryGroupSubmissionSummary[] | null> {
  const managedClass = await getInstructorManagedClass(classId, instructor);
  if (!managedClass) return null;

  const { env } = getCloudflareContext();
  const laboratory = await env.DB.prepare(
    `SELECT id FROM laboratories
     WHERE id = ?1 AND class_id = ?2 AND lab_type = 'group'
     LIMIT 1`
  ).bind(laboratoryId, managedClass.id).first<{ id: number }>();

  return laboratory
    ? getLaboratoryGroupSubmissionSummaries(laboratoryId)
    : null;
}
