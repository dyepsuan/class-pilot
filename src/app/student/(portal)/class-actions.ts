"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { requireStudent } from "@/lib/auth/student-session";
import { getActiveStudentPortalClasses } from "@/lib/db/student-portal";
import { STUDENT_CLASS_COOKIE_NAME } from "@/lib/student-portal-class";

const STUDENT_CLASS_PREFERENCE_SECONDS = 60 * 60 * 24 * 365;

export async function selectStudentPortalClass(
  formData: FormData
): Promise<boolean> {
  const student = await requireStudent();
  const requestedClassId = Number(formData.get("classId"));

  if (!Number.isInteger(requestedClassId) || requestedClassId <= 0) {
    return false;
  }

  const classes = await getActiveStudentPortalClasses(student.id);
  const allowed = classes.some(
    (classItem) => classItem.id === requestedClassId
  );

  if (!allowed) {
    return false;
  }

  const cookieStore = await cookies();
  cookieStore.set(STUDENT_CLASS_COOKIE_NAME, String(requestedClassId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/student",
    secure: process.env.NODE_ENV === "production",
    maxAge: STUDENT_CLASS_PREFERENCE_SECONDS,
  });

  revalidatePath("/student", "layout");
  return true;
}
