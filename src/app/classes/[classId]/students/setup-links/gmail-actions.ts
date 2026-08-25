"use server";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { revalidatePath } from "next/cache";

import {
  getGmailConfiguration,
  GoogleOAuthError,
  refreshGoogleAccessToken,
  revokeGoogleToken,
} from "@/lib/auth/google-oauth";
import { getInstructorManagedClass } from "@/lib/auth/instructor-class";
import { requireUser } from "@/lib/auth/session";
import {
  generateStudentSetupToken,
  getStudentSetupTokenExpiry,
  hashStudentSetupToken,
} from "@/lib/auth/student-setup-token";
import { decryptGoogleRefreshToken } from "@/lib/auth/token-encryption";
import {
  disconnectInstructorGoogleConnection,
  getInstructorGoogleConnection,
} from "@/lib/db/instructor-google-connections";
import {
  compensateFailedSetupLinkDelivery,
  finalizeSetupLinkDelivery,
  prepareSetupLinkDelivery,
} from "@/lib/db/student-setup-deliveries";
import { sendGmailMessage } from "@/lib/gmail/gmail-client";
import { buildSetupLinkEmail } from "@/lib/gmail/setup-link-email";
import { isValidEmailAddress } from "@/lib/validation/email";

const MAX_RECIPIENTS_PER_REQUEST = 200;

type EligibleStudentRow = {
  id: number;
  student_number: string;
  first_name: string;
  email: string | null;
};

export type GmailRecipientResult = {
  studentId: number;
  status: "SENT" | "FAILED" | "SKIPPED";
  reason?:
    | "AUTH_REQUIRED"
    | "INVALID_RECIPIENT"
    | "RATE_LIMITED"
    | "PROVIDER_ERROR"
    | "NOT_ELIGIBLE";
};

export type SendStudentSetupLinksResult = {
  success: boolean;
  reconnectRequired: boolean;
  sent: number;
  failed: number;
  skipped: number;
  recipients: GmailRecipientResult[];
  error?: string;
};

export type DisconnectGmailResult =
  | { success: true }
  | { success: false; error: string };

function revalidateSetupLinks(classId: number): void {
  revalidatePath(`/classes/${classId}/students`);
  revalidatePath(`/classes/${classId}/students/setup-links`);
}

async function disconnectLocally(instructorId: number): Promise<void> {
  try {
    await disconnectInstructorGoogleConnection(instructorId);
  } catch {
    // A send still fails closed if local cleanup is temporarily unavailable.
  }
}

export async function disconnectGmailConnection(
  classId: number
): Promise<DisconnectGmailResult> {
  const user = await requireUser();
  const managedClass = await getInstructorManagedClass(classId, user);
  if (!managedClass) return { success: false, error: "Class not found or access denied." };

  const connection = await getInstructorGoogleConnection(user.id);
  if (connection) {
    try {
      const config = getGmailConfiguration();
      const refreshToken = await decryptGoogleRefreshToken(
        {
          ciphertext: connection.refreshTokenCiphertext,
          iv: connection.refreshTokenIv,
          encryptionVersion: connection.encryptionVersion,
        },
        config.encryptionKey,
        user.id
      );
      await revokeGoogleToken(refreshToken);
    } catch {
      // Clearing the local credential is authoritative.
    }
  }

  await disconnectInstructorGoogleConnection(user.id);
  revalidateSetupLinks(classId);
  return { success: true };
}

export async function sendStudentSetupLinks(
  classId: number,
  selectedStudentIds: number[]
): Promise<SendStudentSetupLinksResult> {
  const emptyResult = {
    reconnectRequired: false,
    sent: 0,
    failed: 0,
    skipped: 0,
    recipients: [] as GmailRecipientResult[],
  };
  const user = await requireUser();
  const managedClass = await getInstructorManagedClass(classId, user);
  if (!managedClass) {
    return { ...emptyResult, success: false, error: "Class not found or access denied." };
  }

  const ids = [...new Set(selectedStudentIds)].filter(
    (id) => Number.isInteger(id) && id > 0
  );
  if (ids.length === 0 || ids.length > MAX_RECIPIENTS_PER_REQUEST) {
    return { ...emptyResult, success: false, error: "Select between 1 and 200 students." };
  }

  let config;
  let connection;
  let accessToken: string;
  try {
    config = getGmailConfiguration();
    connection = await getInstructorGoogleConnection(user.id);
    if (!connection) {
      return {
        ...emptyResult,
        success: false,
        reconnectRequired: true,
        error: "Connect Gmail before sending setup links.",
      };
    }
    const refreshToken = await decryptGoogleRefreshToken(
      {
        ciphertext: connection.refreshTokenCiphertext,
        iv: connection.refreshTokenIv,
        encryptionVersion: connection.encryptionVersion,
      },
      config.encryptionKey,
      user.id
    );
    accessToken = await refreshGoogleAccessToken(refreshToken, config);
  } catch (error) {
    if (connection && (error instanceof GoogleOAuthError || error instanceof Error)) {
      await disconnectLocally(user.id);
    }
    return {
      ...emptyResult,
      success: false,
      reconnectRequired: true,
      error: "Gmail authorization has expired. Reconnect Gmail and try again.",
    };
  }

  const { env } = getCloudflareContext();
  const placeholders = ids.map((_, index) => `?${index + 2}`).join(", ");
  const roster = await env.DB.prepare(
    `
      SELECT s.id, s.student_number, s.first_name, s.email
      FROM students s
      INNER JOIN enrollments e ON e.student_id = s.id
      INNER JOIN classes c ON c.id = e.class_id
      LEFT JOIN student_accounts sa ON sa.student_id = s.id
      WHERE e.class_id = ?1
        AND e.status = 'ACTIVE'
        AND c.status = 'ACTIVE'
        AND sa.student_id IS NULL
        AND s.id IN (${placeholders})
    `
  )
    .bind(classId, ...ids)
    .all<EligibleStudentRow>();
  const byId = new Map(roster.results.map((student) => [student.id, student]));
  const recipients: GmailRecipientResult[] = [];
  const requestId = crypto.randomUUID();
  const className = `${managedClass.subject_code} — ${managedClass.subject_name}`;
  let authorizationFailed = false;

  for (const studentId of ids) {
    const student = byId.get(studentId);
    if (!student || !student.email || !isValidEmailAddress(student.email)) {
      recipients.push({ studentId, status: "SKIPPED", reason: "NOT_ELIGIBLE" });
      continue;
    }
    if (authorizationFailed) {
      recipients.push({ studentId, status: "SKIPPED", reason: "AUTH_REQUIRED" });
      continue;
    }

    const rawToken = generateStudentSetupToken();
    const tokenHash = await hashStudentSetupToken(rawToken);
    const createdAt = new Date().toISOString();
    const expiresAt = getStudentSetupTokenExpiry(Date.parse(createdAt)).toISOString();
    const prepared = await prepareSetupLinkDelivery({
      requestId,
      tokenId: crypto.randomUUID(),
      tokenHash,
      studentId,
      classId,
      instructorId: user.id,
      createdAt,
      expiresAt,
    });

    if (!prepared) {
      recipients.push({ studentId, status: "FAILED", reason: "PROVIDER_ERROR" });
      continue;
    }

    let rawMessage: string;
    try {
      const setupUrl = new URL(
        `/student/setup?token=${encodeURIComponent(rawToken)}`,
        config.appBaseUrl
      ).toString();
      rawMessage = buildSetupLinkEmail({
        recipientEmail: student.email,
        studentFirstName: student.first_name,
        studentNumber: student.student_number,
        className,
        setupUrl,
        instructorName: user.displayName,
      }).raw;
    } catch {
      await compensateFailedSetupLinkDelivery({
        ...prepared,
        errorCode: "INVALID_RECIPIENT",
      });
      recipients.push({ studentId, status: "FAILED", reason: "INVALID_RECIPIENT" });
      continue;
    }
    const sent = await sendGmailMessage(accessToken, rawMessage);

    if (sent.success) {
      const finalized = await finalizeSetupLinkDelivery(prepared.deliveryId, sent.messageId);
      if (!finalized) await finalizeSetupLinkDelivery(prepared.deliveryId, sent.messageId);
      recipients.push({ studentId, status: "SENT" });
      continue;
    }

    await compensateFailedSetupLinkDelivery({ ...prepared, errorCode: sent.errorCode });
    recipients.push({ studentId, status: "FAILED", reason: sent.errorCode });
    if (sent.errorCode === "AUTH_REQUIRED") {
      authorizationFailed = true;
      await disconnectLocally(user.id);
    }
  }

  revalidateSetupLinks(classId);
  const sentCount = recipients.filter((item) => item.status === "SENT").length;
  const failedCount = recipients.filter((item) => item.status === "FAILED").length;
  const skippedCount = recipients.filter((item) => item.status === "SKIPPED").length;
  return {
    success: sentCount > 0 && failedCount === 0 && skippedCount === 0,
    reconnectRequired: authorizationFailed,
    sent: sentCount,
    failed: failedCount,
    skipped: skippedCount,
    recipients,
  };
}
