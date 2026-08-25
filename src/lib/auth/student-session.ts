import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const STUDENT_SESSION_COOKIE_NAME = "class_pilot_student_session";

const STUDENT_SESSION_SECONDS = 60 * 60 * 24 * 7;
const SESSION_TOKEN_BYTES = 32;

export type AuthenticatedStudent = {
  id: number;
  studentNumber: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  email: string | null;
};

type StudentSessionRow = {
  id: number;
  student_number: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
  email: string | null;
  expires_at: string;
};

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

async function hashStudentSessionToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token)
  );

  return bytesToBase64Url(new Uint8Array(digest));
}

function toAuthenticatedStudent(row: StudentSessionRow): AuthenticatedStudent {
  return {
    id: row.id,
    studentNumber: row.student_number,
    firstName: row.first_name,
    middleName: row.middle_name,
    lastName: row.last_name,
    suffix: row.suffix,
    email: row.email,
  };
}

export async function createStudentSession(studentId: number): Promise<void> {
  const token = bytesToBase64Url(
    crypto.getRandomValues(new Uint8Array(SESSION_TOKEN_BYTES))
  );
  const tokenHash = await hashStudentSessionToken(token);
  const expiresAt = new Date(Date.now() + STUDENT_SESSION_SECONDS * 1000);
  const { env } = getCloudflareContext();

  await env.DB.prepare(
    `
      INSERT INTO student_sessions (
        id, student_id, session_token_hash, expires_at
      )
      VALUES (?1, ?2, ?3, ?4)
    `
  )
    .bind(crypto.randomUUID(), studentId, tokenHash, expiresAt.toISOString())
    .run();

  const cookieStore = await cookies();
  cookieStore.set(STUDENT_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/student",
    secure: process.env.NODE_ENV === "production",
    maxAge: STUDENT_SESSION_SECONDS,
    expires: expiresAt,
  });
}

export async function getStudentSession(): Promise<AuthenticatedStudent | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(STUDENT_SESSION_COOKIE_NAME)?.value;

  if (!token || token.length > 512) {
    return null;
  }

  const tokenHash = await hashStudentSessionToken(token);
  const { env } = getCloudflareContext();
  const row = await env.DB.prepare(
    `
      SELECT
        st.id,
        st.student_number,
        st.first_name,
        st.middle_name,
        st.last_name,
        st.suffix,
        st.email,
        ss.expires_at
      FROM student_sessions ss
      INNER JOIN students st ON st.id = ss.student_id
      WHERE ss.session_token_hash = ?1
        AND EXISTS (
          SELECT 1
          FROM enrollments e
          INNER JOIN classes c ON c.id = e.class_id
          WHERE e.student_id = st.id
            AND e.status = 'ACTIVE'
            AND c.status = 'ACTIVE'
        )
      LIMIT 1
    `
  )
    .bind(tokenHash)
    .first<StudentSessionRow>();

  if (!row) {
    return null;
  }

  const expiresAt = Date.parse(row.expires_at);

  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    try {
      await env.DB.prepare(
        "DELETE FROM student_sessions WHERE session_token_hash = ?1"
      )
        .bind(tokenHash)
        .run();
    } catch {
      // The expired session remains invalid if cleanup is unavailable.
    }

    return null;
  }

  return toAuthenticatedStudent(row);
}

export async function requireStudent(): Promise<AuthenticatedStudent> {
  const student = await getStudentSession();

  if (!student) {
    redirect("/student/login");
  }

  return student;
}

export async function destroyStudentSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(STUDENT_SESSION_COOKIE_NAME)?.value;

  try {
    if (token && token.length <= 512) {
      const tokenHash = await hashStudentSessionToken(token);
      const { env } = getCloudflareContext();

      await env.DB.prepare(
        "DELETE FROM student_sessions WHERE session_token_hash = ?1"
      )
        .bind(tokenHash)
        .run();
    }
  } finally {
    cookieStore.set(STUDENT_SESSION_COOKIE_NAME, "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/student",
      secure: process.env.NODE_ENV === "production",
      maxAge: 0,
      expires: new Date(0),
    });
  }
}
