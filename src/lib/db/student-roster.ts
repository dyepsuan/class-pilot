import { getCloudflareContext } from "@opennextjs/cloudflare";

import type { ClassStudent, EnrollmentView } from "./students";

export type StudentRosterItem = ClassStudent & {
  hasStudentPortalAccount: boolean;
};

type StudentRosterRow = ClassStudent & {
  has_student_portal_account: number;
};

export async function getStudentRosterByClassId(
  classId: number,
  view: EnrollmentView = "active"
): Promise<StudentRosterItem[]> {
  const { env } = getCloudflareContext();
  const result = await env.DB.prepare(
    `
      SELECT
        e.id AS enrollment_id,
        s.id AS student_id,
        s.student_number,
        s.first_name,
        s.middle_name,
        s.last_name,
        s.suffix,
        s.email,
        e.status AS enrollment_status,
        e.left_on,
        CASE WHEN sa.student_id IS NULL THEN 0 ELSE 1 END
          AS has_student_portal_account
      FROM enrollments e
      INNER JOIN students s ON s.id = e.student_id
      LEFT JOIN student_accounts sa ON sa.student_id = s.id
      WHERE e.class_id = ?1
        AND (
          (?2 = 'active' AND e.status = 'ACTIVE')
          OR
          (?2 = 'archived' AND e.status <> 'ACTIVE')
        )
      ORDER BY s.last_name ASC, s.first_name ASC
    `
  )
    .bind(classId, view)
    .all<StudentRosterRow>();

  return result.results.map((student) => ({
    enrollment_id: student.enrollment_id,
    student_id: student.student_id,
    student_number: student.student_number,
    first_name: student.first_name,
    middle_name: student.middle_name,
    last_name: student.last_name,
    suffix: student.suffix,
    email: student.email,
    enrollment_status: student.enrollment_status,
    left_on: student.left_on,
    hasStudentPortalAccount: student.has_student_portal_account === 1,
  }));
}
