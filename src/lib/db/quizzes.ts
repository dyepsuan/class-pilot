import { getCloudflareContext } from "@opennextjs/cloudflare";

export type QuizListItem = {
  id: number;
  class_id: number;
  sequence_no: number;
  title: string;
  description: string | null;
  max_score: number;
  date_given: string | null;

  scored_count: number;
  total_students: number;

  average_score: number | null;
  highest_score: number | null;
  lowest_score: number | null;
};

export type QuizDetail = {
  id: number;
  class_id: number;
  sequence_no: number;
  title: string;
  description: string | null;
  max_score: number;
  date_given: string | null;
};

export type QuizRosterItem = {
  enrollment_id: number;
  student_id: number;

  student_number: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
  enrollment_status: string;

  score: number | null;

  status:
    | "NOT_RECORDED"
    | "SCORED"
    | "ABSENT"
    | "EXCUSED";
};

export async function getQuizzes(
  classId: number
): Promise<QuizListItem[]> {
  const { env } =
    getCloudflareContext();

  const result =
    await env.DB.prepare(
      `
        SELECT
          a.id,
          a.class_id,
          a.sequence_no,
          a.title,
          a.description,
          a.max_score,
          a.date_given,

          (
            SELECT COUNT(*)

            FROM assessment_scores s

            WHERE s.assessment_id = a.id
              AND s.status = 'SCORED'
          ) AS scored_count,

          (
            SELECT COUNT(*)

            FROM enrollments e

            WHERE e.class_id = a.class_id
              AND e.status = 'ACTIVE'
          ) AS total_students,

          (
            SELECT AVG(score)

            FROM assessment_scores s

            WHERE s.assessment_id = a.id
              AND s.status = 'SCORED'
              AND s.score IS NOT NULL
          ) AS average_score,

          (
            SELECT MAX(score)

            FROM assessment_scores s

            WHERE s.assessment_id = a.id
              AND s.status = 'SCORED'
              AND s.score IS NOT NULL
          ) AS highest_score,

          (
            SELECT MIN(score)

            FROM assessment_scores s

            WHERE s.assessment_id = a.id
              AND s.status = 'SCORED'
              AND s.score IS NOT NULL
          ) AS lowest_score

        FROM assessments a

        WHERE a.class_id = ?1
          AND a.type = 'QUIZ'

        ORDER BY a.sequence_no DESC
      `
    )
      .bind(classId)
      .all<QuizListItem>();

  return result.results;
}

export async function getQuizById(
  classId: number,
  quizId: number
): Promise<QuizDetail | null> {
  const { env } =
    getCloudflareContext();

  return env.DB.prepare(
    `
      SELECT
        id,
        class_id,
        sequence_no,
        title,
        description,
        max_score,
        date_given

      FROM assessments

      WHERE id = ?1
        AND class_id = ?2
        AND type = 'QUIZ'

      LIMIT 1
    `
  )
    .bind(
      quizId,
      classId
    )
    .first<QuizDetail>();
}

export async function getQuizRoster(
  classId: number,
  quizId: number
): Promise<QuizRosterItem[]> {
  const { env } =
    getCloudflareContext();

  const result =
    await env.DB.prepare(
      `
        SELECT
          e.id AS enrollment_id,

          s.id AS student_id,
          s.student_number,
          s.first_name,
          s.middle_name,
          s.last_name,
          s.suffix,
          e.status AS enrollment_status,

          qs.score,

          COALESCE(
            qs.status,
            'NOT_RECORDED'
          ) AS status

        FROM enrollments e

        INNER JOIN students s
          ON s.id = e.student_id

        LEFT JOIN assessment_scores qs
          ON qs.enrollment_id = e.id
          AND qs.assessment_id = ?1

        WHERE e.class_id = ?2
          AND (
            e.status = 'ACTIVE'
            OR qs.enrollment_id IS NOT NULL
          )

        ORDER BY
          s.last_name ASC,
          s.first_name ASC
      `
    )
      .bind(
        quizId,
        classId
      )
      .all<QuizRosterItem>();

  return result.results;
}
