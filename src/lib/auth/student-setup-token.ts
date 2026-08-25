import "server-only";

export const STUDENT_SETUP_LINK_TTL_HOURS = 48;

const STUDENT_SETUP_TOKEN_BYTES = 32;
const encoder = new TextEncoder();

export type StudentSetupTokenStatus =
  | "ACTIVE"
  | "EXPIRED"
  | "REVOKED"
  | "USED";

export type StudentSetupTokenMetadata = {
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
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

function parseDatabaseTimestamp(value: string): number {
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/u.test(value)
    ? `${value.replace(" ", "T")}Z`
    : value;

  return Date.parse(normalized);
}

export function generateStudentSetupToken(): string {
  return bytesToBase64Url(
    crypto.getRandomValues(new Uint8Array(STUDENT_SETUP_TOKEN_BYTES))
  );
}

export async function hashStudentSetupToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return bytesToBase64Url(new Uint8Array(digest));
}

export function getStudentSetupTokenExpiry(now = Date.now()): Date {
  return new Date(
    now + STUDENT_SETUP_LINK_TTL_HOURS * 60 * 60 * 1000
  );
}

export function getStudentSetupTokenStatus(
  token: StudentSetupTokenMetadata,
  now = Date.now()
): StudentSetupTokenStatus {
  if (token.used_at) {
    return "USED";
  }

  if (token.revoked_at) {
    return "REVOKED";
  }

  const expiresAt = parseDatabaseTimestamp(token.expires_at);

  if (!Number.isFinite(expiresAt) || expiresAt <= now) {
    return "EXPIRED";
  }

  return "ACTIVE";
}

export function isStudentSetupTokenValid(
  token: StudentSetupTokenMetadata,
  now = Date.now()
): boolean {
  return getStudentSetupTokenStatus(token, now) === "ACTIVE";
}
