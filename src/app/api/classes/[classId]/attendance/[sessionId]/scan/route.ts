import { getCloudflareContext } from "@opennextjs/cloudflare";

import { requireApiAuthentication } from "@/lib/auth/api";
import {
  hashStudentQrPayload,
  verifyStudentQrPayload,
} from "@/lib/qr/student-qr";

type RouteProps = {
  params: Promise<{
    classId: string;
    sessionId: string;
  }>;
};

export async function POST(
  request: Request,
  { params }: RouteProps
) {
  const authenticationError = await requireApiAuthentication();

  if (authenticationError) {
    return authenticationError;
  }

  const {
    classId,
    sessionId,
  } = await params;

  const classIdNumber =
    Number(classId);

  const sessionIdNumber =
    Number(sessionId);

  if (
    !Number.isInteger(
      classIdNumber
    ) ||
    !Number.isInteger(
      sessionIdNumber
    )
  ) {
    return Response.json(
      {
        code: "INVALID_REQUEST",
        message:
          "Invalid attendance session.",
      },
      {
        status: 400,
      }
    );
  }

  let body: {
    payload?: string;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json(
      {
        code: "INVALID_REQUEST",
        message:
          "Invalid request.",
      },
      {
        status: 400,
      }
    );
  }

  const payload =
    body.payload?.trim();

  if (!payload) {
    return Response.json(
      {
        code: "INVALID_QR",
        message:
          "No QR payload received.",
      },
      {
        status: 400,
      }
    );
  }

  const { env } =
    getCloudflareContext();

  const session =
    await env.DB.prepare(
      `
        SELECT
          id,
          class_id,
          status,
          late_after

        FROM attendance_sessions

        WHERE id = ?1
          AND class_id = ?2

        LIMIT 1
      `
    )
      .bind(
        sessionIdNumber,
        classIdNumber
      )
      .first<{
        id: number;
        class_id: number;
        status: string;
        late_after: string | null;
      }>();

  if (!session) {
    return Response.json(
      {
        code: "SESSION_NOT_FOUND",
        message:
          "Attendance session not found.",
      },
      {
        status: 404,
      }
    );
  }

  if (
    session.status !== "OPEN"
  ) {
    return Response.json(
      {
        code: "SESSION_CLOSED",
        message:
          "Attendance is already closed.",
      },
      {
        status: 409,
      }
    );
  }

  const verified =
    await verifyStudentQrPayload(
      payload,
      env.QR_SIGNING_SECRET
    );

  if (!verified) {
    return Response.json(
      {
        code: "INVALID_QR",
        message:
          "This is not a valid ClassPilot QR code.",
      },
      {
        status: 400,
      }
    );
  }

  const payloadHash =
    await hashStudentQrPayload(
      payload
    );

  const credential =
    await env.DB.prepare(
      `
        SELECT id

        FROM student_qr_credentials

        WHERE id = ?1
          AND student_id = ?2
          AND token_hash = ?3
          AND revoked_at IS NULL

        LIMIT 1
      `
    )
      .bind(
        verified.credentialId,
        verified.studentId,
        payloadHash
      )
      .first<{
        id: number;
      }>();

  if (!credential) {
    return Response.json(
      {
        code: "QR_REVOKED",
        message:
          "This QR credential is no longer active.",
      },
      {
        status: 400,
      }
    );
  }

  const enrollment =
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
          e.status AS enrollment_status

        FROM enrollments e

        INNER JOIN students s
          ON s.id = e.student_id

        WHERE e.class_id = ?1
          AND e.student_id = ?2

        LIMIT 1
      `
    )
      .bind(
        classIdNumber,
        verified.studentId
      )
      .first<{
        enrollment_id: number;
        student_id: number;
        student_number: string;
        first_name: string;
        middle_name: string | null;
        last_name: string;
        suffix: string | null;
        enrollment_status: string;
      }>();

  if (!enrollment) {
    return Response.json(
      {
        code: "NOT_ENROLLED",
        message:
          "Student is not enrolled in this class.",
      },
      {
        status: 404,
      }
    );
  }

  if (enrollment.enrollment_status !== "ACTIVE") {
    return Response.json(
      {
        code: "ENROLLMENT_ARCHIVED",
        message: "This student is no longer active in this class.",
      },
      {
        status: 409,
      }
    );
  }

  const existing =
    await env.DB.prepare(
      `
        SELECT
          status,
          recorded_at

        FROM attendance_records

        WHERE
          attendance_session_id = ?1
          AND enrollment_id = ?2

        LIMIT 1
      `
    )
      .bind(
        sessionIdNumber,
        enrollment.enrollment_id
      )
      .first<{
        status: string;
        recorded_at: string | null;
      }>();

  const fullName = [
    enrollment.first_name,
    enrollment.middle_name,
    enrollment.last_name,
    enrollment.suffix,
  ]
    .filter(Boolean)
    .join(" ");

  if (existing) {
    return Response.json({
      code: "ALREADY_RECORDED",

      message:
        "Attendance already recorded.",

      student: {
        enrollmentId:
          enrollment.enrollment_id,

        studentNumber:
          enrollment.student_number,

        name: fullName,

        status:
          existing.status,

        recordedAt:
          existing.recorded_at,
      },
    });
  }

  const now =
    new Date();

  const recordedAt =
    now.toISOString();

  let attendanceStatus:
    | "PRESENT"
    | "LATE" = "PRESENT";

  if (session.late_after) {
    const lateAfter =
      new Date(
        session.late_after
      );

    if (
      now.getTime() >
      lateAfter.getTime()
    ) {
      attendanceStatus =
        "LATE";
    }
  }

  await env.DB.prepare(
    `
      INSERT INTO attendance_records (
        attendance_session_id,
        enrollment_id,
        status,
        recorded_at,
        recording_method
      )

      VALUES (
        ?1,
        ?2,
        ?3,
        ?4,
        'QR'
      )
    `
  )
    .bind(
      sessionIdNumber,
      enrollment.enrollment_id,
      attendanceStatus,
      recordedAt
    )
    .run();

  return Response.json({
    code: "RECORDED",

    message:
      "Attendance recorded.",

    student: {
      enrollmentId:
        enrollment.enrollment_id,

      studentNumber:
        enrollment.student_number,

      name:
        fullName,

      status:
        attendanceStatus,

      recordedAt,
    },
  });
}
