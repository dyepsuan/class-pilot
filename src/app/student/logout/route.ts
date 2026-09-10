import { redirect } from "next/navigation";

import { destroyLegacyStudentSession } from "@/lib/auth/student-session";

export async function GET(): Promise<never> {
  try {
    await destroyLegacyStudentSession();
  } catch {
    console.error(
      "[Class-pilot student logout] Legacy session cleanup was unavailable."
    );
  }

  redirect("/student/login");
}
