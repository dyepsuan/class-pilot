"use server";

import { issueStudentQrCredential } from "@/lib/db/student-qr";
import { getStudentEnrollmentByStudentId } from "@/lib/db/students";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/session";

export async function generateStudentQr(
  classId: number,
  studentId: number,
  _formData: FormData
) {
  await requireUser();

  const student =
    await getStudentEnrollmentByStudentId(
      classId,
      studentId
    );

  if (
    !student ||
    student.student_id !== studentId
  ) {
    throw new Error(
      "Student enrollment not found."
    );
  }

  await issueStudentQrCredential(
    studentId
  );

  const path =
    `/classes/${classId}/students/${studentId}/qr`;

  revalidatePath(path);

  redirect(path);
}
