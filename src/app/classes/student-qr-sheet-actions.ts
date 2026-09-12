"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/session";
import {
  getActiveStudentQrPayload,
  issueStudentQrCredential,
} from "@/lib/db/student-qr";
import { getStudentEnrollmentByStudentId } from "@/lib/db/students";

export type StudentQrSheetResult = {
  payload: string | null;
  error?: string;
};

async function getEnrolledStudent(classId: number, studentId: number) {
  if (!Number.isInteger(classId) || classId <= 0) {
    return { error: "Invalid class." } as const;
  }

  if (!Number.isInteger(studentId) || studentId <= 0) {
    return { error: "Invalid student." } as const;
  }

  const student = await getStudentEnrollmentByStudentId(classId, studentId);

  if (!student || student.student_id !== studentId) {
    return { error: "Student enrollment not found." } as const;
  }

  return { student } as const;
}

export async function getStudentQrForSheet(
  classId: number,
  studentId: number
): Promise<StudentQrSheetResult> {
  await requireUser();

  const enrollment = await getEnrolledStudent(classId, studentId);

  if ("error" in enrollment) {
    return { payload: null, error: enrollment.error };
  }

  const qr = await getActiveStudentQrPayload(enrollment.student.student_id);

  return { payload: qr?.payload ?? null };
}

export async function generateStudentQrForSheet(
  classId: number,
  studentId: number
): Promise<StudentQrSheetResult> {
  await requireUser();

  const enrollment = await getEnrolledStudent(classId, studentId);

  if ("error" in enrollment) {
    return { payload: null, error: enrollment.error };
  }

  await issueStudentQrCredential(enrollment.student.student_id);
  const qr = await getActiveStudentQrPayload(enrollment.student.student_id);

  if (!qr) {
    return { payload: null, error: "Unable to generate QR code. Please try again." };
  }

  revalidatePath(`/classes/${classId}/students/${studentId}/qr`);

  return { payload: qr.payload };
}
