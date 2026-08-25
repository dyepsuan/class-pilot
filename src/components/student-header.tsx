import Link from "next/link";

import type { AuthenticatedStudent } from "@/lib/auth/student-session";
import { studentLogout } from "@/app/student/logout/actions";

import StudentNavigation from "./student-navigation";

function getStudentName(student: AuthenticatedStudent): string {
  return [student.firstName, student.middleName, student.lastName, student.suffix]
    .filter(Boolean)
    .join(" ");
}

function getInitials(student: AuthenticatedStudent): string {
  return `${student.firstName.charAt(0)}${student.lastName.charAt(0)}`.toUpperCase();
}

export default function StudentHeader({
  student,
}: {
  student: AuthenticatedStudent;
}) {
  const name = getStudentName(student);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/90 bg-white/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <Link
          href="/student"
          aria-label="Class-pilot student dashboard"
          className="inline-flex shrink-0 items-center gap-2.5 rounded-lg text-slate-950 transition-colors hover:text-blue-700"
        >
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white shadow-sm"
          >
            CP
          </span>
          <span className="hidden text-base font-semibold tracking-tight min-[420px]:inline">
            Class-pilot
          </span>
        </Link>

        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <div
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-700 ring-1 ring-blue-100"
          >
            {getInitials(student)}
          </div>
          <div className="hidden min-w-0 text-right sm:block">
            <p className="max-w-44 truncate text-sm font-semibold text-slate-900">
              {name}
            </p>
            <p className="max-w-44 truncate text-xs text-slate-500">
              {student.studentNumber}
            </p>
          </div>
          <form action={studentLogout}>
            <button
              type="submit"
              className="whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950 active:translate-y-px"
            >
              Log out
            </button>
          </form>
        </div>
      </div>

      <StudentNavigation />
    </header>
  );
}
