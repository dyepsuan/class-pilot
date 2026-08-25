import Link from "next/link";

import { matchClassSchedule } from "@/lib/class-schedule";
import {
  formatMeetingTimeRange,
  groupMeetingsForDisplay,
  timeToMinutes,
  toClassWeekday,
} from "@/lib/class-meetings";
import {
  formatClassroomDateTime,
  getClassroomDate,
} from "@/lib/classroom-time";
import {
  getDashboardData,
  type DashboardActivity,
  type DashboardClass,
} from "@/lib/db/dashboard";

export const dynamic = "force-dynamic";

const activityToneClasses: Record<DashboardActivity["kind"], string> = {
  ATTENDANCE: "bg-green-100 text-green-700",
  QUIZ: "bg-blue-100 text-blue-700",
  LABORATORY: "bg-gray-100 text-gray-600",
};

function formatTerm(term: string) {
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

function activityHref(activity: DashboardActivity) {
  if (activity.kind === "ATTENDANCE") {
    return `/classes/${activity.class_id}/attendance/${activity.destination_id}`;
  }

  if (activity.kind === "QUIZ") {
    return `/classes/${activity.class_id}/quizzes/${activity.destination_id}`;
  }

  return `/classes/${activity.class_id}/laboratories/${activity.destination_id}`;
}

function classStatus(classItem: DashboardClass) {
  if (classItem.open_attendance_count > 0) {
    return `${classItem.open_attendance_count} attendance ${
      classItem.open_attendance_count === 1 ? "session" : "sessions"
    } open`;
  }

  if (classItem.open_laboratory_count > 0) {
    return `${classItem.open_laboratory_count} ${
      classItem.open_laboratory_count === 1 ? "laboratory needs" : "laboratories need"
    } attention`;
  }

  return "No pending activity";
}

function legacyStartMinutes(label: string) {
  const match = /\b(\d{1,2}):(\d{2})\s*(AM|PM)\b/i.exec(label);
  if (!match) return null;
  let hours = Number(match[1]) % 12;
  if (match[3].toUpperCase() === "PM") hours += 12;
  return hours * 60 + Number(match[2]);
}

function MetricCard({
  label,
  value,
  supportingText,
  detail,
}: {
  label: string;
  value: number;
  supportingText: string;
  detail?: string;
}) {
  return (
    <article className="rounded-xl border border-slate-200/80 bg-white/90 p-5 shadow-sm transition-shadow">
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
    </article>
  );
}

export default async function ClassesPage() {
  const { summary, classes, recentActivity } = await getDashboardData();
  const classroomDate = getClassroomDate();
  const todayWeekday = toClassWeekday(classroomDate.weekday);
  const todayClasses = classes.flatMap((classItem) => {
    if (classItem.meetings.length > 0) {
      return classItem.meetings
        .filter((meeting) => meeting.weekday === todayWeekday)
        .map((meeting) => ({
          eventKey: `${classItem.id}-${meeting.id ?? `${meeting.start_time}-${meeting.end_time}`}`,
          classItem,
          meetingTimes: [formatMeetingTimeRange(meeting)],
          sortTime: timeToMinutes(meeting.start_time),
        }));
    }

    const schedule = matchClassSchedule(
      classItem.schedule_text,
      classroomDate.weekday
    );

    return schedule.scheduledToday
      ? [{
          eventKey: `legacy-${classItem.id}`,
          classItem,
          meetingTimes: schedule.meetingTimes,
          sortTime: legacyStartMinutes(schedule.meetingTimes[0] ?? ""),
        }]
      : [];
  }).sort(
    (left, right) =>
      (left.sortTime ?? Number.MAX_SAFE_INTEGER) -
        (right.sortTime ?? Number.MAX_SAFE_INTEGER) ||
      left.classItem.id - right.classItem.id
  );
  const openActivityCount =
    summary.open_attendance_count + summary.open_laboratory_count;
  const openActivityDetail = [
    summary.open_attendance_count > 0
      ? `${summary.open_attendance_count} attendance`
      : null,
    summary.open_laboratory_count > 0
      ? `${summary.open_laboratory_count} ${
          summary.open_laboratory_count === 1 ? "laboratory" : "laboratories"
        }`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <main className="min-h-screen bg-transparent">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">
              Classes
            </h1>
            <p className="mt-2 text-slate-600">
              Manage your classes, students, attendance, quizzes, and
              laboratories.
            </p>
          </div>

          <Link
            href="/classes/new"
            className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 sm:w-auto"
          >
            + Add Class
          </Link>
        </div>

        <section aria-labelledby="today-heading">
          <h2
            id="today-heading"
            className="text-base font-semibold tracking-tight text-gray-950"
          >
            Today <span className="font-normal text-gray-400">—</span>{" "}
            {classroomDate.dateLabel}
          </h2>

          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200/80 bg-white/90 shadow-sm">
            {todayClasses.length === 0 ? (
              <p className="px-5 py-4 text-sm text-gray-500 sm:px-6">
                No classes scheduled for today.
              </p>
            ) : (
              <div className="divide-y divide-gray-100">
                {todayClasses.map(({ eventKey, classItem, meetingTimes }) => (
                  <article
                    key={eventKey}
                    className="flex flex-col gap-4 px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-500">
                        {classItem.subject_code}
                      </p>
                      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <h3 className="text-base font-semibold text-gray-950">
                          {classItem.section}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {classItem.subject_name}
                        </p>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-gray-500">
                        {meetingTimes.length > 0 ? (
                          meetingTimes.map((time) => (
                            <span key={time}>{time}</span>
                          ))
                        ) : (
                          <span>Time not specified</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Link
                        href={`/classes/${classItem.id}`}
                        className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                      >
                        Open Class
                      </Link>
                      <Link
                        href={
                          classItem.open_attendance_session_id
                            ? `/classes/${classItem.id}/attendance/${classItem.open_attendance_session_id}`
                            : `/classes/${classItem.id}/attendance/new`
                        }
                        className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                      >
                        {classItem.open_attendance_session_id
                          ? "Continue Attendance"
                          : "Start Attendance"}
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        {classes.length === 0 ? (
          <section className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white/90 p-8 text-center shadow-sm sm:p-10">
            <h2 className="text-lg font-semibold text-gray-900">
              No classes yet.
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Create your first class to start organizing classroom work.
            </p>
            <Link
              href="/classes/new"
              className="mt-4 inline-flex rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Add Class
            </Link>
          </section>
        ) : (
          <>
            <section
              aria-label="Teaching summary"
              className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
            >
              <MetricCard
                label="Classes"
                value={summary.class_count}
                supportingText="Active classes"
              />
              <MetricCard
                label="Students"
                value={summary.student_count}
                supportingText="Active students across classes"
              />
              <MetricCard
                label="Attendance Sessions"
                value={summary.attendance_count}
                supportingText="Attendance sessions recorded"
                detail={
                  summary.open_attendance_count > 0
                    ? `${summary.open_attendance_count} currently open`
                    : undefined
                }
              />
              <MetricCard
                label="Open Activities"
                value={openActivityCount}
                supportingText="Items needing attention"
                detail={openActivityDetail || "Nothing currently open"}
              />
            </section>

            <section className="mt-10" aria-labelledby="classes-heading">
              <div>
                <h2
                  id="classes-heading"
                  className="text-lg font-semibold tracking-tight text-gray-950"
                >
                  Your Classes
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Open a class to manage its students and classroom work.
                </p>
              </div>

              <div className="mt-4 grid gap-5 md:grid-cols-2">
                {classes.map((classItem) => {
                  const scheduleGroups = groupMeetingsForDisplay(classItem.meetings);
                  return (
                  <article
                    key={classItem.id}
                    className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white/95 p-5 shadow-sm transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md sm:p-6"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-500">
                        {classItem.subject_code}
                      </p>
                      <h3 className="mt-1 text-xl font-bold tracking-tight text-slate-950">
                        {classItem.section}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {classItem.subject_name}
                      </p>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-x-2 gap-y-1 text-xs text-gray-500">
                      <span className="font-medium text-gray-700">
                        {classItem.student_count} active{" "}
                        {classItem.student_count === 1 ? "student" : "students"}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{formatTerm(classItem.term)}</span>
                      <span aria-hidden="true">·</span>
                      <span>SY {classItem.school_year}</span>
                    </div>

                    {(scheduleGroups.length > 0 || classItem.schedule_text) && (
                      <div className="mt-3 text-sm leading-5 text-gray-600">
                        <span className="font-medium text-gray-500">Schedule:</span>
                        {scheduleGroups.length > 0 ? (
                          <ul className="mt-1 space-y-1">
                            {scheduleGroups.map((group) => (
                              <li key={`${group.weekdays.join("-")}-${group.start_time}-${group.end_time}`}>
                                {group.label}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span>{" "}{classItem.schedule_text}</span>
                        )}
                      </div>
                    )}

                    <p className="mt-4 border-t border-gray-100 pt-4 text-xs font-medium text-gray-600">
                      {classStatus(classItem)}
                    </p>

                    <Link
                      href={`/classes/${classItem.id}`}
                      className="mt-5 inline-flex w-full items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                    >
                      Open Class
                    </Link>
                  </article>
                  );
                })}
              </div>
            </section>

            <section
              className="mt-10 overflow-hidden rounded-xl border border-slate-200/80 bg-white/95 shadow-sm"
              aria-labelledby="activity-heading"
            >
              <div className="border-b border-gray-100 px-5 py-5 sm:px-6">
                <h2
                  id="activity-heading"
                  className="text-base font-semibold tracking-tight text-gray-950"
                >
                  Recent Activity Across Classes
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Latest attendance, quiz, and laboratory updates.
                </p>
              </div>

              {recentActivity.length === 0 ? (
                <p className="px-5 py-6 text-sm text-gray-500 sm:px-6">
                  No recent class activity yet.
                </p>
              ) : (
                <ol className="divide-y divide-gray-100">
                  {recentActivity.map((activity) => (
                    <li key={activity.key}>
                      <Link
                        href={activityHref(activity)}
                        className="flex gap-3 px-5 py-4 transition-colors hover:bg-gray-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gray-400 sm:px-6"
                      >
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${activityToneClasses[activity.kind]}`}
                          aria-hidden="true"
                        >
                          {activity.kind.charAt(0)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium leading-5 text-gray-900">
                            {activity.detail}
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-gray-500">
                            <span className="font-medium text-gray-600">
                              {activity.section}
                            </span>
                            <span className="px-1.5 text-gray-300" aria-hidden="true">
                              ·
                            </span>
                            <time dateTime={activity.occurred_at}>
                              {formatClassroomDateTime(activity.occurred_at)}
                            </time>
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
