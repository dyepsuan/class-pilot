import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

import type { AuthUser } from "./session";

export type InstructorManagedClass = {
  id: number;
  subject_code: string;
  subject_name: string;
  section: string;
  school_year: string;
  term: string;
};

export async function getInstructorManagedClass(
  classId: number,
  user: AuthUser
): Promise<InstructorManagedClass | null> {
  if (
    user.role !== "INSTRUCTOR" ||
    !Number.isInteger(classId) ||
    classId <= 0
  ) {
    return null;
  }

  const { env } = getCloudflareContext();

  return env.DB.prepare(
    `
      SELECT
        c.id,
        c.subject_code,
        c.subject_name,
        c.section,
        c.school_year,
        c.term
      FROM classes c
      INNER JOIN users owner ON owner.id = c.instructor_id
      WHERE c.id = ?1
        AND (
          c.instructor_id = ?2
          OR (
            owner.auth_id IS NULL
            AND 1 = (
              SELECT COUNT(*)
              FROM users authenticated_instructor
              WHERE authenticated_instructor.role = 'INSTRUCTOR'
                AND authenticated_instructor.auth_id IS NOT NULL
            )
          )
        )
      LIMIT 1
    `
  )
    .bind(classId, user.id)
    .first<InstructorManagedClass>();
}

export function instructorManagedClassCondition(instructorPlaceholder: string): string {
  return `(c.instructor_id = ${instructorPlaceholder}
    OR (owner.auth_id IS NULL AND 1 = (
      SELECT COUNT(*) FROM users authenticated_instructor
      WHERE authenticated_instructor.role = 'INSTRUCTOR'
        AND authenticated_instructor.auth_id IS NOT NULL)))`;
}

export async function listInstructorManagedClasses(user: AuthUser): Promise<InstructorManagedClass[]> {
  if (user.role !== "INSTRUCTOR") return [];
  const { env } = getCloudflareContext();
  const result = await env.DB.prepare(`
    SELECT c.id, c.subject_code, c.subject_name, c.section, c.school_year, c.term
    FROM classes c INNER JOIN users owner ON owner.id = c.instructor_id
    WHERE ${instructorManagedClassCondition("?1")}
    ORDER BY c.subject_code, c.section, c.id
  `).bind(user.id).all<InstructorManagedClass>();
  return result.results;
}
