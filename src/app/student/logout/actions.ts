"use server";

import { redirect } from "next/navigation";

import { destroyStudentSession } from "@/lib/auth/student-session";

export async function studentLogout(): Promise<never> {
  try {
    await destroyStudentSession();
  } catch {
    console.error("[Class-pilot student logout] Session cleanup was unavailable.");
  }

  redirect("/student/logout");
}
