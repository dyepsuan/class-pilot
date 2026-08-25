"use server";

import { redirect } from "next/navigation";

import { destroyStudentSession } from "@/lib/auth/student-session";

export async function studentLogout(): Promise<never> {
  await destroyStudentSession();
  redirect("/student/login");
}
