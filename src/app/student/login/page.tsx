import { redirect } from "next/navigation";

import { getStudentSession } from "@/lib/auth/student-session";

import StudentLoginForm from "./student-login-form";

export default async function StudentLoginPage() {
  const student = await getStudentSession();

  if (student) {
    redirect("/student");
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center px-4 py-10 sm:px-6">
      <div className="w-full max-w-md">
        <div className="mb-5 flex items-center justify-center gap-2.5 text-slate-950">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white shadow-sm"
          >
            CP
          </span>
          <span className="text-base font-semibold tracking-tight">Class-pilot</span>
        </div>

        <section
          aria-labelledby="student-login-heading"
          className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8"
        >
          <p className="text-sm font-semibold text-blue-700">Student Portal</p>
          <h1
            id="student-login-heading"
            className="mt-2 text-2xl font-bold tracking-tight text-slate-950"
          >
            Welcome back
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Sign in to view your attendance and assessment progress.
          </p>

          <StudentLoginForm />
        </section>

        <p className="mt-5 text-center text-xs leading-5 text-slate-500">
          Your instructor provides your portal PIN.
        </p>
      </div>
    </main>
  );
}
