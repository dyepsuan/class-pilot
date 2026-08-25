import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const SESSION_COOKIE_NAME = "class_pilot_session";

const NORMAL_SESSION_SECONDS = 60 * 60 * 24 * 7;
const REMEMBERED_SESSION_SECONDS = 60 * 60 * 24 * 30;
const SESSION_TOKEN_BYTES = 32;

export type AuthUser = {
  id: number;
  email: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
};

type AuthUserRow = {
  id: number;
  email: string;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
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

async function hashSessionToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token)
  );

  return bytesToBase64Url(new Uint8Array(digest));
}

function toAuthUser(row: AuthUserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    firstName: row.first_name,
    lastName: row.last_name,
    role: row.role,
  };
}

export async function createSession(
  userId: string,
  rememberMe: boolean
): Promise<void> {
  const token = bytesToBase64Url(
    crypto.getRandomValues(new Uint8Array(SESSION_TOKEN_BYTES))
  );
  const tokenHash = await hashSessionToken(token);
  const maxAge = rememberMe
    ? REMEMBERED_SESSION_SECONDS
    : NORMAL_SESSION_SECONDS;
  const expiresAt = new Date(Date.now() + maxAge * 1000);
  const { env } = getCloudflareContext();

  await env.DB.prepare(
    `
      INSERT INTO auth_sessions (id, user_id, token_hash, expires_at)
      VALUES (?1, ?2, ?3, ?4)
    `
  )
    .bind(crypto.randomUUID(), userId, tokenHash, expiresAt.toISOString())
    .run();

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge,
    expires: expiresAt,
  });
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token || token.length > 512) {
    return null;
  }

  const tokenHash = await hashSessionToken(token);
  const { env } = getCloudflareContext();
  const row = await env.DB.prepare(
    `
      SELECT
        u.id,
        u.email,
        u.display_name,
        u.first_name,
        u.last_name,
        u.role,
        s.expires_at
      FROM auth_sessions s
      INNER JOIN users u ON u.auth_id = s.user_id
      WHERE s.token_hash = ?1
      LIMIT 1
    `
  )
    .bind(tokenHash)
    .first<AuthUserRow>();

  if (!row) {
    return null;
  }

  const expiresAt = Date.parse(row.expires_at);

  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    try {
      await env.DB.prepare(
        "DELETE FROM auth_sessions WHERE token_hash = ?1"
      )
        .bind(tokenHash)
        .run();
    } catch {
      // Expired sessions remain invalid even if opportunistic cleanup fails.
    }

    return null;
  }

  return toAuthUser(row);
}

export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  try {
    if (token && token.length <= 512) {
      const tokenHash = await hashSessionToken(token);
      const { env } = getCloudflareContext();

      await env.DB.prepare(
        "DELETE FROM auth_sessions WHERE token_hash = ?1"
      )
        .bind(tokenHash)
        .run();
    }
  } finally {
    cookieStore.set(SESSION_COOKIE_NAME, "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 0,
      expires: new Date(0),
    });
  }
}
