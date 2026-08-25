import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getAttendanceSessions,
} from "@/lib/db/attendance";

type AttendancePageProps = {
  params: Promise<{
    classId: string;
  }>;
};

export default async function AttendancePage({
  params,
}: AttendancePageProps) {
  const { classId } = await params;
  const id = Number(classId);

  if (!Number.isInteger(id) || id <= 0) {
    notFound();
  }

  const sessions = await getAttendanceSessions(id);

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Attendance
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Take attendance using student QR codes.
          </p>
        </div>

        <Link
          href={`/classes/${id}/attendance/new`}
          className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 shadow-sm px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 sm:w-auto"
        >
          + Start Attendance
        </Link>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {sessions.length === 0 ? (
          <div className="p-10 text-center sm:p-12">
            <h3 className="font-semibold text-gray-900">
              No attendance yet
            </h3>

            <p className="mt-2 text-sm text-gray-500">
              Start your first attendance session.
            </p>

            <Link
              href={`/classes/${id}/attendance/new`}
              className="mt-5 inline-flex items-center justify-center rounded-lg bg-blue-600 shadow-sm px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              + Start Attendance
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {sessions.map((session) => (
              <Link
                key={session.id}
                href={`/classes/${id}/attendance/${session.id}`}
                className="flex flex-col items-start justify-between gap-4 p-5 transition hover:bg-gray-50 sm:flex-row sm:items-center"
              >
                <div className="min-w-0">
                  <div className="font-medium text-gray-900">
                    {session.session_date}
                  </div>

                  <div className="mt-1 text-sm text-gray-500">
                    Meeting {session.meeting_no}
                    {session.topic
                      ? ` • ${session.topic}`
                      : ""}
                  </div>
                </div>

                <div className="w-full text-left sm:w-auto sm:text-right">
                  <div className="text-sm font-semibold text-gray-900">
                    {session.checked_in_count}
                    {" / "}
                    {session.total_students}
                    {" checked in"}
                  </div>

                  {session.status === "CLOSED" && (
                    <div className="mt-1 text-xs text-gray-500">
                      {session.present_count} present
                      {" • "}
                      {session.late_count} late
                      {" • "}
                      {session.absent_count} absent
                      {session.excused_count > 0 && (
                        <>
                          {" • "}
                          {session.excused_count} excused
                        </>
                      )}
                    </div>
                  )}

                  <span
                    className={
                      session.status === "OPEN"
                        ? "mt-2 inline-block rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700"
                        : "mt-2 inline-block rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600"
                    }
                  >
                    {session.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
