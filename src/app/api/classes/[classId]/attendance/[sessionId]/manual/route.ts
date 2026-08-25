import { getCloudflareContext } from "@opennextjs/cloudflare";

import { requireApiAuthentication } from "@/lib/auth/api";

type RouteProps = {
  params: Promise<{
    classId: string;
    sessionId: string;
  }>;
};

type ManualStatus =
  | "PRESENT"
  | "LATE"
  | "EXCUSED"
  | "CLEAR";

export async function POST(
  request: Request,
  { params }: RouteProps
) {
  try {
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
      !Number.isInteger(classIdNumber) ||
      !Number.isInteger(sessionIdNumber) ||
      classIdNumber <= 0 ||
      sessionIdNumber <= 0
    ) {
      return Response.json(
        {
          code: "INVALID_REQUEST",
          message: "Invalid attendance session.",
        },
        {
          status: 400,
        }
      );
    }

    let body: {
      enrollmentId?: number;
      status?: ManualStatus;
    };

    try {
      body = await request.json();
    } catch {
      return Response.json(
        {
          code: "INVALID_REQUEST",
          message: "Invalid request.",
        },
        {
          status: 400,
        }
      );
    }

    const enrollmentId =
      Number(body.enrollmentId);

    const status =
      body.status;

    if (
      !Number.isInteger(enrollmentId) ||
      enrollmentId <= 0
    ) {
      return Response.json(
        {
          code: "INVALID_REQUEST",
          message: "Invalid student enrollment.",
        },
        {
          status: 400,
        }
      );
    }

    const allowedStatuses: ManualStatus[] = [
      "PRESENT",
      "LATE",
      "EXCUSED",
      "CLEAR",
    ];

    if (
      !status ||
      !allowedStatuses.includes(status)
    ) {
      return Response.json(
        {
          code: "INVALID_STATUS",
          message: "Invalid attendance status.",
        },
        {
          status: 400,
        }
      );
    }

    const { env } =
      getCloudflareContext();

    // Make sure the attendance session belongs
    // to this class and is still open.
    const session =
      await env.DB.prepare(
        `
          SELECT
            id,
            status

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
          status: "OPEN" | "CLOSED";
        }>();

    if (!session) {
      return Response.json(
        {
          code: "SESSION_NOT_FOUND",
          message: "Attendance session not found.",
        },
        {
          status: 404,
        }
      );
    }

    if (session.status !== "OPEN") {
      return Response.json(
        {
          code: "SESSION_CLOSED",
          message: "Attendance is already closed.",
        },
        {
          status: 409,
        }
      );
    }

    // Make sure the enrollment belongs
    // to the current class.
    const enrollment =
      await env.DB.prepare(
        `
          SELECT
            e.id AS enrollment_id,
            s.student_number,
            s.first_name,
            s.middle_name,
            s.last_name,
            s.suffix,
            e.status AS enrollment_status

          FROM enrollments e

          INNER JOIN students s
            ON s.id = e.student_id

          WHERE e.id = ?1
            AND e.class_id = ?2

          LIMIT 1
        `
      )
        .bind(
          enrollmentId,
          classIdNumber
        )
        .first<{
          enrollment_id: number;
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
          code: "STUDENT_NOT_FOUND",
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

    const fullName = [
      enrollment.first_name,
      enrollment.middle_name,
      enrollment.last_name,
      enrollment.suffix,
    ]
      .filter(Boolean)
      .join(" ");

    // ---------------------------------------------
    // CLEAR ATTENDANCE
    // ---------------------------------------------

    if (status === "CLEAR") {
      await env.DB.prepare(
        `
          DELETE FROM attendance_records

          WHERE attendance_session_id = ?1
            AND enrollment_id = ?2
        `
      )
        .bind(
          sessionIdNumber,
          enrollmentId
        )
        .run();

      return Response.json({
        code: "CLEARED",
        message: "Attendance cleared.",

        student: {
          enrollmentId:
            enrollment.enrollment_id,

          studentNumber:
            enrollment.student_number,

          name:
            fullName,

          status:
            null,

          recordedAt:
            null,

          recordingMethod:
            null,
        },
      });
    }

    // ---------------------------------------------
    // PRESENT / LATE / EXCUSED
    // ---------------------------------------------

    const recordedAt =
      new Date().toISOString();

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
          'MANUAL'
        )

        ON CONFLICT(
          attendance_session_id,
          enrollment_id
        )

        DO UPDATE SET
          status = excluded.status,
          recorded_at = excluded.recorded_at,
          recording_method = 'MANUAL',
          updated_at = CURRENT_TIMESTAMP
      `
    )
      .bind(
        sessionIdNumber,
        enrollmentId,
        status,
        recordedAt
      )
      .run();

    return Response.json({
      code: "UPDATED",
      message: "Attendance updated.",

      student: {
        enrollmentId:
          enrollment.enrollment_id,

        studentNumber:
          enrollment.student_number,

        name:
          fullName,

        status,

        recordedAt,

        recordingMethod:
          "MANUAL",
      },
    });
  } catch (error) {
    console.error(
      "[ClassPilot manual attendance error]",
      error
    );

    return Response.json(
      {
        code: "SERVER_ERROR",

        message:
          error instanceof Error
            ? error.message
            : "Could not update attendance.",
      },
      {
        status: 500,
      }
    );
  }
}
