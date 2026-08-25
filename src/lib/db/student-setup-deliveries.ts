import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

import type { GmailDeliveryErrorCode } from "@/lib/gmail/gmail-client";

export type PreparedSetupLinkDelivery = {
  deliveryId: string;
  setupTokenId: string;
  previousSetupTokenId: string | null;
};

type ActiveTokenRow = { id: string };

export async function prepareSetupLinkDelivery({
  requestId,
  tokenId,
  tokenHash,
  studentId,
  classId,
  instructorId,
  createdAt,
  expiresAt,
}: {
  requestId: string;
  tokenId: string;
  tokenHash: string;
  studentId: number;
  classId: number;
  instructorId: number;
  createdAt: string;
  expiresAt: string;
}): Promise<PreparedSetupLinkDelivery | null> {
  const { env } = getCloudflareContext();
  const previous = await env.DB.prepare(
    `
      SELECT id
      FROM student_setup_tokens
      WHERE student_id = ?1
        AND purpose = 'INITIAL_SETUP'
        AND used_at IS NULL
        AND revoked_at IS NULL
        AND expires_at > ?2
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `
  )
    .bind(studentId, createdAt)
    .first<ActiveTokenRow>();
  const deliveryId = crypto.randomUUID();

  try {
    const [, tokenResult, deliveryResult] = await env.DB.batch([
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
            id, student_id, class_id, token_hash, purpose,
            created_by, created_at, expires_at
          )
          SELECT ?1, s.id, ?2, ?3, 'INITIAL_SETUP', ?4, ?5, ?6
          FROM students s
          INNER JOIN enrollments e
            ON e.student_id = s.id
            AND e.class_id = ?2
            AND e.status = 'ACTIVE'
          INNER JOIN classes c ON c.id = e.class_id AND c.status = 'ACTIVE'
          LEFT JOIN student_accounts sa ON sa.student_id = s.id
          WHERE s.id = ?7
            AND sa.student_id IS NULL
        `
      ).bind(
        tokenId, classId, tokenHash, instructorId, createdAt, expiresAt, studentId
      ),
      env.DB.prepare(
        `
          INSERT INTO student_setup_link_deliveries (
            id, request_id, setup_token_id, previous_setup_token_id,
            student_id, class_id, instructor_id, provider, status, created_at
          )
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'GMAIL', 'PENDING', ?8)
        `
      ).bind(
        deliveryId,
        requestId,
        tokenId,
        previous?.id ?? null,
        studentId,
        classId,
        instructorId,
        createdAt
      ),
    ]);

    if (
      tokenResult.success &&
      tokenResult.meta.changes === 1 &&
      deliveryResult.success &&
      deliveryResult.meta.changes === 1
    ) {
      return {
        deliveryId,
        setupTokenId: tokenId,
        previousSetupTokenId: previous?.id ?? null,
      };
    }
  } catch {
    // The D1 batch rolls back all preparation statements on failure.
  }

  return null;
}

export async function finalizeSetupLinkDelivery(
  deliveryId: string,
  providerMessageId: string
): Promise<boolean> {
  const { env } = getCloudflareContext();
  const sentAt = new Date().toISOString();
  const result = await env.DB.prepare(
    `
      UPDATE student_setup_link_deliveries
      SET status = 'SENT', provider_message_id = ?1, sent_at = ?2
      WHERE id = ?3 AND status = 'PENDING'
    `
  )
    .bind(providerMessageId, sentAt, deliveryId)
    .run();
  return result.success && result.meta.changes === 1;
}

export async function compensateFailedSetupLinkDelivery({
  deliveryId,
  setupTokenId,
  previousSetupTokenId,
  errorCode,
}: PreparedSetupLinkDelivery & {
  errorCode: GmailDeliveryErrorCode;
}): Promise<void> {
  const { env } = getCloudflareContext();
  const failedAt = new Date().toISOString();
  const statements = [
    env.DB.prepare(
      `
        UPDATE student_setup_tokens
        SET revoked_at = COALESCE(revoked_at, ?1)
        WHERE id = ?2 AND used_at IS NULL
      `
    ).bind(failedAt, setupTokenId),
  ];

  if (previousSetupTokenId) {
    statements.push(
      env.DB.prepare(
        `
          UPDATE student_setup_tokens
          SET revoked_at = NULL
          WHERE id = ?1
            AND used_at IS NULL
            AND expires_at > ?2
            AND NOT EXISTS (
              SELECT 1
              FROM student_setup_tokens open_token
              WHERE open_token.student_id = student_setup_tokens.student_id
                AND open_token.id <> student_setup_tokens.id
                AND open_token.used_at IS NULL
                AND open_token.revoked_at IS NULL
            )
        `
      ).bind(previousSetupTokenId, failedAt)
    );
  }

  statements.push(
    env.DB.prepare(
      `
        UPDATE student_setup_link_deliveries
        SET status = 'FAILED', error_code = ?1
        WHERE id = ?2 AND status = 'PENDING'
      `
    ).bind(errorCode, deliveryId)
  );

  await env.DB.batch(statements);
}
