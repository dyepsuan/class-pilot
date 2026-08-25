import { getCloudflareContext } from "@opennextjs/cloudflare";

export type ClassStudent = {
  enrollment_id: number;
  student_id: number;
  student_number: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
  email: string | null;
  enrollment_status: string;
  left_on: string | null;
};

export type EnrollmentView = "active" | "archived";

export async function getStudentsByClassId(
  classId: number,
  view: EnrollmentView = "active"
): Promise<ClassStudent[]> {
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
        e.left_on
      FROM enrollments e
      INNER JOIN students s
        ON s.id = e.student_id
      WHERE e.class_id = ?1
        AND (
          (?2 = 'active' AND e.status = 'ACTIVE')
          OR
          (?2 = 'archived' AND e.status <> 'ACTIVE')
        )
      ORDER BY
        s.last_name ASC,
        s.first_name ASC
    `
  )
    .bind(classId, view)
    .all<ClassStudent>();

  return result.results;
}
export type StudentEnrollmentDetail = {
  enrollment_id: number;
  student_id: number;
  student_number: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
  email: string | null;
  enrollment_status: string;
  left_on: string | null;
};

export async function getStudentEnrollmentByStudentId(
  classId: number,
  studentId: number
): Promise<StudentEnrollmentDetail | null> {
  const { env } = getCloudflareContext();

  return env.DB.prepare(
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
        e.left_on
      FROM enrollments e
      INNER JOIN students s
        ON s.id = e.student_id
      WHERE e.class_id = ?1
        AND s.id = ?2
      LIMIT 1
    `
  )
    .bind(
      classId,
      studentId
    )
    .first<StudentEnrollmentDetail>();
}
