import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

import { getStudentSetupTokenStatus } from "@/lib/auth/student-setup-token";
import type { StudentSetupUnavailableState } from "@/lib/student-setup-types";

export type ValidInitialStudentSetup = {
  state: "VALID";
  tokenId: string;
  classId: number;
  student: {
    studentNumber: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    suffix: string | null;
  };
  classItem: {
    subjectCode: string;
    subjectName: string;
    section: string;
  };
};

export type InitialStudentSetupResolution =
  | ValidInitialStudentSetup
  | { state: StudentSetupUnavailableState };

type InitialStudentSetupRow = {
  token_id: string;
  purpose: string;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  student_id: number | null;
  student_number: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  suffix: string | null;
  class_id: number | null;
  subject_code: string | null;
  subject_name: string | null;
  section: string | null;
  class_status: string | null;
  enrollment_status: string | null;
  account_student_id: number | null;
};

export async function resolveInitialStudentSetupToken(
  tokenHash: string,
  now = Date.now()
): Promise<InitialStudentSetupResolution> {
  const { env } = getCloudflareContext();
  const row = await env.DB.prepare(
    `
      SELECT
        st.id AS token_id,
        st.purpose,
        st.expires_at,
        st.used_at,
        st.revoked_at,
        s.id AS student_id,
        s.student_number,
        s.first_name,
        s.middle_name,
        s.last_name,
        s.suffix,
        c.id AS class_id,
        c.subject_code,
        c.subject_name,
        c.section,
        c.status AS class_status,
        e.status AS enrollment_status,
        sa.student_id AS account_student_id
      FROM student_setup_tokens st
      LEFT JOIN students s ON s.id = st.student_id
      LEFT JOIN classes c ON c.id = st.class_id
      LEFT JOIN enrollments e
        ON e.class_id = st.class_id
        AND e.student_id = st.student_id
      LEFT JOIN student_accounts sa ON sa.student_id = st.student_id
      WHERE st.token_hash = ?1
      LIMIT 1
    `
  )
    .bind(tokenHash)
    .first<InitialStudentSetupRow>();

  if (!row || row.purpose !== "INITIAL_SETUP") {
    return { state: "INVALID" };
  }

  const tokenStatus = getStudentSetupTokenStatus(row, now);

  if (tokenStatus === "USED") {
    return { state: "USED" };
  }

  if (tokenStatus === "REVOKED") {
    return { state: "REVOKED" };
  }

  if (tokenStatus === "EXPIRED") {
    return { state: "EXPIRED" };
  }

  if (
    row.student_id === null ||
    row.class_id === null ||
    !row.student_number ||
    !row.first_name ||
    !row.last_name ||
    !row.subject_code ||
    !row.subject_name ||
    !row.section ||
    row.class_status !== "ACTIVE" ||
    row.enrollment_status !== "ACTIVE"
  ) {
    return { state: "UNAVAILABLE" };
  }

  if (row.account_student_id !== null) {
    return { state: "ACCOUNT_ACTIVE" };
  }

  return {
    state: "VALID",
    tokenId: row.token_id,
    classId: row.class_id,
    student: {
      studentNumber: row.student_number,
      firstName: row.first_name,
      middleName: row.middle_name,
      lastName: row.last_name,
      suffix: row.suffix,
    },
    classItem: {
      subjectCode: row.subject_code,
      subjectName: row.subject_name,
      section: row.section,
    },
  };
}

export type CompleteInitialStudentSetupResult =
  | { success: true }
  | {
      success: false;
      state: StudentSetupUnavailableState | "ERROR";
    };

export async function completeInitialStudentSetup({
  tokenHash,
  pinHash,
  completedAt,
}: {
  tokenHash: string;
  pinHash: string;
  completedAt: string;
}): Promise<CompleteInitialStudentSetupResult> {
  const { env } = getCloudflareContext();

  try {
    const [tokenResult, accountResult] = await env.DB.batch([
      env.DB.prepare(
        `
          UPDATE student_setup_tokens
          SET used_at = ?1
          WHERE token_hash = ?2
            AND purpose = 'INITIAL_SETUP'
            AND used_at IS NULL
            AND revoked_at IS NULL
            AND expires_at > ?1
            AND EXISTS (
              SELECT 1
              FROM students s
              INNER JOIN classes c
                ON c.id = student_setup_tokens.class_id
              INNER JOIN enrollments e
                ON e.class_id = student_setup_tokens.class_id
                AND e.student_id = student_setup_tokens.student_id
              WHERE s.id = student_setup_tokens.student_id
                AND c.status = 'ACTIVE'
                AND e.status = 'ACTIVE'
                AND NOT EXISTS (
                  SELECT 1
                  FROM student_accounts existing_account
                  WHERE existing_account.student_id = student_setup_tokens.student_id
                )
            )
        `
      ).bind(completedAt, tokenHash),
      env.DB.prepare(
        `
          INSERT INTO student_accounts (
            id,
            student_id,
            pin_hash,
            created_at,
            updated_at
          )
          VALUES (
            ?1,
            (
              SELECT st.student_id
              FROM student_setup_tokens st
              INNER JOIN students s ON s.id = st.student_id
              INNER JOIN classes c ON c.id = st.class_id
              INNER JOIN enrollments e
                ON e.class_id = st.class_id
                AND e.student_id = st.student_id
              WHERE st.token_hash = ?2
                AND st.purpose = 'INITIAL_SETUP'
                AND st.used_at = ?3
                AND st.revoked_at IS NULL
                AND st.expires_at > ?3
                AND c.status = 'ACTIVE'
                AND e.status = 'ACTIVE'
                AND NOT EXISTS (
                  SELECT 1
                  FROM student_accounts existing_account
                  WHERE existing_account.student_id = st.student_id
                )
              LIMIT 1
            ),
            ?4,
            ?3,
            ?3
          )
        `
      ).bind(crypto.randomUUID(), tokenHash, completedAt, pinHash),
    ]);

    if (
      tokenResult.success &&
      tokenResult.meta.changes === 1 &&
      accountResult.success &&
      accountResult.meta.changes === 1
    ) {
      return { success: true };
    }
  } catch {
    // A failed statement rolls back the entire D1 batch. Resolve the safe
    // public state below without exposing database or credential details.
  }

  try {
    const resolution = await resolveInitialStudentSetupToken(tokenHash);

    if (resolution.state !== "VALID") {
      return { success: false, state: resolution.state };
    }
  } catch {
    // Fall through to the generic availability response.
  }

  return { success: false, state: "ERROR" };
}
