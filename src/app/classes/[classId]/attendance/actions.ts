"use server";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/session";

export async function createAttendanceSession(
  classId: number,
  formData: FormData
) {
  await requireUser();

  if (
    !Number.isInteger(classId) ||
    classId <= 0
  ) {
    throw new Error("Invalid class.");
  }

  const dateValue =
    formData.get("session_date");

  const meetingValue =
    formData.get("meeting_no");

  const topicValue =
    formData.get("topic");

  if (
    typeof dateValue !== "string" ||
    dateValue.trim() === ""
  ) {
    throw new Error(
      "Attendance date is required."
    );
  }

  const sessionDate =
    dateValue.trim();

  const meetingNo =
    Number(meetingValue);

  if (
    !Number.isInteger(meetingNo) ||
    meetingNo <= 0
  ) {
    throw new Error(
      "Invalid meeting number."
    );
  }

  const topic =
    typeof topicValue === "string" &&
    topicValue.trim() !== ""
      ? topicValue.trim()
      : null;

  const { env } =
    getCloudflareContext();

  // Check whether this exact attendance
  // session already exists.
  const existingSession =
    await env.DB.prepare(
      `
        SELECT
          id,
          status

        FROM attendance_sessions

        WHERE class_id = ?1
          AND session_date = ?2
          AND meeting_no = ?3

        LIMIT 1
      `
    )
      .bind(
        classId,
        sessionDate,
        meetingNo
      )
      .first<{
        id: number;
        status: "OPEN" | "CLOSED";
      }>();

  // Instead of crashing because of the UNIQUE
  // constraint, open the existing session.
  if (existingSession) {
    redirect(
      `/classes/${classId}/attendance/${existingSession.id}`
    );
  }

  const result =
    await env.DB.prepare(
      `
        INSERT INTO attendance_sessions (
          class_id,
          session_date,
          meeting_no,
          topic,
          started_at,
          status
        )

        VALUES (
          ?1,
          ?2,
          ?3,
          ?4,
          ?5,
          'OPEN'
        )
      `
    )
      .bind(
        classId,
        sessionDate,
        meetingNo,
        topic,
        new Date().toISOString()
      )
      .run();

  const sessionId =
    Number(
      result.meta.last_row_id
    );

  revalidatePath(
    `/classes/${classId}/attendance`
  );

  redirect(
    `/classes/${classId}/attendance/${sessionId}`
  );
}

export async function finishAttendanceSession(
  classId: number,
  sessionId: number,
  _formData: FormData
) {
  await requireUser();

  const { env } =
    getCloudflareContext();

  const session =
    await env.DB.prepare(
      `
        SELECT id, status
        FROM attendance_sessions
        WHERE id = ?1
          AND class_id = ?2
        LIMIT 1
      `
    )
      .bind(
        sessionId,
        classId
      )
      .first<{
        id: number;
        status: string;
      }>();

  if (!session) {
    throw new Error(
      "Attendance session not found."
    );
  }

  if (session.status === "CLOSED") {
    redirect(
      `/classes/${classId}/attendance`
    );
  }

  const now =
    new Date().toISOString();

  const addAbsentRecords =
    env.DB.prepare(
      `
        INSERT INTO attendance_records (
          attendance_session_id,
          enrollment_id,
          status,
          recorded_at,
          recording_method
        )

        SELECT
          ?1,
          e.id,
          'ABSENT',
          ?2,
          'MANUAL'

        FROM enrollments e

        WHERE e.class_id = ?3
          AND e.status = 'ACTIVE'

          AND NOT EXISTS (
            SELECT 1

            FROM attendance_records ar

            WHERE
              ar.attendance_session_id = ?1
              AND ar.enrollment_id = e.id
          )
      `
    )
      .bind(
        sessionId,
        now,
        classId
      );

  const closeSession =
    env.DB.prepare(
      `
        UPDATE attendance_sessions

        SET
          status = 'CLOSED',
          ended_at = ?1,
          updated_at = CURRENT_TIMESTAMP

        WHERE id = ?2
          AND class_id = ?3
      `
    )
      .bind(
        now,
        sessionId,
        classId
      );

  await env.DB.batch([
    addAbsentRecords,
    closeSession,
  ]);

  revalidatePath(
    `/classes/${classId}`
  );

  revalidatePath(
    `/classes/${classId}/attendance`
  );

  redirect(
    `/classes/${classId}/attendance`
  );
}
