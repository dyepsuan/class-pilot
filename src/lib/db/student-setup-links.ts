import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

import {
  getStudentSetupTokenStatus,
  type StudentSetupTokenStatus,
} from "@/lib/auth/student-setup-token";

export type StudentSetupLinkRosterItem = {
  studentId: number;
  studentNumber: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  email: string | null;
  hasPortalAccount: boolean;
  setupLink: {
    id: string;
    status: StudentSetupTokenStatus;
    createdAt: string;
    expiresAt: string;
  } | null;
  delivery: {
    status: "PENDING" | "SENT" | "FAILED";
    sentAt: string | null;
    errorCode: string | null;
  } | null;
};

type StudentSetupLinkRosterRow = {
  student_id: number;
  student_number: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
  email: string | null;
  account_student_id: number | null;
  setup_token_id: string | null;
  setup_created_at: string | null;
  setup_expires_at: string | null;
  setup_used_at: string | null;
  setup_revoked_at: string | null;
  delivery_status: "PENDING" | "SENT" | "FAILED" | null;
  delivery_sent_at: string | null;
  delivery_error_code: string | null;
};

export async function getStudentSetupLinkRoster(
  classId: number
): Promise<StudentSetupLinkRosterItem[]> {
  const { env } = getCloudflareContext();
  const result = await env.DB.prepare(
    `
      SELECT
        s.id AS student_id,
        s.student_number,
        s.first_name,
        s.middle_name,
        s.last_name,
        s.suffix,
        s.email,
        sa.student_id AS account_student_id,
        st.id AS setup_token_id,
        st.created_at AS setup_created_at,
        st.expires_at AS setup_expires_at,
        st.used_at AS setup_used_at,
        st.revoked_at AS setup_revoked_at,
        delivery.status AS delivery_status,
        delivery.sent_at AS delivery_sent_at,
        delivery.error_code AS delivery_error_code
      FROM enrollments e
      INNER JOIN students s ON s.id = e.student_id
      LEFT JOIN student_accounts sa ON sa.student_id = s.id
      LEFT JOIN student_setup_tokens st
        ON st.id = (
          SELECT latest.id
          FROM student_setup_tokens latest
          WHERE latest.student_id = s.id
            AND latest.purpose = 'INITIAL_SETUP'
          ORDER BY latest.created_at DESC, latest.id DESC
          LIMIT 1
        )
      LEFT JOIN student_setup_link_deliveries delivery
        ON delivery.id = (
          SELECT latest_delivery.id
          FROM student_setup_link_deliveries latest_delivery
          WHERE latest_delivery.student_id = s.id
            AND latest_delivery.class_id = e.class_id
            AND latest_delivery.provider = 'GMAIL'
          ORDER BY latest_delivery.created_at DESC, latest_delivery.id DESC
          LIMIT 1
        )
      WHERE e.class_id = ?1
        AND e.status = 'ACTIVE'
      ORDER BY s.last_name ASC, s.first_name ASC
    `
  )
    .bind(classId)
    .all<StudentSetupLinkRosterRow>();

  return result.results.map((row) => {
    const setupLink =
      row.setup_token_id && row.setup_created_at && row.setup_expires_at
        ? {
            id: row.setup_token_id,
            status: getStudentSetupTokenStatus({
              expires_at: row.setup_expires_at,
              used_at: row.setup_used_at,
              revoked_at: row.setup_revoked_at,
            }),
            createdAt: row.setup_created_at,
            expiresAt: row.setup_expires_at,
          }
        : null;

    return {
      studentId: row.student_id,
      studentNumber: row.student_number,
      firstName: row.first_name,
      middleName: row.middle_name,
      lastName: row.last_name,
      suffix: row.suffix,
      email: row.email,
      hasPortalAccount: row.account_student_id !== null,
      setupLink,
      delivery: row.delivery_status
        ? {
            status: row.delivery_status,
            sentAt: row.delivery_sent_at,
            errorCode: row.delivery_error_code,
          }
        : null,
    };
  });
}
