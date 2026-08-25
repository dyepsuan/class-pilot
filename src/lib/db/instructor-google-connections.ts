import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

export type InstructorGoogleConnection = {
  id: string;
  instructorId: number;
  googleEmail: string;
  googleSubject: string;
  refreshTokenCiphertext: string;
  refreshTokenIv: string;
  encryptionVersion: 1;
  scope: string;
  revokedAt: string | null;
};

type ConnectionRow = {
  id: string;
  instructor_id: number;
  google_email: string;
  google_subject: string;
  refresh_token_ciphertext: string;
  refresh_token_iv: string;
  encryption_version: 1;
  scope: string;
  revoked_at: string | null;
};

function toConnection(row: ConnectionRow): InstructorGoogleConnection {
  return {
    id: row.id,
    instructorId: row.instructor_id,
    googleEmail: row.google_email,
    googleSubject: row.google_subject,
    refreshTokenCiphertext: row.refresh_token_ciphertext,
    refreshTokenIv: row.refresh_token_iv,
    encryptionVersion: row.encryption_version,
    scope: row.scope,
    revokedAt: row.revoked_at,
  };
}

export async function getInstructorGoogleConnection(
  instructorId: number,
  includeRevoked = false
): Promise<InstructorGoogleConnection | null> {
  const { env } = getCloudflareContext();
  const row = await env.DB.prepare(
    `
      SELECT *
      FROM instructor_google_connections
      WHERE instructor_id = ?1
        AND (?2 = 1 OR revoked_at IS NULL)
      LIMIT 1
    `
  )
    .bind(instructorId, includeRevoked ? 1 : 0)
    .first<ConnectionRow>();
  return row ? toConnection(row) : null;
}

export async function saveInstructorGoogleConnection({
  instructorId,
  googleEmail,
  googleSubject,
  refreshTokenCiphertext,
  refreshTokenIv,
  encryptionVersion,
  scope,
}: Omit<InstructorGoogleConnection, "id" | "revokedAt">): Promise<void> {
  const { env } = getCloudflareContext();
  const now = new Date().toISOString();
  await env.DB.prepare(
    `
      INSERT INTO instructor_google_connections (
        id, instructor_id, google_email, google_subject,
        refresh_token_ciphertext, refresh_token_iv,
        encryption_version, scope, created_at, updated_at, revoked_at
      )
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9, NULL)
      ON CONFLICT(instructor_id) DO UPDATE SET
        google_email = excluded.google_email,
        google_subject = excluded.google_subject,
        refresh_token_ciphertext = excluded.refresh_token_ciphertext,
        refresh_token_iv = excluded.refresh_token_iv,
        encryption_version = excluded.encryption_version,
        scope = excluded.scope,
        updated_at = excluded.updated_at,
        revoked_at = NULL
    `
  )
    .bind(
      crypto.randomUUID(), instructorId, googleEmail, googleSubject,
      refreshTokenCiphertext, refreshTokenIv, encryptionVersion, scope, now
    )
    .run();
}

export async function disconnectInstructorGoogleConnection(
  instructorId: number
): Promise<void> {
  const { env } = getCloudflareContext();
  await env.DB.prepare(
    `
      UPDATE instructor_google_connections
      SET refresh_token_ciphertext = '',
          refresh_token_iv = '',
          revoked_at = ?1,
          updated_at = ?1
      WHERE instructor_id = ?2
        AND revoked_at IS NULL
    `
  )
    .bind(new Date().toISOString(), instructorId)
    .run();
}
