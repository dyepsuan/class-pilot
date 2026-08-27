"use server";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { revalidatePath } from "next/cache";

import { getInstructorManagedClass } from "@/lib/auth/instructor-class";
import { requireUser } from "@/lib/auth/session";
import {
  buildStudentQrPayload,
  hashStudentQrPayload,
} from "@/lib/qr/student-qr";

export type RegenerateStudentQrResult =
  | {
      success: true;
      count: number;
      students: Array<{ studentId: number; payload: string }>;
    }
  | { success: false; error: string };

type ActiveEnrollmentRow = {
  student_id: number;
};

function normalizeStudentIds(studentIds: number[]): number[] | null {
  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    return null;
  }

  const normalized = [...new Set(studentIds)];

  if (
    normalized.length > 500 ||
    normalized.some(
      (studentId) => !Number.isInteger(studentId) || studentId <= 0
    )
  ) {
    return null;
  }

  return normalized;
}

export async function regenerateSelectedStudentQrs(
  classId: number,
  studentIds: number[]
): Promise<RegenerateStudentQrResult> {
  if (!Number.isInteger(classId) || classId <= 0) {
    return { success: false, error: "Invalid class." };
  }

  const normalizedStudentIds = normalizeStudentIds(studentIds);

  if (!normalizedStudentIds) {
    return { success: false, error: "Select at least one valid student." };
  }

  const user = await requireUser();
  const managedClass = await getInstructorManagedClass(classId, user);

  if (!managedClass) {
    return { success: false, error: "Class not found or access denied." };
  }

  const { env } = getCloudflareContext();
  const placeholders = normalizedStudentIds.map((_, index) => `?${index + 2}`);
  const enrollmentResult = await env.DB.prepare(
    `
      SELECT student_id
      FROM enrollments
      WHERE class_id = ?1
        AND status = 'ACTIVE'
        AND student_id IN (${placeholders.join(", ")})
    `
  )
    .bind(classId, ...normalizedStudentIds)
    .all<ActiveEnrollmentRow>();
  const authorizedIds = new Set(
    enrollmentResult.results.map((row) => row.student_id)
  );

  if (
    authorizedIds.size !== normalizedStudentIds.length ||
    normalizedStudentIds.some((studentId) => !authorizedIds.has(studentId))
  ) {
    return {
      success: false,
      error: "One or more selected students are not active in this class.",
    };
  }

  const maximum = await env.DB.prepare(
    "SELECT COALESCE(MAX(id), 0) AS max_id FROM student_qr_credentials"
  ).first<{ max_id: number }>();
  const maximumCredentialId = Number(maximum?.max_id ?? 0);

  if (
    !Number.isSafeInteger(maximumCredentialId) ||
    maximumCredentialId < 0 ||
    maximumCredentialId + normalizedStudentIds.length > Number.MAX_SAFE_INTEGER
  ) {
    return { success: false, error: "QR credential IDs are unavailable." };
  }

  const rotatedAt = new Date().toISOString();
  const rotatedStudents = await Promise.all(
    normalizedStudentIds.map(async (studentId, index) => {
      const credentialId = maximumCredentialId + index + 1;
      const payload = await buildStudentQrPayload(
        credentialId,
        studentId,
        env.QR_SIGNING_SECRET
      );
      const tokenHash = await hashStudentQrPayload(payload);

      return { credentialId, studentId, payload, tokenHash };
    })
  );
  const statements: D1PreparedStatement[] = [];

  for (const student of rotatedStudents) {
    statements.push(
      env.DB.prepare(
        `
          UPDATE student_qr_credentials
          SET revoked_at = ?1
          WHERE student_id = ?2
            AND revoked_at IS NULL
        `
      ).bind(rotatedAt, student.studentId),
      env.DB.prepare(
        `
          INSERT INTO student_qr_credentials (
            id,
            student_id,
            token_hash,
            issued_at,
            created_at
          )
          VALUES (?1, ?2, ?3, ?4, ?4)
        `
      ).bind(
        student.credentialId,
        student.studentId,
        student.tokenHash,
        rotatedAt
      )
    );
  }

  try {
    const results = await env.DB.batch(statements);

    if (results.some((result) => !result.success)) {
      throw new Error("A QR rotation statement failed.");
    }
  } catch (error) {
    console.error("Could not rotate selected student QR credentials.", error);
    return {
      success: false,
      error: "No QR codes were changed. Please try again.",
    };
  }

  revalidatePath(`/classes/${classId}/students/qr-codes`);
  revalidatePath("/student/qr");

  return {
    success: true,
    count: rotatedStudents.length,
    students: rotatedStudents.map((student) => ({
      studentId: student.studentId,
      payload: student.payload,
    })),
  };
}
