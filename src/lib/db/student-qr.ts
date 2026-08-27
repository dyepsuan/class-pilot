import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  buildStudentQrPayload,
  hashStudentQrPayload,
} from "@/lib/qr/student-qr";

export type StudentQrCredential = {
  id: number;
  student_id: number;
  token_hash: string;
  issued_at: string;
  revoked_at: string | null;
};

export async function getActiveStudentQrCredential(
  studentId: number
): Promise<StudentQrCredential | null> {
  const { env } = getCloudflareContext();

  return env.DB.prepare(
    `
      SELECT
        id,
        student_id,
        token_hash,
        issued_at,
        revoked_at
      FROM student_qr_credentials
      WHERE student_id = ?1
        AND revoked_at IS NULL
      ORDER BY id DESC
      LIMIT 1
    `
  )
    .bind(studentId)
    .first<StudentQrCredential>();
}

export async function issueStudentQrCredential(
  studentId: number
) {
  const { env } = getCloudflareContext();

  const existing =
    await getActiveStudentQrCredential(
      studentId
    );

  if (existing) {
    return existing;
  }

  const temporaryHash =
    await hashStudentQrPayload(
      `pending:${crypto.randomUUID()}`
    );

  const result = await env.DB.prepare(
    `
      INSERT INTO student_qr_credentials (
        student_id,
        token_hash
      )
      VALUES (?1, ?2)
    `
  )
    .bind(
      studentId,
      temporaryHash
    )
    .run();

  const credentialId =
    Number(result.meta.last_row_id);

  const payload =
    await buildStudentQrPayload(
      credentialId,
      studentId,
      env.QR_SIGNING_SECRET
    );

  const tokenHash =
    await hashStudentQrPayload(payload);

  await env.DB.prepare(
    `
      UPDATE student_qr_credentials
      SET token_hash = ?1
      WHERE id = ?2
    `
  )
    .bind(
      tokenHash,
      credentialId
    )
    .run();

  return {
    id: credentialId,
    student_id: studentId,
    token_hash: tokenHash,
    issued_at:
      new Date().toISOString(),
    revoked_at: null,
  };
}

export async function getActiveStudentQrPayload(
  studentId: number
) {
  const { env } = getCloudflareContext();

  const credential =
    await getActiveStudentQrCredential(
      studentId
    );

  if (!credential) {
    return null;
  }

  const payload =
    await buildStudentQrPayload(
      credential.id,
      credential.student_id,
      env.QR_SIGNING_SECRET
    );

  return {
    credential,
    payload,
  };
}

export async function getOrIssueActiveStudentQrPayload(
  studentId: number
) {
  const { env } = getCloudflareContext();
  const credential = await issueStudentQrCredential(studentId);
  const payload = await buildStudentQrPayload(
    credential.id,
    credential.student_id,
    env.QR_SIGNING_SECRET
  );

  return {
    credential,
    payload,
  };
}
