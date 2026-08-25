import { getCloudflareContext } from "@opennextjs/cloudflare";

export type AttendanceSession = {
  id: number;
  class_id: number;
  session_date: string;
  meeting_no: number;
  topic: string | null;
  notes: string | null;
  started_at: string | null;
  ended_at: string | null;
  late_after: string | null;
  status: "OPEN" | "CLOSED";

  total_students: number;

  checked_in_count: number;
  qr_scanned_count: number;

  present_count: number;
  late_count: number;
  absent_count: number;
  excused_count: number;
};

export type AttendanceRosterItem = {
  enrollment_id: number;
  student_id: number;
  student_number: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;

  status:
    | "PRESENT"
    | "LATE"
    | "ABSENT"
    | "EXCUSED"
    | null;

  recorded_at: string | null;

  recording_method:
    | "QR"
    | "MANUAL"
    | null;
};

export async function getAttendanceSessions(
  classId: number
): Promise<AttendanceSession[]> {
  const { env } = getCloudflareContext();

  const result = await env.DB.prepare(
    `
      SELECT
        a.id,
        a.class_id,
        a.session_date,
        a.meeting_no,
        a.topic,
        a.notes,
        a.started_at,
        a.ended_at,
        a.late_after,
        a.status,

        CASE
          WHEN a.status = 'CLOSED' THEN (
            SELECT COUNT(*)
            FROM attendance_records ar
            WHERE ar.attendance_session_id = a.id
          )
          ELSE (
            SELECT COUNT(*)
            FROM enrollments e
            WHERE e.class_id = a.class_id
              AND e.status = 'ACTIVE'
          )
        END AS total_students,

        (
          SELECT COUNT(*)
          FROM attendance_records ar
          WHERE ar.attendance_session_id = a.id
            AND ar.status IN ('PRESENT', 'LATE')
        ) AS checked_in_count,

        (
          SELECT COUNT(*)
          FROM attendance_records ar
          WHERE ar.attendance_session_id = a.id
            AND ar.recording_method = 'QR'
            AND ar.status IN ('PRESENT', 'LATE')
        ) AS qr_scanned_count,

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
    `
  )
    .bind(classId)
    .all<AttendanceSession>();

  return result.results;
}

export async function getAttendanceSession(
  classId: number,
  sessionId: number
): Promise<AttendanceSession | null> {
  const { env } = getCloudflareContext();

  return env.DB.prepare(
    `
      SELECT
        a.id,
        a.class_id,
        a.session_date,
        a.meeting_no,
        a.topic,
        a.notes,
        a.started_at,
        a.ended_at,
        a.late_after,
        a.status,

        CASE
          WHEN a.status = 'CLOSED' THEN (
            SELECT COUNT(*)
            FROM attendance_records ar
            WHERE ar.attendance_session_id = a.id
          )
          ELSE (
            SELECT COUNT(*)
            FROM enrollments e
            WHERE e.class_id = a.class_id
              AND e.status = 'ACTIVE'
          )
        END AS total_students,

        (
          SELECT COUNT(*)
          FROM attendance_records ar
          WHERE ar.attendance_session_id = a.id
            AND ar.status IN ('PRESENT', 'LATE')
        ) AS checked_in_count,

        (
          SELECT COUNT(*)
          FROM attendance_records ar
          WHERE ar.attendance_session_id = a.id
            AND ar.recording_method = 'QR'
            AND ar.status IN ('PRESENT', 'LATE')
        ) AS qr_scanned_count,

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

      WHERE a.id = ?1
        AND a.class_id = ?2

      LIMIT 1
    `
  )
    .bind(
      sessionId,
      classId
    )
    .first<AttendanceSession>();
}

export async function getAttendanceRoster(
  classId: number,
  sessionId: number
): Promise<AttendanceRosterItem[]> {
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

        ar.status,
        ar.recorded_at,
        ar.recording_method

      FROM enrollments e

      INNER JOIN students s
        ON s.id = e.student_id

      LEFT JOIN attendance_records ar
        ON ar.enrollment_id = e.id
        AND ar.attendance_session_id = ?1

      WHERE e.class_id = ?2
        AND (
          e.status = 'ACTIVE'
          OR ar.enrollment_id IS NOT NULL
        )

      ORDER BY
        s.last_name ASC,
        s.first_name ASC
    `
  )
    .bind(
      sessionId,
      classId
    )
    .all<AttendanceRosterItem>();

  return result.results;
}
