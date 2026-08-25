import { notFound } from "next/navigation";

import { requireStudent } from "@/lib/auth/student-session";
import {
  getStudentPortalDashboard,
  type StudentActivity,
} from "@/lib/db/student-portal";
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

function formatScore(value: number): string {
  return new Intl.NumberFormat("en-PH", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercentage(value: number | null): string {
  return value === null ? "No scores yet" : `${Math.round(value)}%`;
}

function parseStoredDate(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00+08:00`);
  }

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    return new Date(`${value.replace(" ", "T")}Z`);
  }

  return new Date(value);
}

function formatActivityDate(value: string): string {
  const date = parseStoredDate(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(date);
}

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(30,64,175,0.04)]">
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950 tabular-nums">
        {value}
      </p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </article>
  );
}

const activityToneClasses: Record<StudentActivity["tone"], string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  amber: "bg-amber-50 text-amber-700 ring-amber-100",
  red: "bg-red-50 text-red-700 ring-red-100",
  blue: "bg-blue-50 text-blue-700 ring-blue-100",
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
};

export default async function StudentDashboardPage() {
  const authenticatedStudent = await requireStudent();
  const { selectedClass } = await getStudentPortalContext(
    authenticatedStudent.id
  );

  if (!selectedClass) {
    notFound();
  }

  const dashboard = await getStudentPortalDashboard(
    authenticatedStudent.id,
    selectedClass
  );

  if (!dashboard) {
    notFound();
  }

  const { classItem, profile, summary } = dashboard;
  const studentName = formatName(profile.student);
  const initials = `${profile.student.first_name.charAt(0)}${profile.student.last_name.charAt(0)}`.toUpperCase();

  return (
    <div className="w-full">
      <section className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-[0_12px_32px_rgba(30,64,175,0.05)]">
        <div className="h-1 bg-blue-600" aria-hidden="true" />
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex min-w-0 items-start gap-4 sm:items-center">
            <div
              aria-hidden="true"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-sm font-bold text-blue-700 ring-1 ring-blue-100"
            >
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-blue-700">Welcome back</p>
              <h1 className="mt-1 break-words text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                {studentName}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Student No. {profile.student.student_number}
              </p>
            </div>
          </div>

          <div className="min-w-0 border-t border-slate-100 pt-4 sm:max-w-sm sm:border-t-0 sm:pt-0 sm:text-right">
            <p className="break-words text-sm font-semibold text-slate-900">
              {classItem.subject_code}: {classItem.subject_name}
            </p>
            <p className="mt-1 text-sm leading-5 text-slate-500">
              {classItem.section} | SY {classItem.school_year}
            </p>
            <p className="text-sm text-slate-500">{formatTerm(classItem.term)}</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="progress-heading" className="mt-7">
        <div>
          <h2 id="progress-heading" className="text-lg font-bold tracking-tight text-slate-950">
            Your progress
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Based on finalized and currently recorded class results.
          </p>
        </div>

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
                ? "No finalized attendance sessions"
                : `${summary.attendance.present} present, ${summary.attendance.late} late, ${summary.attendance.total} total`
            }
          />
          <SummaryCard
            label="Quiz Average"
            value={formatPercentage(summary.quizzes.percentage)}
            detail={
              summary.quizzes.scored === 0
                ? "No recorded quiz scores"
                : `${formatScore(summary.quizzes.earned)} / ${formatScore(summary.quizzes.possible)} points across ${summary.quizzes.scored} ${summary.quizzes.scored === 1 ? "quiz" : "quizzes"}`
            }
          />
          <SummaryCard
            label="Laboratory Average"
            value={formatPercentage(summary.laboratories.percentage)}
            detail={
              summary.laboratories.graded === 0
                ? "No graded laboratory scores"
                : `${formatScore(summary.laboratories.earned)} / ${formatScore(summary.laboratories.possible)} points across ${summary.laboratories.graded} ${summary.laboratories.graded === 1 ? "laboratory" : "laboratories"}`
            }
          />
        </div>
      </section>

      <section
        aria-labelledby="activity-heading"
        className="mt-7 overflow-hidden rounded-xl border border-slate-200 bg-white"
      >
        <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
          <h2 id="activity-heading" className="text-lg font-bold tracking-tight text-slate-950">
            Recent activity
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Your latest attendance and assessment updates.
          </p>
        </div>

        {summary.recentActivity.length === 0 ? (
          <div className="px-5 py-10 text-center sm:px-6">
            <div
              aria-hidden="true"
              className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-500"
            >
              R
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-900">
              No recent activity yet
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm leading-5 text-slate-500">
              Attendance and posted scores will appear here.
            </p>
          </div>
        ) : (
          <ol className="px-5 sm:px-6">
            {summary.recentActivity.map((activity, index) => (
              <li
                key={activity.key}
                className={`flex gap-3 py-4 ${index < summary.recentActivity.length - 1 ? "border-b border-slate-100" : ""}`}
              >
                <span
                  aria-hidden="true"
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ring-1 ${activityToneClasses[activity.tone]}`}
                >
                  {activity.category.charAt(0)}
                </span>
                <div className="min-w-0 flex-1 sm:flex sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold text-slate-900">
                      {activity.title}
                    </p>
                    <p className="mt-1 break-words text-sm text-slate-500">
                      {activity.detail}
                    </p>
                  </div>
                  <time
                    dateTime={activity.occurredAt}
                    className="mt-2 block shrink-0 text-xs text-slate-500 sm:mt-0"
                  >
                    {formatActivityDate(activity.occurredAt)}
                  </time>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
