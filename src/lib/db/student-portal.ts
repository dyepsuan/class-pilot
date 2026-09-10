import { getCloudflareContext } from "@opennextjs/cloudflare";

import {
  getStudentLaboratoryScore,
  getStudentProfile,
  summarizeStudentAttendance,
  summarizeStudentLaboratories,
  summarizeStudentQuizzes,
  type StudentProfileData,
} from "./student-profile";
import { getActiveStudentQrPayload } from "./student-qr";
import { LABORATORY_EFFECTIVE_LOCK_SQL } from "./laboratory-grouping";
import {
  getLaboratorySubmissionTiming,
  type LaboratorySubmissionTiming,
} from "../laboratory-submissions/deadline";

export type StudentPortalClass = {
  id: number;
  enrollment_id: number;
  subject_code: string;
  subject_name: string;
  section: string;
  school_year: string;
  term: string;
  schedule_text: string | null;
  instructor_name: string;
};

export type StudentPortalAttendance = {
  classItem: StudentPortalClass;
  records: StudentProfileData["attendance"];
  summary: ReturnType<typeof summarizeStudentAttendance>;
};

export type StudentPortalQuizzes = {
  classItem: StudentPortalClass;
  records: StudentProfileData["quizzes"];
  summary: ReturnType<typeof summarizeStudentQuizzes>;
};

export type StudentPortalLaboratories = {
  classItem: StudentPortalClass;
  records: StudentPortalLaboratoryRecord[];
  summary: ReturnType<typeof summarizeStudentLaboratories>;
};

export type StudentPortalLaboratoryRecord = StudentProfileData["laboratories"][number] & {
  groups_locked_at: string | null;
  group_id: number | null;
  group_name: string | null;
  group_members: Array<{
    student_id: number;
    name: string;
  }>;
  group_submission: StudentPortalGroupSubmission | null;
};

export type StudentPortalGroupSubmission = {
  id: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  uploaded_by_student_id: number;
  uploaded_by_name: string;
  submitted_at: string;
  updated_at: string;
  timing: LaboratorySubmissionTiming | null;
};

type StudentPortalLaboratoryRow = Omit<
  StudentPortalLaboratoryRecord,
  "group_members" | "group_submission"
> & {
  group_submission_id: string | null;
  group_submission_original_filename: string | null;
  group_submission_mime_type: string | null;
  group_submission_file_size: number | null;
  group_submission_uploaded_by_student_id: number | null;
  group_submission_uploaded_by_name: string | null;
  group_submission_submitted_at: string | null;
  group_submission_updated_at: string | null;
};

export type StudentActivity = {
  key: string;
  occurredAt: string;
  category: "Attendance" | "Quiz" | "Laboratory";
  title: string;
  detail: string;
  tone: "green" | "amber" | "red" | "blue" | "slate";
};

export type StudentAcademicSummary = {
  attendance: {
    percentage: number | null;
    present: number;
    late: number;
    attended: number;
    total: number;
  };
  quizzes: {
    percentage: number | null;
    earned: number;
    possible: number;
    scored: number;
  };
  laboratories: {
    percentage: number | null;
    earned: number;
    possible: number;
    graded: number;
  };
  recentActivity: StudentActivity[];
};

export type StudentPortalDashboard = {
  classItem: StudentPortalClass;
  profile: StudentProfileData;
  summary: StudentAcademicSummary;
};

export type StudentPortalQrData = {
  classItem: StudentPortalClass;
  payload: string | null;
};

function parseStoredDate(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00+08:00`);
  }

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    return new Date(`${value.replace(" ", "T")}Z`);
  }

  return new Date(value);
}

function formatScore(value: number): string {
  return new Intl.NumberFormat("en-PH", {
    maximumFractionDigits: 2,
  }).format(value);
}


export function summarizeStudentAcademics(
  profile: StudentProfileData,
  activityLimit = 7
): StudentAcademicSummary {
  const attendance = summarizeStudentAttendance(profile.attendance);
  const quizzes = summarizeStudentQuizzes(profile.quizzes);
  const laboratorySummary = summarizeStudentLaboratories(profile.laboratories);
  const gradedLaboratories = profile.laboratories.flatMap((laboratory) => {
    const score = getStudentLaboratoryScore(laboratory);
    return score === null ? [] : [{ laboratory, score }];
  });
  const activities: StudentActivity[] = [];

  for (const record of profile.attendance) {
    if (!record.recorded_at) {
      continue;
    }

    const statusLabel =
      record.status.charAt(0) + record.status.slice(1).toLowerCase();

    activities.push({
      key: `attendance-${record.session_id}`,
      occurredAt: record.recorded_at,
      category: "Attendance",
      title: `Attendance recorded: ${statusLabel}`,
      detail: `Meeting ${record.meeting_no}${record.topic ? `, ${record.topic}` : ""}`,
      tone:
        record.status === "PRESENT"
          ? "green"
          : record.status === "LATE"
            ? "amber"
            : record.status === "ABSENT"
              ? "red"
              : "blue",
    });
  }

  for (const quiz of profile.quizzes) {
    const scored = quiz.status === "SCORED" && quiz.score !== null;
    activities.push({
      key: `quiz-${quiz.quiz_id}`,
      occurredAt: quiz.updated_at,
      category: "Quiz",
      title: scored
        ? `Quiz ${quiz.sequence_no} score posted`
        : `Quiz ${quiz.sequence_no}: ${quiz.status === "ABSENT" ? "Absent" : "Excused"}`,
      detail: scored
        ? `${formatScore(Number(quiz.score))} / ${formatScore(Number(quiz.max_score))}`
        : quiz.title,
      tone: scored ? "green" : quiz.status === "ABSENT" ? "red" : "blue",
    });
  }

  for (const { laboratory, score } of gradedLaboratories) {
    if (!laboratory.score_updated_at) {
      continue;
    }

    activities.push({
      key: `laboratory-${laboratory.laboratory_id}`,
      occurredAt: laboratory.score_updated_at,
      category: "Laboratory",
      title: `Laboratory ${laboratory.lab_no} score posted`,
      detail: `${formatScore(score)} / ${formatScore(Number(laboratory.total_points))}`,
      tone: "slate",
    });
  }

  activities.sort(
    (left, right) =>
      parseStoredDate(right.occurredAt).getTime() -
      parseStoredDate(left.occurredAt).getTime()
  );

  return {
    attendance: {
      percentage: attendance.percentage,
      present: attendance.present,
      late: attendance.late,
      attended: attendance.attended,
      total: attendance.total,
    },
    quizzes: quizzes,
    laboratories: {
      percentage: laboratorySummary.percentage,
      earned: laboratorySummary.earned,
      possible: laboratorySummary.possible,
      graded: laboratorySummary.scored,
    },
    recentActivity: activities.slice(0, activityLimit),
  };
}

export async function getActiveStudentPortalClasses(
  authenticatedStudentId: number
): Promise<StudentPortalClass[]> {
  const { env } = getCloudflareContext();

  const result = await env.DB.prepare(
    `
      SELECT
        c.id,
        e.id AS enrollment_id,
        c.subject_code,
        c.subject_name,
        c.section,
        c.school_year,
        c.term,
        c.schedule_text,
        u.display_name AS instructor_name
      FROM enrollments e
      INNER JOIN classes c ON c.id = e.class_id
      INNER JOIN users u ON u.id = c.instructor_id
      WHERE e.student_id = ?1
        AND e.status = 'ACTIVE'
        AND c.status = 'ACTIVE'
      ORDER BY e.created_at DESC, c.created_at DESC, c.id DESC
    `
  )
    .bind(authenticatedStudentId)
    .all<StudentPortalClass>();

  return result.results;
}

export async function getActiveStudentPortalClass(
  authenticatedStudentId: number
): Promise<StudentPortalClass | null> {
  const classes = await getActiveStudentPortalClasses(authenticatedStudentId);
  return classes[0] ?? null;
}

export async function getStudentPortalQrData(
  authenticatedStudentId: number,
  classItem: StudentPortalClass
): Promise<StudentPortalQrData | null> {
  const qr = await getActiveStudentQrPayload(authenticatedStudentId);

  return {
    classItem,
    payload: qr?.payload ?? null,
  };
}

export async function getStudentPortalAttendance(
  authenticatedStudentId: number,
  classItem: StudentPortalClass
): Promise<StudentPortalAttendance | null> {
  const { env } = getCloudflareContext();
  const result = await env.DB.prepare(
    `
      SELECT
        a.id AS session_id,
        a.session_date,
        a.meeting_no,
        a.topic,
        ar.status,
        ar.recorded_at
      FROM enrollments e
      INNER JOIN attendance_records ar ON ar.enrollment_id = e.id
      INNER JOIN attendance_sessions a
        ON a.id = ar.attendance_session_id
        AND a.class_id = e.class_id
      INNER JOIN classes c ON c.id = e.class_id
      WHERE e.student_id = ?1
        AND e.class_id = ?2
        AND e.status = 'ACTIVE'
        AND c.status = 'ACTIVE'
        AND a.status = 'CLOSED'
      ORDER BY a.session_date DESC, a.meeting_no DESC, a.id DESC
    `
  )
    .bind(authenticatedStudentId, classItem.id)
    .all<StudentProfileData["attendance"][number]>();

  return {
    classItem,
    records: result.results,
    summary: summarizeStudentAttendance(result.results),
  };
}

export async function getStudentPortalQuizzes(
  authenticatedStudentId: number,
  classItem: StudentPortalClass
): Promise<StudentPortalQuizzes | null> {
  const { env } = getCloudflareContext();
  const result = await env.DB.prepare(
    `
      SELECT
        a.id AS quiz_id,
        a.sequence_no,
        a.title,
        a.max_score,
        a.date_given,
        qs.score,
        qs.status,
        qs.updated_at
      FROM enrollments e
      INNER JOIN assessment_scores qs ON qs.enrollment_id = e.id
      INNER JOIN assessments a
        ON a.id = qs.assessment_id
        AND a.class_id = e.class_id
        AND a.type = 'QUIZ'
      INNER JOIN classes c ON c.id = e.class_id
      WHERE e.student_id = ?1
        AND e.class_id = ?2
        AND e.status = 'ACTIVE'
        AND c.status = 'ACTIVE'
        AND qs.status IN ('SCORED', 'ABSENT', 'EXCUSED')
      ORDER BY
        COALESCE(a.date_given, qs.updated_at) DESC,
        a.sequence_no DESC,
        a.id DESC
    `
  )
    .bind(authenticatedStudentId, classItem.id)
    .all<StudentProfileData["quizzes"][number]>();

  return {
    classItem,
    records: result.results,
    summary: summarizeStudentQuizzes(result.results),
  };
}

export async function getStudentPortalLaboratories(
  authenticatedStudentId: number,
  classItem: StudentPortalClass
): Promise<StudentPortalLaboratories | null> {
  const { env } = getCloudflareContext();
  const result = await env.DB.prepare(
    `
      WITH student_groups AS (
        SELECT
          lg.id AS group_id,
          lg.laboratory_id,
          lg.name AS group_name,
          lg.group_score,
          lg.updated_at AS group_score_updated_at
        FROM laboratory_group_members lgm
        INNER JOIN laboratory_groups lg
          ON lg.id = lgm.laboratory_group_id
        WHERE lgm.student_id = ?1
          AND lg.id = (
            SELECT MIN(lg2.id)
            FROM laboratory_group_members lgm2
            INNER JOIN laboratory_groups lg2
              ON lg2.id = lgm2.laboratory_group_id
            WHERE lgm2.student_id = ?1
              AND lg2.laboratory_id = lg.laboratory_id
          )
      )
      SELECT
        l.id AS laboratory_id,
        l.lab_no,
        l.title,
        l.lab_type,
        l.total_points,
        l.group_points,
        l.individual_points,
        l.status,
        l.start_date,
        l.due_date,
        l.groups_locked_at,
        ls.individual_score,
        sgs.group_id,
        sgs.group_name,
        sgs.group_score,
        lgsub.id AS group_submission_id,
        lgsub.original_filename AS group_submission_original_filename,
        lgsub.mime_type AS group_submission_mime_type,
        lgsub.file_size AS group_submission_file_size,
        lgsub.uploaded_by_student_id AS group_submission_uploaded_by_student_id,
        TRIM(
          uploader.last_name || ', ' || uploader.first_name ||
          CASE WHEN uploader.middle_name IS NOT NULL AND uploader.middle_name <> ''
            THEN ' ' || uploader.middle_name ELSE '' END ||
          CASE WHEN uploader.suffix IS NOT NULL AND uploader.suffix <> ''
            THEN ' ' || uploader.suffix ELSE '' END
        ) AS group_submission_uploaded_by_name,
        lgsub.submitted_at AS group_submission_submitted_at,
        lgsub.updated_at AS group_submission_updated_at,
        COALESCE(ls.updated_at, sgs.group_score_updated_at) AS score_updated_at
      FROM laboratories l
      LEFT JOIN laboratory_scores ls
        ON ls.laboratory_id = l.id
        AND ls.student_id = ?1
      LEFT JOIN student_groups sgs
        ON sgs.laboratory_id = l.id
      LEFT JOIN laboratory_group_submissions lgsub
        ON lgsub.laboratory_id = l.id
        AND lgsub.group_id = sgs.group_id
      LEFT JOIN students uploader
        ON uploader.id = lgsub.uploaded_by_student_id
      WHERE l.class_id = ?2
        AND (
          (l.lab_type = 'individual' AND ls.individual_score IS NOT NULL)
          OR (
            l.lab_type = 'group'
            AND ${LABORATORY_EFFECTIVE_LOCK_SQL}
            AND sgs.group_id IS NOT NULL
          )
        )
      ORDER BY l.lab_no DESC, l.id DESC
    `
  )
    .bind(authenticatedStudentId, classItem.id)
    .all<StudentPortalLaboratoryRow>();

  const memberResult = await env.DB.prepare(
    `
      SELECT
        lg.id AS group_id,
        s.id AS student_id,
        TRIM(
          s.last_name || ', ' || s.first_name ||
          CASE WHEN s.middle_name IS NOT NULL AND s.middle_name <> ''
            THEN ' ' || s.middle_name ELSE '' END ||
          CASE WHEN s.suffix IS NOT NULL AND s.suffix <> ''
            THEN ' ' || s.suffix ELSE '' END
        ) AS name
      FROM laboratory_group_members lgm
      INNER JOIN laboratory_groups lg ON lg.id = lgm.laboratory_group_id
      INNER JOIN laboratories l ON l.id = lg.laboratory_id
      INNER JOIN students s ON s.id = lgm.student_id
      WHERE l.class_id = ?2
        AND ${LABORATORY_EFFECTIVE_LOCK_SQL}
        AND EXISTS (
          SELECT 1
          FROM laboratory_group_members own_membership
          WHERE own_membership.laboratory_group_id = lg.id
            AND own_membership.student_id = ?1
        )
      ORDER BY lg.id ASC, s.last_name ASC, s.first_name ASC
    `
  )
    .bind(authenticatedStudentId, classItem.id)
    .all<{ group_id: number; student_id: number; name: string }>();

  const membersByGroup = new Map<number, StudentPortalLaboratoryRecord["group_members"]>();
  for (const member of memberResult.results) {
    const members = membersByGroup.get(Number(member.group_id)) ?? [];
    members.push({ student_id: Number(member.student_id), name: member.name });
    membersByGroup.set(Number(member.group_id), members);
  }

  const records: StudentPortalLaboratoryRecord[] = result.results.map((record) => ({
    ...record,
    group_submission: record.group_submission_id === null
      ? null
      : {
          id: record.group_submission_id,
          original_filename: record.group_submission_original_filename ?? "Submission",
          mime_type: record.group_submission_mime_type ?? "application/octet-stream",
          file_size: Number(record.group_submission_file_size ?? 0),
          uploaded_by_student_id: Number(
            record.group_submission_uploaded_by_student_id ?? 0
          ),
          uploaded_by_name: record.group_submission_uploaded_by_name ?? "Student",
          submitted_at: record.group_submission_submitted_at ?? "",
          updated_at: record.group_submission_updated_at ?? "",
          timing: record.group_submission_updated_at
            ? getLaboratorySubmissionTiming(
                record.group_submission_updated_at,
                record.due_date
              )
            : null,
        },
    group_members: record.group_id === null
      ? []
      : membersByGroup.get(Number(record.group_id)) ?? [],
  }));

  return {
    classItem,
    records,
    summary: summarizeStudentLaboratories(records),
  };
}
export async function getStudentPortalDashboard(
  authenticatedStudentId: number,
  classItem: StudentPortalClass
): Promise<StudentPortalDashboard | null> {
  const profile = await getStudentProfile(classItem.id, authenticatedStudentId);

  if (!profile || profile.student.enrollment_status !== "ACTIVE") {
    return null;
  }

  return {
    classItem,
    profile,
    summary: summarizeStudentAcademics(profile),
  };
}
