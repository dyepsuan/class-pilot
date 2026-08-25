import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { ClassMeeting } from "@/lib/class-meetings";

export type ClassListItem = {
  id: number;
  subject_code: string;
  subject_name: string;
  section: string;
  school_year: string;
  term: string;
  schedule_text: string | null;
  status: string;
  student_count: number;
  meetings: ClassMeeting[];
};

export type ClassDetail = {
  id: number;
  subject_code: string;
  subject_name: string;
  section: string;
  school_year: string;
  term: string;
  schedule_text: string | null;
  status: string;
  meetings: ClassMeeting[];
};

export async function getActiveClasses(): Promise<ClassListItem[]> {
  const { env } = getCloudflareContext();

  const [result, meetingResult] = await Promise.all([
    env.DB.prepare(
    `
      SELECT
        c.id,
        c.subject_code,
        c.subject_name,
        c.section,
        c.school_year,
        c.term,
        c.schedule_text,
        c.status,
        COUNT(e.id) AS student_count
      FROM classes c
      LEFT JOIN enrollments e
        ON e.class_id = c.id
        AND e.status = 'ACTIVE'
      WHERE c.status = 'ACTIVE'
      GROUP BY
        c.id,
        c.subject_code,
        c.subject_name,
        c.section,
        c.school_year,
        c.term,
        c.schedule_text,
        c.status
      ORDER BY c.created_at DESC
    `
    ).all<Omit<ClassListItem, "meetings">>(),
    env.DB.prepare(
      `
        SELECT m.id, m.class_id, m.weekday, m.start_time, m.end_time, m.position
        FROM class_meetings m
        INNER JOIN classes c ON c.id = m.class_id
        WHERE c.status = 'ACTIVE'
        ORDER BY m.class_id, m.weekday, m.start_time, m.position
      `
    ).all<ClassMeeting>(),
  ]);

  const meetingsByClass = Map.groupBy(
    meetingResult.results,
    (meeting) => meeting.class_id ?? 0
  );

  return result.results.map((classItem) => ({
    ...classItem,
    meetings: meetingsByClass.get(classItem.id) ?? [],
  }));
}

export async function getClassById(
  classId: number
): Promise<ClassDetail | null> {
  const { env } = getCloudflareContext();

  const [classItem, meetingResult] = await Promise.all([
    env.DB.prepare(
    `
      SELECT
        id,
        subject_code,
        subject_name,
        section,
        school_year,
        term,
        schedule_text,
        status
      FROM classes
      WHERE id = ?1
      LIMIT 1
    `
  )
    .bind(classId)
      .first<Omit<ClassDetail, "meetings">>(),
    env.DB.prepare(
      `
        SELECT id, class_id, weekday, start_time, end_time, position
        FROM class_meetings
        WHERE class_id = ?1
        ORDER BY weekday, start_time, position
      `
    )
      .bind(classId)
      .all<ClassMeeting>(),
  ]);

  return classItem ? { ...classItem, meetings: meetingResult.results } : null;
}

