"use server";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { revalidatePath } from "next/cache";

import { hashStudentPin } from "@/lib/auth/student-pin";
import { requireUser } from "@/lib/auth/session";

const PIN_RANGE = 1_000_000;
const UINT32_RANGE = 0x1_0000_0000;
const MAX_UNBIASED_VALUE =
  Math.floor(UINT32_RANGE / PIN_RANGE) * PIN_RANGE;

export type StudentPinActionResult =
  | { success: true; pin: string }
  | { success: false; error: string };

type ClassEnrollmentRow = {
  enrollment_status: string;
  account_student_id: number | null;
};

function generateSixDigitPin(): string {
  const values = new Uint32Array(1);
  let value: number;

  do {
    crypto.getRandomValues(values);
    value = values[0];
  } while (value >= MAX_UNBIASED_VALUE);

  return (value % PIN_RANGE).toString().padStart(6, "0");
}

function isUniqueStudentAccountError(error: unknown): boolean {
  return /unique constraint failed:\s*student_accounts\.student_id|constraint_unique/i.test(
    String(error)
  );
}

async function getClassEnrollment(
  classId: number,
  studentId: number
): Promise<ClassEnrollmentRow | null> {
  const { env } = getCloudflareContext();

  return env.DB.prepare(
    `
      SELECT
        e.status AS enrollment_status,
        sa.student_id AS account_student_id
      FROM enrollments e
      LEFT JOIN student_accounts sa ON sa.student_id = e.student_id
      WHERE e.class_id = ?1
        AND e.student_id = ?2
      LIMIT 1
    `
  )
    .bind(classId, studentId)
    .first<ClassEnrollmentRow>();
}

async function authorizeActiveStudent(
  classId: number,
  studentId: number
): Promise<
  | { success: true; accountExists: boolean }
  | { success: false; error: string }
> {
  const user = await requireUser();

  if (user.role !== "INSTRUCTOR") {
    return { success: false, error: "Instructor access is required." };
  }

  if (!Number.isInteger(classId) || classId <= 0) {
    return { success: false, error: "Invalid class." };
  }

  if (!Number.isInteger(studentId) || studentId <= 0) {
    return { success: false, error: "Invalid student." };
  }

  const { env } = getCloudflareContext();

  const managedClass = await env.DB.prepare(
    `
      SELECT c.id
      FROM classes c
      INNER JOIN users owner ON owner.id = c.instructor_id
      WHERE c.id = ?1
        AND (
          c.instructor_id = ?2
          OR (
            owner.auth_id IS NULL
            AND 1 = (
              SELECT COUNT(*)
              FROM users authenticated_instructor
              WHERE authenticated_instructor.role = 'INSTRUCTOR'
                AND authenticated_instructor.auth_id IS NOT NULL
            )
          )
        )
      LIMIT 1
    `
  )
    .bind(classId, user.id)
    .first<{ id: number }>();

  if (!managedClass) {
    return { success: false, error: "You do not have access to this class." };
  }

  const enrollment = await getClassEnrollment(classId, studentId);

  if (!enrollment) {
    return {
      success: false,
      error: "Student is not enrolled in this class.",
    };
  }

  if (enrollment.enrollment_status !== "ACTIVE") {
    return {
      success: false,
      error: "Portal PINs can only be managed for active students.",
    };
  }

  return {
    success: true,
    accountExists: enrollment.account_student_id !== null,
  };
}

function revalidateStudentRoster(classId: number, studentId: number): void {
  revalidatePath(`/classes/${classId}/students`);
  revalidatePath(`/classes/${classId}/students/${studentId}`);
}

export async function generateStudentPortalPin(
  classId: number,
  studentId: number
): Promise<StudentPinActionResult> {
  const authorization = await authorizeActiveStudent(classId, studentId);

  if (!authorization.success) {
    return authorization;
  }

  if (authorization.accountExists) {
    return {
      success: false,
      error: "A student portal account already exists for this student.",
    };
  }

  const pin = generateSixDigitPin();
  const pinHash = await hashStudentPin(pin);
  const { env } = getCloudflareContext();

  try {
    const result = await env.DB.prepare(
      `
        INSERT INTO student_accounts (id, student_id, pin_hash)
        VALUES (?1, ?2, ?3)
      `
    )
      .bind(crypto.randomUUID(), studentId, pinHash)
      .run();

    if (!result.success || result.meta.changes !== 1) {
      return { success: false, error: "Could not generate the student PIN." };
    }
  } catch (error) {
    if (isUniqueStudentAccountError(error)) {
      return {
        success: false,
        error: "A student portal account already exists for this student.",
      };
    }

    return { success: false, error: "Could not generate the student PIN." };
  }

  revalidateStudentRoster(classId, studentId);
  return { success: true, pin };
}

export async function resetStudentPortalPin(
  classId: number,
  studentId: number
): Promise<StudentPinActionResult> {
  const authorization = await authorizeActiveStudent(classId, studentId);

  if (!authorization.success) {
    return authorization;
  }

  if (!authorization.accountExists) {
    return { success: false, error: "Student portal account not found." };
  }

  const pin = generateSixDigitPin();
  const pinHash = await hashStudentPin(pin);
  const { env } = getCloudflareContext();

  try {
    const [accountResult, sessionResult] = await env.DB.batch([
      env.DB.prepare(
        `
          UPDATE student_accounts
          SET pin_hash = ?1, updated_at = CURRENT_TIMESTAMP
          WHERE student_id = ?2
        `
      ).bind(pinHash, studentId),
      env.DB.prepare(
        "DELETE FROM student_sessions WHERE student_id = ?1"
      ).bind(studentId),
    ]);

    if (!accountResult.success || accountResult.meta.changes !== 1) {
      return { success: false, error: "Student portal account not found." };
    }

    if (!sessionResult.success) {
      return { success: false, error: "Could not reset the student PIN." };
    }
  } catch {
    return { success: false, error: "Could not reset the student PIN." };
  }

  revalidateStudentRoster(classId, studentId);
  return { success: true, pin };
}
