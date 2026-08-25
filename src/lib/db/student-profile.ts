import { getCloudflareContext } from "@opennextjs/cloudflare";

export type AttendanceStatus =
  | "PRESENT"
  | "LATE"
  | "ABSENT"
  | "EXCUSED";

export type StudentProfileIdentity = {
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

export type StudentAttendanceRecord = {
  session_id: number;
  session_date: string;
  meeting_no: number;
  topic: string | null;
  status: AttendanceStatus;
  recorded_at: string | null;
};

export type StudentAttendanceSummary = {
  percentage: number | null;
  present: number;
  late: number;
  absent: number;
  excused: number;
  attended: number;
  total: number;
};

export function summarizeStudentAttendance(
  attendance: StudentAttendanceRecord[]
): StudentAttendanceSummary {
  const counts: Record<AttendanceStatus, number> = {
    PRESENT: 0,
    LATE: 0,
    ABSENT: 0,
    EXCUSED: 0,
  };

  for (const record of attendance) {
    counts[record.status] += 1;
  }

  const attended = counts.PRESENT + counts.LATE;

  return {
    percentage:
      attendance.length > 0 ? (attended / attendance.length) * 100 : null,
    present: counts.PRESENT,
    late: counts.LATE,
    absent: counts.ABSENT,
    excused: counts.EXCUSED,
    attended,
    total: attendance.length,
  };
}

export type StudentQuizRecord = {
  quiz_id: number;
  sequence_no: number;
  title: string;
  max_score: number;
  date_given: string | null;
  score: number | null;
  status:
    | "SCORED"
    | "ABSENT"
    | "EXCUSED";
  updated_at: string;
};

export type StudentQuizSummary = {
  percentage: number | null;
  earned: number;
  possible: number;
  scored: number;
};

export function getStudentQuizPercentage(
  quiz: Pick<StudentQuizRecord, "status" | "score" | "max_score">
): number | null {
  const score = Number(quiz.score);
  const maxScore = Number(quiz.max_score);

  if (
    quiz.status !== "SCORED" ||
    quiz.score === null ||
    !Number.isFinite(score) ||
    !Number.isFinite(maxScore) ||
    maxScore <= 0
  ) {
    return null;
  }

  return (score / maxScore) * 100;
}

export function summarizeStudentQuizzes(
  quizzes: StudentQuizRecord[]
): StudentQuizSummary {
  const scoredQuizzes = quizzes.filter(
    (quiz) => quiz.status === "SCORED" && quiz.score !== null
  );
  const earned = scoredQuizzes.reduce(
    (total, quiz) => total + Number(quiz.score),
    0
  );
  const possible = scoredQuizzes.reduce(
    (total, quiz) => total + Number(quiz.max_score),
    0
  );

  return {
    percentage: possible > 0 ? (earned / possible) * 100 : null,
    earned,
    possible,
    scored: scoredQuizzes.length,
  };
}

export type StudentLaboratoryRecord = {
  laboratory_id: number;
  lab_no: number;
  title: string;
  lab_type: "individual" | "group";
  total_points: number;
  group_points: number;
  individual_points: number;
  status: "open" | "completed";
  start_date: string | null;
  due_date: string | null;
  individual_score: number | null;
  group_score: number | null;
  score_updated_at: string | null;
};

export type StudentLaboratorySummary = {
  percentage: number | null;
  earned: number;
  possible: number;
  scored: number;
};

export function getStudentLaboratoryScore(
  laboratory: Pick<
    StudentLaboratoryRecord,
    "lab_type" | "individual_score" | "group_score"
  >
): number | null {
  if (laboratory.individual_score === null) {
    return null;
  }

  const individualScore = Number(laboratory.individual_score);

  if (!Number.isFinite(individualScore)) {
    return null;
  }

  if (laboratory.lab_type === "individual") {
    return individualScore;
  }

  if (laboratory.group_score === null) {
    return null;
  }

  const groupScore = Number(laboratory.group_score);
  return Number.isFinite(groupScore) ? groupScore + individualScore : null;
}

export function getStudentLaboratoryPercentage(
  laboratory: StudentLaboratoryRecord
): number | null {
  const score = getStudentLaboratoryScore(laboratory);
  const totalPoints = Number(laboratory.total_points);

  return score !== null && Number.isFinite(totalPoints) && totalPoints > 0
    ? (score / totalPoints) * 100
    : null;
}

export function summarizeStudentLaboratories(
  laboratories: StudentLaboratoryRecord[]
): StudentLaboratorySummary {
  const scored = laboratories.flatMap((laboratory) => {
    const score = getStudentLaboratoryScore(laboratory);
    const possible = Number(laboratory.total_points);

    return score === null || !Number.isFinite(possible) || possible <= 0
      ? []
      : [{ score, possible }];
  });
  const earned = scored.reduce((total, item) => total + item.score, 0);
  const possible = scored.reduce((total, item) => total + item.possible, 0);

  return {
    percentage: possible > 0 ? (earned / possible) * 100 : null,
    earned,
    possible,
    scored: scored.length,
  };
}

export type StudentProfileData = {
  student: StudentProfileIdentity;
  attendance: StudentAttendanceRecord[];
  quizzes: StudentQuizRecord[];
  laboratories: StudentLaboratoryRecord[];
};

export async function getStudentProfile(
  classId: number,
  studentId: number
): Promise<StudentProfileData | null> {
  const { env } = getCloudflareContext();

  const student = await env.DB.prepare(
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
    .bind(classId, studentId)
    .first<StudentProfileIdentity>();

  if (!student) {
    return null;
  }

  const [attendanceResult, quizResult, laboratoryResult] =
    await Promise.all([
      env.DB.prepare(
        `
          SELECT
            a.id AS session_id,
            a.session_date,
            a.meeting_no,
            a.topic,
            ar.status,
            ar.recorded_at
          FROM attendance_records ar
          INNER JOIN attendance_sessions a
            ON a.id = ar.attendance_session_id
          WHERE ar.enrollment_id = ?1
            AND a.class_id = ?2
            AND a.status = 'CLOSED'
          ORDER BY
            a.session_date DESC,
            a.meeting_no DESC
        `
      )
        .bind(student.enrollment_id, classId)
        .all<StudentAttendanceRecord>(),

      env.DB.prepare(
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
          FROM assessment_scores qs
          INNER JOIN assessments a
            ON a.id = qs.assessment_id
          WHERE qs.enrollment_id = ?1
            AND a.class_id = ?2
            AND a.type = 'QUIZ'
            AND qs.status IN ('SCORED', 'ABSENT', 'EXCUSED')
          ORDER BY
            COALESCE(a.date_given, qs.updated_at) DESC,
            a.sequence_no DESC
        `
      )
        .bind(student.enrollment_id, classId)
        .all<StudentQuizRecord>(),

      env.DB.prepare(
        `
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
            ls.individual_score,
            ls.updated_at AS score_updated_at,
            (
              SELECT lg.group_score
              FROM laboratory_group_members lgm
              INNER JOIN laboratory_groups lg
                ON lg.id = lgm.laboratory_group_id
              WHERE lg.laboratory_id = l.id
                AND lgm.student_id = ?1
              ORDER BY lg.id ASC
              LIMIT 1
            ) AS group_score
          FROM laboratories l
          LEFT JOIN laboratory_scores ls
            ON ls.laboratory_id = l.id
            AND ls.student_id = ?1
          WHERE l.class_id = ?2
          ORDER BY l.lab_no DESC, l.id DESC
        `
      )
        .bind(studentId, classId)
        .all<StudentLaboratoryRecord>(),
    ]);

  return {
    student,
    attendance: attendanceResult.results,
    quizzes: quizResult.results,
    laboratories: laboratoryResult.results,
  };
}
