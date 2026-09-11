import { notFound } from "next/navigation";

import { requireStudent } from "@/lib/auth/student-session";
import { parseStoredTimestamp } from "@/lib/datetime";
import { getStudentPortalAttendance } from "@/lib/db/student-portal";
import type { AttendanceStatus } from "@/lib/db/student-profile";
import { getStudentPortalContext } from "@/lib/student-portal-class";

const attendanceBadgeClasses: Record<AttendanceStatus, string> = {
  PRESENT: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  LATE: "bg-amber-50 text-amber-700 ring-amber-100",
  ABSENT: "bg-red-50 text-red-700 ring-red-100",
  EXCUSED: "bg-blue-50 text-blue-700 ring-blue-100",
};

function parseStoredDate(value: string): Date {
  return parseStoredTimestamp(value) ?? new Date(Number.NaN);
}

function formatSessionDate(value: string): string {
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

function formatCheckInTime(
  value: string | null,
  status: AttendanceStatus
): string {
  if (!value || status === "ABSENT") {
    return "—";
  }

  const date = parseStoredDate(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  }).format(date);
}

function formatStatus(status: AttendanceStatus): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
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

function StatusBadge({ status }: { status: AttendanceStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${attendanceBadgeClasses[status]}`}
    >
      {formatStatus(status)}
    </span>
  );
}

export default async function StudentAttendancePage() {
  const authenticatedStudent = await requireStudent();
  const { selectedClass } = await getStudentPortalContext(
    authenticatedStudent.id
  );

  if (!selectedClass) {
    notFound();
  }

  const attendance = await getStudentPortalAttendance(
    authenticatedStudent.id,
    selectedClass
  );

  if (!attendance) {
    notFound();
  }

  const { classItem, records, summary } = attendance;

  return (
    <div className="w-full">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            Attendance
          </h1>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Review your finalized attendance record for this class.
          </p>
        </div>
        <div className="min-w-0 sm:max-w-sm sm:text-right">
          <p className="break-words text-sm font-semibold text-slate-900">
            {classItem.subject_code}: {classItem.subject_name}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {classItem.section} | SY {classItem.school_year} | {formatTerm(classItem.term)}
          </p>
        </div>
      </header>

      <section aria-label="Attendance summary" className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard
          label="Attendance Rate"
          value={summary.percentage === null ? "—" : `${Math.round(summary.percentage)}%`}
          detail={summary.total === 0 ? "No finalized sessions yet" : `${summary.attended} attended of ${summary.total}`}
        />
        <SummaryCard label="Present" value={String(summary.present)} detail="Finalized records" />
        <SummaryCard label="Late" value={String(summary.late)} detail="Counts as attended" />
        <SummaryCard label="Absent" value={String(summary.absent)} detail="Finalized records" />
        <SummaryCard label="Total Sessions" value={String(summary.total)} detail="Closed attendance sessions" />
      </section>

      <section
        aria-labelledby="attendance-history-heading"
        className="mt-7 overflow-hidden rounded-xl border border-slate-200 bg-white"
      >
        <div className="border-b border-slate-100 px-5 py-5 sm:flex sm:items-start sm:justify-between sm:gap-4 sm:px-6">
          <div>
            <h2 id="attendance-history-heading" className="text-lg font-bold tracking-tight text-slate-950">
              Attendance History
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Finalized sessions are listed newest first.
            </p>
          </div>
          {records.length > 0 && (
            <p className="mt-2 shrink-0 text-sm font-medium text-slate-500 sm:mt-0">
              {records.length} {records.length === 1 ? "session" : "sessions"}
            </p>
          )}
        </div>

        {records.length === 0 ? (
          <div className="px-5 py-12 text-center sm:px-6">
            <div
              aria-hidden="true"
              className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-500"
            >
              A
            </div>
            <h3 className="mt-4 text-sm font-semibold text-slate-900">
              No attendance records yet
            </h3>
            <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">
              Your attendance history will appear here after your instructor finishes an attendance session.
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-100 md:hidden">
              {records.map((record) => {
                const checkInTime = formatCheckInTime(record.recorded_at, record.status);

                return (
                  <article key={record.session_id} className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <time dateTime={record.session_date} className="block text-sm font-semibold text-slate-900">
                          {formatSessionDate(record.session_date)}
                        </time>
                        {record.meeting_no != null && (
                          <p className="mt-1 text-sm text-slate-500">Meeting {record.meeting_no}</p>
                        )}
                      </div>
                      <StatusBadge status={record.status} />
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                      <div>
                        <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Check-in</dt>
                        <dd className="mt-1 text-sm font-medium text-slate-700 tabular-nums">{checkInTime}</dd>
                      </div>
                      {record.topic && (
                        <div className="min-w-0">
                          <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Topic</dt>
                          <dd className="mt-1 break-words text-sm text-slate-700">{record.topic}</dd>
                        </div>
                      )}
                    </dl>
                  </article>
                );
              })}
            </div>

            <div className="hidden md:block">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50/80">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Date</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Meeting</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Check-in</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {records.map((record) => (
                    <tr key={record.session_id} className="transition-colors hover:bg-slate-50/70">
                      <td className="whitespace-nowrap px-6 py-4">
                        <time dateTime={record.session_date} className="text-sm font-medium text-slate-900">
                          {formatSessionDate(record.session_date)}
                        </time>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-700">
                          {record.meeting_no == null ? "—" : `Meeting ${record.meeting_no}`}
                        </p>
                        {record.topic && <p className="mt-1 max-w-xs break-words text-xs text-slate-500">{record.topic}</p>}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4"><StatusBadge status={record.status} /></td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600 tabular-nums">
                        {formatCheckInTime(record.recorded_at, record.status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
