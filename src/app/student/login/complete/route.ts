import { redirect } from "next/navigation";

import { clearLegacyStudentSessionCookie } from "@/lib/auth/student-session";

export async function GET(): Promise<never> {
  await clearLegacyStudentSessionCookie();
  redirect("/student");
}
