"use server";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { redirect } from "next/navigation";

import { verifyStudentPin } from "@/lib/auth/student-pin";
import { createStudentSession } from "@/lib/auth/student-session";

export type StudentLoginState = {
  error: string | null;
};

type StudentLoginRow = {
  student_id: number;
  pin_hash: string;
};

export async function studentLogin(
  _previousState: StudentLoginState,
  formData: FormData
): Promise<StudentLoginState> {
  const studentNumberValue = formData.get("student_number");
  const pinValue = formData.get("pin");

  if (
    typeof studentNumberValue !== "string" ||
    typeof pinValue !== "string" ||
    studentNumberValue.trim() === "" ||
    pinValue === ""
  ) {
    return { error: "Enter your student number and PIN." };
  }

  const studentNumber = studentNumberValue.trim().toUpperCase();

  try {
    const { env } = getCloudflareContext();
    const account = await env.DB.prepare(
      `
        SELECT sa.student_id, sa.pin_hash
        FROM student_accounts sa
        INNER JOIN students s ON s.id = sa.student_id
        WHERE s.student_number = ?1 COLLATE NOCASE
          AND EXISTS (
            SELECT 1
            FROM enrollments e
            INNER JOIN classes c ON c.id = e.class_id
            WHERE e.student_id = s.id
              AND e.status = 'ACTIVE'
              AND c.status = 'ACTIVE'
          )
        LIMIT 1
      `
    )
      .bind(studentNumber)
      .first<StudentLoginRow>();

    if (!account || !(await verifyStudentPin(pinValue, account.pin_hash))) {
      return { error: "Invalid student number or PIN." };
    }

    await createStudentSession(account.student_id);
  } catch {
    console.error("[Class-pilot student login] Authentication is unavailable.");
    return { error: "Unable to sign in right now. Please try again." };
  }

  redirect("/student");
}
