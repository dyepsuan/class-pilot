import type { Metadata } from "next";

import { hashStudentSetupToken } from "@/lib/auth/student-setup-token";
import { isStudentSetupTokenShapeValid } from "@/lib/auth/student-setup-validation";
import { resolveInitialStudentSetupToken } from "@/lib/db/student-account-setup";

import { completeStudentSetup } from "./actions";
import SetupStateCard from "./SetupStateCard";
import StudentSetupForm from "./StudentSetupForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Student Account Setup | Class-pilot",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

type StudentSetupPageProps = {
  searchParams: Promise<{ token?: string | string[] }>;
};

function getStudentName(student: {
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
}): string {
  return [student.firstName, student.middleName, student.lastName, student.suffix]
    .filter(Boolean)
    .join(" ");
}

async function safelyResolveSetupToken(rawToken: string) {
  if (!isStudentSetupTokenShapeValid(rawToken)) {
    return { state: "INVALID" } as const;
  }

  try {
    const tokenHash = await hashStudentSetupToken(rawToken);
    return await resolveInitialStudentSetupToken(tokenHash);
  } catch {
    return { state: "INVALID" } as const;
  }
}

export default async function StudentSetupPage({
  searchParams,
}: StudentSetupPageProps) {
  const { token } = await searchParams;
  const rawToken = typeof token === "string" ? token : "";
  let content;

  if (!isStudentSetupTokenShapeValid(rawToken)) {
    content = <SetupStateCard state="INVALID" />;
  } else {
    const resolution = await safelyResolveSetupToken(rawToken);

      if (resolution.state !== "VALID") {
        content = <SetupStateCard state={resolution.state} />;
      } else {
        const setupAction = completeStudentSetup.bind(null, rawToken);

        content = (
          <section
            aria-labelledby="student-setup-heading"
            className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8"
          >
            <p className="text-sm font-semibold text-blue-700">Student Portal</p>
            <h1 id="student-setup-heading" className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
              Set Up Your Class-pilot Account
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Create a 6-digit PIN that you will use to sign in to the student portal.
            </p>

            <dl className="mt-6 grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Student</dt>
                <dd className="mt-1 font-semibold text-slate-900">{getStudentName(resolution.student)}</dd>
                <dd className="mt-0.5 text-slate-600">{resolution.student.studentNumber}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Class</dt>
                <dd className="mt-1 font-semibold text-slate-900">{resolution.classItem.subjectCode} · {resolution.classItem.section}</dd>
                <dd className="mt-0.5 text-slate-600">{resolution.classItem.subjectName}</dd>
              </div>
            </dl>

            <StudentSetupForm action={setupAction} />
          </section>
        );
      }
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center px-4 py-10 sm:px-6">
      <div className="w-full max-w-md">
        <div className="mb-5 flex items-center justify-center gap-2.5 text-slate-950">
          <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white shadow-sm">CP</span>
          <span className="text-base font-semibold tracking-tight">Class-pilot</span>
        </div>
        {content}
      </div>
    </main>
  );
}
