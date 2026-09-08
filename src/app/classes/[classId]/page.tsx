import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getClassOverviewData,
  type OverviewActivity,
  type OverviewAttendanceSession,
} from "@/lib/db/class-overview";

type ClassOverviewPageProps = {
  params: Promise<{
    classId: string;
  }>;
};

const activityToneClasses: Record<
  OverviewActivity["kind"],
  string
> = {
  ATTENDANCE: "bg-green-100 text-green-700",
  QUIZ: "bg-blue-100 text-blue-700",
  LABORATORY: "bg-gray-100 text-gray-600",
  DROPBOX: "bg-violet-100 text-violet-700",
};

function parseStoredDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00+08:00`);
  }

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    return new Date(`${value.replace(" ", "T")}Z`);
  }

  return new Date(value);
}

function formatDate(value: string | null) {
  if (!value) {
    return null;
  }

  const date = parseStoredDate(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(date);
}

function formatDateTime(value: string) {
  const date = parseStoredDate(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  }).format(date);
}

function attendancePercentage(session: OverviewAttendanceSession) {
  if (session.status !== "CLOSED" || session.recorded_count === 0) {
    return null;
  }

  return Math.round(
    ((session.present_count + session.late_count) /
      session.recorded_count) *
      100
  );
}

function SummaryCard({
  href,
  label,
  value,
  supportingText,
  detail,
}: {
  href: string;
  label: string;
  value: number;
  supportingText: string;
  detail?: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-slate-200/80 bg-white/90 p-5 shadow-sm transition-[box-shadow,border-color,background-color] hover:border-blue-200 hover:bg-white hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
    >
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight text-slate-950">
        {value}
      </p>
      <p className="mt-1 text-sm leading-5 text-slate-500">
        {supportingText}
      </p>
      {detail && (
        <p className="mt-3 border-t border-slate-100 pt-3 text-xs font-medium text-slate-600">
          {detail}
        </p>
      )}
      <p className="mt-3 text-xs font-medium text-slate-500 transition-colors group-hover:text-blue-600">
        View {label.toLowerCase()} <span aria-hidden="true">&rarr;</span>
      </p>
    </Link>
  );
}

function SectionHeader({
  title,
  subtitle,
  href,
  linkLabel,
}: {
  title: string;
  subtitle: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
      <div>
        <h3 className="font-semibold tracking-tight text-slate-950">
          {title}
        </h3>
        <p className="mt-1 text-sm leading-5 text-slate-500">{subtitle}</p>
      </div>
      {href && linkLabel && (
        <Link
          href={href}
          className="shrink-0 rounded-sm text-sm font-medium text-slate-600 transition-colors hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          {linkLabel} <span aria-hidden="true">&rarr;</span>
        </Link>
      )}
    </div>
  );
}

function EmptyState({
  marker,
  title,
  description,
  href,
  linkLabel,
}: {
  marker: string;
  title: string;
  description: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="px-6 py-8 text-center">
      <span
        className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-500"
        aria-hidden="true"
      >
        {marker}
      </span>
      <p className="mt-3 text-sm font-medium text-slate-900">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm leading-5 text-slate-500">
        {description}
      </p>
      {href && linkLabel && (
        <Link
          href={href}
          className="mt-4 inline-flex rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          {linkLabel}
        </Link>
      )}
    </div>
  );
}

export default async function ClassOverviewPage({
  params,
}: ClassOverviewPageProps) {
  const { classId } = await params;
  const id = Number(classId);

  if (!Number.isInteger(id) || id <= 0) {
    notFound();
  }

  const {
    summary,
    recentAttendance,
    recentAssessments,
    recentActivity,
  } = await getClassOverviewData(id);

  const attendanceDetail =
    summary.attendance_count > 0
      ? `${summary.finalized_attendance_count} finalized · ${summary.open_attendance_count} open`
      : undefined;
  const quizDetail =
    summary.quiz_count > 0
      ? `${summary.scored_quiz_count} with recorded scores`
      : undefined;
  const laboratoryDetail =
    summary.laboratory_count > 0
      ? `${summary.completed_laboratory_count} completed · ${summary.group_laboratory_count} group`
      : undefined;

  return (
    <div className="w-full">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">Overview</h2>
          <p className="mt-1 text-sm text-slate-500">
            Current classroom activity at a glance.
          </p>
        </div>

        <div aria-label="Quick Actions" className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:justify-end">
          <Link
            href={`/classes/${id}/attendance/new`}
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-3.5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
          >
            Start Attendance
          </Link>
          {[
            ["Add Student", `/classes/${id}/students`],
            ["Create Quiz", `/classes/${id}/quizzes/new`],
            ["Create Laboratory", `/classes/${id}/laboratories/new`],
          ].map(([label, href]) => (
            <Link
              key={label}
              href={href}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      <section aria-label="Class summary" className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          href={`/classes/${id}/students`}
          label="Students"
          value={summary.student_count}
          supportingText="Active enrollments"
        />
        <SummaryCard
          href={`/classes/${id}/attendance`}
          label="Attendance"
          value={summary.attendance_count}
          supportingText="Class meetings recorded"
          detail={attendanceDetail}
        />
        <SummaryCard
          href={`/classes/${id}/quizzes`}
          label="Quizzes"
          value={summary.quiz_count}
          supportingText="Quizzes recorded"
          detail={quizDetail}
        />
        <SummaryCard
          href={`/classes/${id}/laboratories`}
          label="Laboratories"
          value={summary.laboratory_count}
          supportingText="Laboratories recorded"
          detail={laboratoryDetail}
        />
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start">
        <div className="grid min-w-0 gap-6">
        <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white/95 shadow-sm">
          <SectionHeader
            title="Recent Attendance"
            subtitle="Latest class meetings and finalized attendance records."
            href={`/classes/${id}/attendance`}
            linkLabel="View all attendance"
          />

          {recentAttendance.length === 0 ? (
            <EmptyState
              marker="A"
              title="No attendance sessions recorded yet."
              description="Start attendance when the class meets."
              href={`/classes/${id}/attendance/new`}
              linkLabel="Start attendance"
            />
          ) : (
            <div className="divide-y divide-gray-100">
              {recentAttendance.map((session) => {
                const percentage = attendancePercentage(session);
                const checkedIn =
                  session.present_count + session.late_count;

                return (
                  <Link
                    key={session.id}
                    href={`/classes/${id}/attendance/${session.id}`}
                    className="block px-5 py-4 transition-colors hover:bg-gray-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gray-400 sm:px-6"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900">
                          Meeting {session.meeting_no}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-gray-500">
                          {formatDate(session.session_date)}
                          {session.topic ? ` · ${session.topic}` : ""}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                          session.status === "OPEN"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {session.status === "OPEN" ? "Open" : "Finalized"}
                      </span>
                    </div>

                    {session.status === "CLOSED" ? (
                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
                        <span>{session.present_count} present</span>
                        <span>{session.late_count} late</span>
                        <span>{session.absent_count} absent</span>
                        {session.excused_count > 0 && (
                          <span>{session.excused_count} excused</span>
                        )}
                        {percentage !== null && (
                          <span className="ml-auto font-semibold tabular-nums text-gray-800">
                            {percentage}% attended
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="mt-3 text-xs font-medium text-gray-600">
                        {checkedIn} checked in so far
                      </p>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white/95 shadow-sm">
          <SectionHeader
            title="Recent Assessments"
            subtitle="Latest quizzes and laboratory activities."
          />

          {recentAssessments.length === 0 ? (
            <EmptyState
              marker="Q"
              title="No quizzes or laboratories recorded yet."
              description="Create an assessment when the class is ready."
              href={`/classes/${id}/quizzes/new`}
              linkLabel="Create quiz"
            />
          ) : (
            <div className="divide-y divide-gray-100">
              {recentAssessments.map((assessment) => {
                const isQuiz = assessment.kind === "QUIZ";

                return (
                  <Link
                    key={`${assessment.kind}-${assessment.id}`}
                    href={
                      isQuiz
                        ? `/classes/${id}/quizzes/${assessment.id}`
                        : `/classes/${id}/laboratories/${assessment.id}`
                    }
                    className="block px-5 py-4 transition-colors hover:bg-gray-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gray-400 sm:px-6"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-500">
                          {isQuiz ? "Quiz" : "Laboratory"} · {isQuiz ? "Quiz" : "Laboratory"} {assessment.sequence_no}
                        </p>
                        <p className="mt-1 text-sm font-medium leading-5 text-gray-900">
                          {assessment.title}
                        </p>
                      </div>
                      {!isQuiz && assessment.status && (
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                            assessment.status === "completed"
                              ? "bg-green-100 text-green-700"
                              : "bg-sky-100 text-sky-700"
                          }`}
                        >
                          {assessment.status === "completed" ? "Completed" : "Open"}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                      {!isQuiz && assessment.subtype && (
                        <span className="capitalize">{assessment.subtype}</span>
                      )}
                      <span>
                        {assessment.scored_count} {assessment.scored_count === 1 ? "score" : "scores"} recorded
                      </span>
                      {assessment.display_date && (
                        <span>{formatDate(assessment.display_date)}</span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-100 bg-slate-50/70 px-5 py-3 text-xs font-medium text-slate-600 sm:px-6">
            <Link href={`/classes/${id}/quizzes`} className="transition-colors hover:text-blue-600">
              View quizzes <span aria-hidden="true">&rarr;</span>
            </Link>
            <Link href={`/classes/${id}/laboratories`} className="transition-colors hover:text-blue-600">
              View laboratories <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
        </section>
        </div>

        <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200/80 bg-white/95 shadow-sm">
        <SectionHeader
          title="Recent Class Activity"
          subtitle="Latest recorded events across attendance, quizzes, laboratories, and Dropbox."
        />

        {recentActivity.length === 0 ? (
          <EmptyState
            marker="R"
            title="No class activity yet."
            description="Recent classroom records will appear here."
          />
        ) : (
          <ol className="px-5 py-1 sm:px-6">
            {recentActivity.map((activity, index) => (
              <li key={activity.key} className="relative flex gap-3 py-4">
                <div className="relative flex w-8 shrink-0 justify-center">
                  {index < recentActivity.length - 1 && (
                    <span
                      className="absolute left-1/2 top-8 h-[calc(100%+0.25rem)] w-px -translate-x-1/2 bg-gray-200"
                      aria-hidden="true"
                    />
                  )}
                  <span
                    className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-bold ${activityToneClasses[activity.kind]}`}
                    aria-hidden="true"
                  >
                    {activity.kind.charAt(0)}
                  </span>
                </div>
                <div
                  className={`min-w-0 flex-1 pb-4 ${
                    index < recentActivity.length - 1
                      ? "border-b border-gray-100"
                      : ""
                  }`}
                >
                  <p className="break-words text-sm font-medium text-gray-900">
                    {activity.detail}
                  </p>
                  <p className="mt-1.5 text-xs leading-5 text-gray-500">
                    <span className="font-medium capitalize text-gray-600">
                      {activity.kind.toLowerCase()}
                    </span>
                    <span className="px-1.5 text-gray-300" aria-hidden="true">&bull;</span>
                    <time dateTime={activity.occurred_at}>
                      {formatDateTime(activity.occurred_at)}
                    </time>
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
        </section>
      </div>
    </div>
  );
}
