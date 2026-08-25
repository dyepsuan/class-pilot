"use server";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { revalidatePath } from "next/cache";

import { getInstructorManagedClass } from "@/lib/auth/instructor-class";
import { requireUser } from "@/lib/auth/session";
import {
  generateStudentSetupToken,
  getStudentSetupTokenExpiry,
  getStudentSetupTokenStatus,
  hashStudentSetupToken,
} from "@/lib/auth/student-setup-token";

type SetupStudentRow = {
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
  enrollment_status: string;
  account_student_id: number | null;
  delivery_pending: number;
};

type ActiveSetupTokenRow = {
  id: string;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
};

export type GenerateStudentSetupLinkResult =
  | {
      success: true;
      setupPath: string;
      expiresAt: string;
    }
  | { success: false; error: string };

export type RevokeStudentSetupLinkResult =
  | { success: true }
  | { success: false; error: string };

function isValidId(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

async function getSetupStudent(
  classId: number,
  studentId: number
): Promise<SetupStudentRow | null> {
  const { env } = getCloudflareContext();

  return env.DB.prepare(
    `
      SELECT
        s.first_name,
        s.middle_name,
        s.last_name,
        s.suffix,
        e.status AS enrollment_status,
        sa.student_id AS account_student_id,
        EXISTS (
          SELECT 1
          FROM student_setup_link_deliveries pending_delivery
          WHERE pending_delivery.student_id = s.id
            AND pending_delivery.class_id = e.class_id
            AND pending_delivery.status = 'PENDING'
        ) AS delivery_pending
      FROM enrollments e
      INNER JOIN students s ON s.id = e.student_id
      LEFT JOIN student_accounts sa ON sa.student_id = s.id
      WHERE e.class_id = ?1
        AND e.student_id = ?2
      LIMIT 1
    `
  )
    .bind(classId, studentId)
    .first<SetupStudentRow>();
}

async function authorizeSetupStudent(
  classId: number,
  studentId: number
): Promise<
  | { success: true; userId: number; student: SetupStudentRow }
  | { success: false; error: string }
> {
  if (!isValidId(classId) || !isValidId(studentId)) {
    return { success: false, error: "Invalid setup-link request." };
  }

  const user = await requireUser();
  const managedClass = await getInstructorManagedClass(classId, user);

  if (!managedClass) {
    return { success: false, error: "Class not found or access denied." };
  }

  const student = await getSetupStudent(classId, studentId);

  if (!student || student.enrollment_status !== "ACTIVE") {
    return {
      success: false,
      error: "Student is not eligible for an account setup link.",
    };
  }

  if (student.delivery_pending === 1) {
    return {
      success: false,
      error: "A Gmail setup-link delivery is already in progress for this student.",
    };
  }

  return { success: true, userId: user.id, student };
}

function revalidateSetupLinks(classId: number): void {
  revalidatePath(`/classes/${classId}/students`);
  revalidatePath(`/classes/${classId}/students/setup-links`);
}

export async function generateStudentSetupLink(
  classId: number,
  studentId: number
): Promise<GenerateStudentSetupLinkResult> {
  const authorization = await authorizeSetupStudent(classId, studentId);

  if (!authorization.success) {
    return authorization;
  }

  if (authorization.student.account_student_id !== null) {
    return {
      success: false,
      error: "This student already has an active portal account.",
    };
  }

  const rawToken = generateStudentSetupToken();
  const tokenHash = await hashStudentSetupToken(rawToken);
  const now = new Date();
  const createdAt = now.toISOString();
  const expiresAt = getStudentSetupTokenExpiry(now.getTime()).toISOString();
  const { env } = getCloudflareContext();

  try {
    const [, insertResult] = await env.DB.batch([
      env.DB.prepare(
        `
          UPDATE student_setup_tokens
          SET revoked_at = ?1
          WHERE student_id = ?2
            AND purpose = 'INITIAL_SETUP'
            AND used_at IS NULL
            AND revoked_at IS NULL
        `
      ).bind(createdAt, studentId),
      env.DB.prepare(
        `
          INSERT INTO student_setup_tokens (
            id,
            student_id,
            class_id,
            token_hash,
            purpose,
            created_by,
            created_at,
            expires_at
          )
          VALUES (?1, ?2, ?3, ?4, 'INITIAL_SETUP', ?5, ?6, ?7)
        `
      ).bind(
        crypto.randomUUID(),
        studentId,
        classId,
        tokenHash,
        authorization.userId,
        createdAt,
        expiresAt
      ),
    ]);

    if (!insertResult.success || insertResult.meta.changes !== 1) {
      return { success: false, error: "Could not generate the setup link." };
    }
  } catch {
    return { success: false, error: "Could not generate the setup link." };
  }

  revalidateSetupLinks(classId);

  return {
    success: true,
    setupPath: `/student/setup?token=${encodeURIComponent(rawToken)}`,
    expiresAt,
  };
}

export async function revokeStudentSetupLink(
  classId: number,
  studentId: number
): Promise<RevokeStudentSetupLinkResult> {
  const authorization = await authorizeSetupStudent(classId, studentId);

  if (!authorization.success) {
    return authorization;
  }

  const { env } = getCloudflareContext();
  const activeToken = await env.DB.prepare(
    `
      SELECT id, expires_at, used_at, revoked_at
      FROM student_setup_tokens
      WHERE student_id = ?1
        AND purpose = 'INITIAL_SETUP'
        AND used_at IS NULL
        AND revoked_at IS NULL
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `
  )
    .bind(studentId)
    .first<ActiveSetupTokenRow>();

  if (
    !activeToken ||
    getStudentSetupTokenStatus(activeToken) !== "ACTIVE"
  ) {
    return { success: false, error: "No active setup link was found." };
  }

  const revokedAt = new Date().toISOString();

  try {
    const result = await env.DB.prepare(
      `
        UPDATE student_setup_tokens
        SET revoked_at = ?1
        WHERE id = ?2
          AND student_id = ?3
          AND purpose = 'INITIAL_SETUP'
          AND used_at IS NULL
          AND revoked_at IS NULL
          AND expires_at > ?1
      `
    )
      .bind(revokedAt, activeToken.id, studentId)
      .run();

    if (!result.success || result.meta.changes !== 1) {
      return { success: false, error: "The setup link is no longer active." };
    }
  } catch {
    return { success: false, error: "Could not revoke the setup link." };
  }

  revalidateSetupLinks(classId);
  return { success: true };
}
