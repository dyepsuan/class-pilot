import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { ClassMeeting } from "@/lib/class-meetings";

export type DashboardSummary = {
  class_count: number;
  student_count: number;
  attendance_count: number;
  open_attendance_count: number;
  open_laboratory_count: number;
};

export type DashboardClass = {
  id: number;
  subject_code: string;
  subject_name: string;
  section: string;
  school_year: string;
  term: string;
  schedule_text: string | null;
  student_count: number;
  open_attendance_count: number;
  open_laboratory_count: number;
  open_attendance_session_id: number | null;
  meetings: ClassMeeting[];
};

export type DashboardActivity = {
  key: string;
  kind: "ATTENDANCE" | "QUIZ" | "LABORATORY";
  class_id: number;
  section: string;
  detail: string;
  occurred_at: string;
  destination_id: number;
};

export type DashboardData = {
  summary: DashboardSummary;
  classes: DashboardClass[];
  recentActivity: DashboardActivity[];
};

const emptySummary: DashboardSummary = {
  class_count: 0,
  student_count: 0,
  attendance_count: 0,
  open_attendance_count: 0,
  open_laboratory_count: 0,
};

export async function getDashboardData(): Promise<DashboardData> {
  const { env } = getCloudflareContext();

  const [summary, classResult, meetingResult, activityResult] = await Promise.all([
    env.DB.prepare(
      `
        SELECT
          (SELECT COUNT(*) FROM classes WHERE status = 'ACTIVE')
            AS class_count,
          (
            SELECT COUNT(DISTINCT e.student_id)
            FROM enrollments e
            INNER JOIN classes c ON c.id = e.class_id
            WHERE c.status = 'ACTIVE'
              AND e.status = 'ACTIVE'
          ) AS student_count,
          (
            SELECT COUNT(*)
            FROM attendance_sessions a
            INNER JOIN classes c ON c.id = a.class_id
            WHERE c.status = 'ACTIVE'
          ) AS attendance_count,
          (
            SELECT COUNT(*)
            FROM attendance_sessions a
            INNER JOIN classes c ON c.id = a.class_id
            WHERE c.status = 'ACTIVE'
              AND a.status = 'OPEN'
          ) AS open_attendance_count,
          (
            SELECT COUNT(*)
            FROM laboratories l
            INNER JOIN classes c ON c.id = l.class_id
            WHERE c.status = 'ACTIVE'
              AND l.status = 'open'
          ) AS open_laboratory_count
      `
    ).first<DashboardSummary>(),

    env.DB.prepare(
      `
        WITH active_enrollments AS (
          SELECT class_id, COUNT(*) AS student_count
          FROM enrollments
          WHERE status = 'ACTIVE'
          GROUP BY class_id
        ),
        attendance_state AS (
          SELECT
            class_id,
            SUM(CASE WHEN status = 'OPEN' THEN 1 ELSE 0 END)
              AS open_attendance_count
          FROM attendance_sessions
          GROUP BY class_id
        ),
        latest_open_attendance AS (
          SELECT class_id, MAX(id) AS session_id
          FROM attendance_sessions
          WHERE status = 'OPEN'
          GROUP BY class_id
        ),
        laboratory_state AS (
          SELECT
            class_id,
            SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END)
              AS open_laboratory_count
          FROM laboratories
          GROUP BY class_id
        )
        SELECT
          c.id,
          c.subject_code,
          c.subject_name,
          c.section,
          c.school_year,
          c.term,
          c.schedule_text,
          COALESCE(e.student_count, 0) AS student_count,
          COALESCE(a.open_attendance_count, 0) AS open_attendance_count,
          COALESCE(l.open_laboratory_count, 0) AS open_laboratory_count,
          oa.session_id AS open_attendance_session_id
        FROM classes c
        LEFT JOIN active_enrollments e ON e.class_id = c.id
        LEFT JOIN attendance_state a ON a.class_id = c.id
        LEFT JOIN latest_open_attendance oa ON oa.class_id = c.id
        LEFT JOIN laboratory_state l ON l.class_id = c.id
        WHERE c.status = 'ACTIVE'
        ORDER BY c.created_at DESC
      `
    ).all<Omit<DashboardClass, "meetings">>(),

    env.DB.prepare(
      `
        SELECT m.id, m.class_id, m.weekday, m.start_time, m.end_time, m.position
        FROM class_meetings m
        INNER JOIN classes c ON c.id = m.class_id
        WHERE c.status = 'ACTIVE'
        ORDER BY m.class_id, m.weekday, m.start_time, m.position
      `
    ).all<ClassMeeting>(),

    env.DB.prepare(
      `
        SELECT *
        FROM (
          SELECT
            'attendance-' || a.id AS key,
            'ATTENDANCE' AS kind,
            a.class_id,
            c.section,
            CASE
              WHEN a.status = 'CLOSED'
                THEN 'Attendance finalized for Meeting ' || a.meeting_no
              ELSE 'Attendance started for Meeting ' || a.meeting_no
            END AS detail,
            CASE
              WHEN a.status = 'CLOSED' THEN a.ended_at
              ELSE a.started_at
            END AS occurred_at,
            a.id AS destination_id
          FROM attendance_sessions a
          INNER JOIN classes c ON c.id = a.class_id
          WHERE c.status = 'ACTIVE'
            AND (
              (a.status = 'CLOSED' AND a.ended_at IS NOT NULL)
              OR (a.status = 'OPEN' AND a.started_at IS NOT NULL)
            )

          UNION ALL

          SELECT
            'quiz-' || a.id AS key,
            'QUIZ' AS kind,
            a.class_id,
            c.section,
            'Quiz ' || a.sequence_no || ' scores recorded' AS detail,
            MAX(s.updated_at) AS occurred_at,
            a.id AS destination_id
          FROM assessments a
          INNER JOIN classes c ON c.id = a.class_id
          INNER JOIN assessment_scores s
            ON s.assessment_id = a.id
            AND s.status = 'SCORED'
          WHERE c.status = 'ACTIVE'
            AND a.type = 'QUIZ'
          GROUP BY a.id, a.class_id, c.section, a.sequence_no

          UNION ALL

          SELECT
            'laboratory-' || l.id AS key,
            'LABORATORY' AS kind,
            l.class_id,
            c.section,
            CASE
              WHEN l.status = 'completed'
                THEN 'Laboratory ' || l.lab_no || ' completed'
              ELSE 'Laboratory ' || l.lab_no || ' created'
            END AS detail,
            CASE
              WHEN l.status = 'completed' THEN l.updated_at
              ELSE l.created_at
            END AS occurred_at,
            l.id AS destination_id
          FROM laboratories l
          INNER JOIN classes c ON c.id = l.class_id
          WHERE c.status = 'ACTIVE'
        ) activity
        WHERE occurred_at IS NOT NULL
        ORDER BY datetime(occurred_at) DESC
        LIMIT 8
      `
    ).all<DashboardActivity>(),
  ]);

  const meetingsByClass = Map.groupBy(
    meetingResult.results,
    (meeting) => meeting.class_id ?? 0
  );

  return {
    summary: summary ?? emptySummary,
    classes: classResult.results.map((classItem) => ({
      ...classItem,
      meetings: meetingsByClass.get(classItem.id) ?? [],
    })),
    recentActivity: activityResult.results,
  };
}
