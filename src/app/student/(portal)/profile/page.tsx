import Link from "next/link";

import { requireStudent } from "@/lib/auth/student-session";
import { getStudentPortalDashboard } from "@/lib/db/student-portal";
import { getStudentPortalContext } from "@/lib/student-portal-class";

function formatName(student: {
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
}): string {
  return [student.first_name, student.middle_name, student.last_name, student.suffix]
    .filter(Boolean)
    .join(" ");
}

function formatTerm(term: string): string {
  switch (term) {
    case "1ST_SEMESTER":
      return "1st Semester";
    case "2ND_SEMESTER":
      return "2nd Semester";
    case "SUMMER":
      return "Summer";
    default:
      return term;
  }
}

function formatPercentage(value: number | null): string {
  return value === null ? "No scores yet" : `${Math.round(value)}%`;
}

function EmptyState() {
  return (
    <section className="mt-7 overflow-hidden rounded-xl border border-slate-200 bg-white px-5 py-12 text-center sm:px-8 sm:py-14">
      <div
        aria-hidden="true"
        className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-500"
      >
        P
      </div>
      <h2 className="mt-4 text-base font-bold tracking-tight text-slate-950">
        No active class found
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        You are not currently enrolled in an active class.
      </p>
    </section>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  href,
}: {
  label: string;
  value: string;
  detail: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(30,64,175,0.04)] transition-colors hover:border-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
      aria-label={`View ${label.toLowerCase()} details`}
    >
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-3 text-2xl font-bold tracking-tight text-slate-950 tabular-nums">
        {value}
      </p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="text-xs leading-5 text-slate-500">{detail}</p>
        <span className="shrink-0 text-xs font-semibold text-blue-700 group-hover:text-blue-800">
          View details
        </span>
      </div>
    </Link>
  );
}

export default async function StudentProfilePage() {
  const authenticatedStudent = await requireStudent();
  const { selectedClass } = await getStudentPortalContext(
    authenticatedStudent.id
  );
  const dashboard = selectedClass
    ? await getStudentPortalDashboard(authenticatedStudent.id, selectedClass)
    : null;

  if (!dashboard) {
    return (
      <div className="w-full">
        <header>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            Profile
          </h1>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            View your student information and current class details.
          </p>
        </header>
        <EmptyState />
      </div>
    );
  }

  const { classItem, profile, summary } = dashboard;
  const studentName = formatName(profile.student);
  const initials =
    `${profile.student.first_name.charAt(0)}${profile.student.last_name.charAt(0)}`.toUpperCase();

  return (
    <div className="w-full">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
          Profile
        </h1>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          View your student information and current class details.
        </p>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-2 lg:items-stretch">
        <section
          aria-labelledby="student-identity-heading"
          className="overflow-hidden rounded-xl border border-blue-100 bg-white shadow-[0_12px_32px_rgba(30,64,175,0.05)]"
        >
          <div className="h-1 bg-blue-600" aria-hidden="true" />
          <div className="p-5 sm:p-6">
            <div className="flex min-w-0 items-start gap-4">
              <div
                aria-hidden="true"
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-base font-bold text-blue-700 ring-1 ring-blue-100"
              >
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2
                    id="student-identity-heading"
                    className="break-words text-xl font-bold tracking-tight text-slate-950"
                  >
                    {studentName}
                  </h2>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-100">
                    Active
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Student No. {profile.student.student_number}
                </p>
              </div>
            </div>

            <dl className="mt-6 border-t border-slate-100 pt-5">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Email address
                </dt>
                <dd className="mt-1 break-all text-sm font-medium text-slate-800">
                  {profile.student.email ?? "Not provided"}
                </dd>
              </div>
            </dl>

            <Link
              href="/student/qr"
              className="mt-6 inline-flex w-full items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition-colors hover:border-blue-300 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 sm:w-auto"
            >
              View My QR
            </Link>
          </div>
        </section>

        <section
          aria-labelledby="current-class-heading"
          className="overflow-hidden rounded-xl border border-slate-200 bg-white"
        >
          <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
            <h2
              id="current-class-heading"
              className="text-base font-bold tracking-tight text-slate-950"
            >
              Current class
            </h2>
          </div>
          <dl className="grid gap-x-6 gap-y-5 px-5 py-5 sm:grid-cols-2 sm:px-6">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Class name
              </dt>
              <dd className="mt-1 break-words text-sm font-semibold text-slate-900">
                {classItem.subject_name}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Class code
              </dt>
              <dd className="mt-1 break-words text-sm font-semibold text-slate-900">
                {classItem.subject_code}
              </dd>
            </div>
            {classItem.section && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Section
                </dt>
                <dd className="mt-1 break-words text-sm text-slate-700">
                  {classItem.section}
                </dd>
              </div>
            )}
            {classItem.school_year && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  School year
                </dt>
                <dd className="mt-1 break-words text-sm text-slate-700">
                  {classItem.school_year}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Term
              </dt>
              <dd className="mt-1 break-words text-sm text-slate-700">
                {formatTerm(classItem.term)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Instructor
              </dt>
              <dd className="mt-1 break-words text-sm text-slate-700">
                {classItem.instructor_name}
              </dd>
            </div>
            {classItem.schedule_text && (
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Schedule
                </dt>
                <dd className="mt-1 whitespace-pre-line break-words text-sm leading-6 text-slate-700">
                  {classItem.schedule_text}
                </dd>
              </div>
            )}
          </dl>
        </section>
      </div>

      <section aria-labelledby="academic-summary-heading" className="mt-7">
        <h2
          id="academic-summary-heading"
          className="text-lg font-bold tracking-tight text-slate-950"
        >
          Academic summary
        </h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Based on finalized attendance and recorded assessment results.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryCard
            label="Attendance"
            value={
              summary.attendance.percentage === null
                ? "No records yet"
                : `${Math.round(summary.attendance.percentage)}%`
            }
            detail={
              summary.attendance.total === 0
                ? "No finalized sessions"
                : `${summary.attendance.present} present, ${summary.attendance.late} late, ${summary.attendance.total} total`
            }
            href="/student/attendance"
          />
          <SummaryCard
            label="Quiz average"
            value={formatPercentage(summary.quizzes.percentage)}
            detail={
              summary.quizzes.scored === 0
                ? "No recorded quiz scores"
                : `${summary.quizzes.scored} ${summary.quizzes.scored === 1 ? "quiz" : "quizzes"} scored`
            }
            href="/student/quizzes"
          />
          <SummaryCard
            label="Laboratory average"
            value={formatPercentage(summary.laboratories.percentage)}
            detail={
              summary.laboratories.graded === 0
                ? "No graded laboratory scores"
                : `${summary.laboratories.graded} ${summary.laboratories.graded === 1 ? "laboratory" : "laboratories"} graded`
            }
            href="/student/laboratories"
          />
        </div>
      </section>
    </div>
  );
}
