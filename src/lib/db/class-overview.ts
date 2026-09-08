import { getCloudflareContext } from "@opennextjs/cloudflare";

export type ClassOverviewSummary = {
  student_count: number;
  attendance_count: number;
  finalized_attendance_count: number;
  open_attendance_count: number;
  quiz_count: number;
  scored_quiz_count: number;
  laboratory_count: number;
  completed_laboratory_count: number;
  individual_laboratory_count: number;
  group_laboratory_count: number;
};

export type OverviewAttendanceSession = {
  id: number;
  session_date: string;
  meeting_no: number;
  topic: string | null;
  started_at: string | null;
  ended_at: string | null;
  status: "OPEN" | "CLOSED";
  recorded_count: number;
  present_count: number;
  late_count: number;
  absent_count: number;
  excused_count: number;
};

export type OverviewAssessment = {
  id: number;
  kind: "QUIZ" | "LABORATORY";
  sequence_no: number;
  title: string;
  subtype: "individual" | "group" | null;
  status: "open" | "completed" | null;
  display_date: string | null;
  occurred_at: string;
  scored_count: number;
};

export type OverviewActivity = {
  key: string;
  kind: "ATTENDANCE" | "QUIZ" | "LABORATORY" | "DROPBOX";
  detail: string;
  occurred_at: string;
};

export type ClassOverviewData = {
  summary: ClassOverviewSummary;
  recentAttendance: OverviewAttendanceSession[];
  recentAssessments: OverviewAssessment[];
  recentActivity: OverviewActivity[];
};

const emptySummary: ClassOverviewSummary = {
  student_count: 0,
  attendance_count: 0,
  finalized_attendance_count: 0,
  open_attendance_count: 0,
  quiz_count: 0,
  scored_quiz_count: 0,
  laboratory_count: 0,
  completed_laboratory_count: 0,
  individual_laboratory_count: 0,
  group_laboratory_count: 0,
};

export async function getClassOverviewData(
  classId: number
): Promise<ClassOverviewData> {
  const { env } = getCloudflareContext();

  const [
    summary,
    attendanceResult,
    assessmentResult,
    activityResult,
  ] = await Promise.all([
    env.DB.prepare(
      `
        SELECT
          (
            SELECT COUNT(*)
            FROM enrollments e
            WHERE e.class_id = ?1
              AND e.status = 'ACTIVE'
          ) AS student_count,
          (
            SELECT COUNT(*)
            FROM attendance_sessions a
            WHERE a.class_id = ?1
          ) AS attendance_count,
          (
            SELECT COUNT(*)
            FROM attendance_sessions a
            WHERE a.class_id = ?1
              AND a.status = 'CLOSED'
          ) AS finalized_attendance_count,
          (
            SELECT COUNT(*)
            FROM attendance_sessions a
            WHERE a.class_id = ?1
              AND a.status = 'OPEN'
          ) AS open_attendance_count,
          (
            SELECT COUNT(*)
            FROM assessments a
            WHERE a.class_id = ?1
              AND a.type = 'QUIZ'
          ) AS quiz_count,
          (
            SELECT COUNT(*)
            FROM assessments a
            WHERE a.class_id = ?1
              AND a.type = 'QUIZ'
              AND EXISTS (
                SELECT 1
                FROM assessment_scores s
                WHERE s.assessment_id = a.id
                  AND s.status = 'SCORED'
              )
          ) AS scored_quiz_count,
          (
            SELECT COUNT(*)
            FROM laboratories l
            WHERE l.class_id = ?1
          ) AS laboratory_count,
          (
            SELECT COUNT(*)
            FROM laboratories l
            WHERE l.class_id = ?1
              AND l.status = 'completed'
          ) AS completed_laboratory_count,
          (
            SELECT COUNT(*)
            FROM laboratories l
            WHERE l.class_id = ?1
              AND l.lab_type = 'individual'
          ) AS individual_laboratory_count,
          (
            SELECT COUNT(*)
            FROM laboratories l
            WHERE l.class_id = ?1
              AND l.lab_type = 'group'
          ) AS group_laboratory_count
      `
    )
      .bind(classId)
      .first<ClassOverviewSummary>(),

    env.DB.prepare(
      `
        SELECT
          a.id,
          a.session_date,
          a.meeting_no,
          a.topic,
          a.started_at,
          a.ended_at,
          a.status,
          (
            SELECT COUNT(*)
            FROM attendance_records ar
            WHERE ar.attendance_session_id = a.id
          ) AS recorded_count,
          (
            SELECT COUNT(*)
            FROM attendance_records ar
            WHERE ar.attendance_session_id = a.id
              AND ar.status = 'PRESENT'
          ) AS present_count,
          (
            SELECT COUNT(*)
            FROM attendance_records ar
            WHERE ar.attendance_session_id = a.id
              AND ar.status = 'LATE'
          ) AS late_count,
          (
            SELECT COUNT(*)
            FROM attendance_records ar
            WHERE ar.attendance_session_id = a.id
              AND ar.status = 'ABSENT'
          ) AS absent_count,
          (
            SELECT COUNT(*)
            FROM attendance_records ar
            WHERE ar.attendance_session_id = a.id
              AND ar.status = 'EXCUSED'
          ) AS excused_count
        FROM attendance_sessions a
        WHERE a.class_id = ?1
        ORDER BY
          a.session_date DESC,
          a.meeting_no DESC
        LIMIT 4
      `
    )
      .bind(classId)
      .all<OverviewAttendanceSession>(),

    env.DB.prepare(
      `
        SELECT *
        FROM (
          SELECT
            a.id,
            'QUIZ' AS kind,
            a.sequence_no,
            a.title,
            NULL AS subtype,
            NULL AS status,
            a.date_given AS display_date,
            COALESCE(
              MAX(CASE WHEN s.status = 'SCORED' THEN s.updated_at END),
              a.updated_at,
              a.created_at
            ) AS occurred_at,
            SUM(CASE WHEN s.status = 'SCORED' THEN 1 ELSE 0 END)
              AS scored_count
          FROM assessments a
          LEFT JOIN assessment_scores s
            ON s.assessment_id = a.id
          WHERE a.class_id = ?1
            AND a.type = 'QUIZ'
          GROUP BY
            a.id,
            a.sequence_no,
            a.title,
            a.date_given,
            a.updated_at,
            a.created_at

          UNION ALL

          SELECT
            l.id,
            'LABORATORY' AS kind,
            l.lab_no AS sequence_no,
            l.title,
            l.lab_type AS subtype,
            l.status,
            COALESCE(l.due_date, l.start_date) AS display_date,
            COALESCE(l.updated_at, l.created_at) AS occurred_at,
            (
              SELECT COUNT(*)
              FROM laboratory_scores ls
              WHERE ls.laboratory_id = l.id
                AND ls.individual_score IS NOT NULL
            ) AS scored_count
          FROM laboratories l
          WHERE l.class_id = ?1
        ) recent
        ORDER BY
          datetime(occurred_at) DESC,
          sequence_no DESC
        LIMIT 6
      `
    )
      .bind(classId)
      .all<OverviewAssessment>(),

    env.DB.prepare(
      `
        SELECT *
        FROM (
          SELECT
            'attendance-' || a.id AS key,
            'ATTENDANCE' AS kind,
            CASE
              WHEN a.status = 'CLOSED'
                THEN 'Attendance completed for Meeting ' || a.meeting_no
              ELSE 'Attendance started for Meeting ' || a.meeting_no
            END AS detail,
            CASE
              WHEN a.status = 'CLOSED' THEN a.ended_at
              ELSE a.started_at
            END AS occurred_at
          FROM attendance_sessions a
          WHERE a.class_id = ?1
            AND (
              (a.status = 'CLOSED' AND a.ended_at IS NOT NULL)
              OR (a.status = 'OPEN' AND a.started_at IS NOT NULL)
            )

          UNION ALL

          SELECT
            'quiz-' || a.id AS key,
            'QUIZ' AS kind,
            'Quiz ' || a.sequence_no || ' scores recorded' AS detail,
            MAX(s.updated_at) AS occurred_at
          FROM assessments a
          INNER JOIN assessment_scores s
            ON s.assessment_id = a.id
            AND s.status = 'SCORED'
          WHERE a.class_id = ?1
            AND a.type = 'QUIZ'
          GROUP BY a.id, a.sequence_no

          UNION ALL

          SELECT
            'laboratory-' || l.id AS key,
            'LABORATORY' AS kind,
            CASE
              WHEN l.status = 'completed'
                THEN 'Laboratory ' || l.lab_no || ' completed'
              ELSE 'Laboratory ' || l.lab_no || ' created'
            END AS detail,
            CASE
              WHEN l.status = 'completed' THEN l.updated_at
              ELSE l.created_at
            END AS occurred_at
          FROM laboratories l
          WHERE l.class_id = ?1

          UNION ALL

          SELECT
            'dropbox-' || df.id AS key,
            'DROPBOX' AS kind,
            trim(s.first_name || ' ' || s.last_name)
              || ' uploaded ' || char(34) || df.display_name || char(34)
              AS detail,
            df.created_at AS occurred_at
          FROM dropbox_files df
          INNER JOIN students s ON s.id = df.student_id
          WHERE df.class_id = ?1
        ) activity
        WHERE occurred_at IS NOT NULL
        ORDER BY datetime(occurred_at) DESC
        LIMIT 8
      `
    )
      .bind(classId)
      .all<OverviewActivity>(),
  ]);

  return {
    summary: summary ?? emptySummary,
    recentAttendance: attendanceResult.results,
    recentAssessments: assessmentResult.results,
    recentActivity: activityResult.results,
  };
}
