import Link from "next/link";
import { notFound } from "next/navigation";

import AttendanceQrScanner from "@/components/attendance-qr-scanner";
import PendingSubmitButton from "@/components/pending-submit-button";

import {
  getAttendanceRoster,
  getAttendanceSession,
} from "@/lib/db/attendance";

import {
  finishAttendanceSession,
} from "../actions";

type AttendanceSessionPageProps = {
  params: Promise<{
    classId: string;
    sessionId: string;
  }>;
};

export default async function AttendanceSessionPage({
  params,
}: AttendanceSessionPageProps) {
  const {
    classId,
    sessionId,
  } = await params;

  const classIdNumber =
    Number(classId);

  const sessionIdNumber =
    Number(sessionId);

  if (
    !Number.isInteger(
      classIdNumber
    ) ||
    !Number.isInteger(
      sessionIdNumber
    )
  ) {
    notFound();
  }

  const session =
    await getAttendanceSession(
      classIdNumber,
      sessionIdNumber
    );

  if (!session) {
    notFound();
  }

  const roster =
    await getAttendanceRoster(
      classIdNumber,
      sessionIdNumber
    );

  const checkedInCount =
    session.present_count +
    session.late_count;

  const attendanceRate =
    session.total_students > 0
      ? Math.round(
          (checkedInCount /
            session.total_students) *
            100
        )
      : 0;

  const manualCheckInCount =
    roster.filter(
      (item) =>
        item.recording_method ===
          "MANUAL" &&
        (
          item.status === "PRESENT" ||
          item.status === "LATE" ||
          item.status === "EXCUSED"
        )
    ).length;

  function formatDateTime(
    value: string | null
  ) {
    if (!value) {
      return "—";
    }

    return new Date(
      value
    ).toLocaleString(
      undefined,
      {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }
    );
  }

  function formatTime(
    value: string | null
  ) {
    if (!value) {
      return "—";
    }

    return new Date(
      value
    ).toLocaleTimeString(
      undefined,
      {
        hour: "numeric",
        minute: "2-digit",
      }
    );
  }

  function getStudentName(
    student: typeof roster[number]
  ) {
    const middleInitial =
      student.middle_name
        ? `${student.middle_name.charAt(
            0
          )}.`
        : "";

    return [
      `${student.last_name},`,
      student.first_name,
      middleInitial,
      student.suffix,
    ]
      .filter(Boolean)
      .join(" ");
  }

  const finishAction =
    finishAttendanceSession.bind(
      null,
      classIdNumber,
      sessionIdNumber
    );

  return (
    <div>
      <Link
        href={
          `/classes/${classIdNumber}/attendance`
        }
        className="text-sm font-medium text-gray-500 hover:text-gray-900"
      >
        ← Back to Attendance
      </Link>

      <div className="mt-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Attendance Scanner
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            {
              session.session_date
            }
            {" • Meeting "}
            {
              session.meeting_no
            }
          </p>

          {session.topic && (
            <p className="mt-1 text-sm text-gray-500">
              {session.topic}
            </p>
          )}
        </div>

        <span
          className={
            session.status ===
            "OPEN"
              ? "inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700"
              : "inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600"
          }
        >
          {session.status}
        </span>
      </div>

      {session.status ===
      "OPEN" ? (
        <>
          <div className="mt-6 w-full">
            <AttendanceQrScanner
              classId={classIdNumber}
              sessionId={sessionIdNumber}
              initialRoster={roster}
            />
          </div>

          <div className="mt-6 w-full rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">
                  Finish Attendance
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  Students who have not checked in will be marked absent.
                </p>
              </div>

              <form
                action={finishAction}
                className="shrink-0"
              >
                <PendingSubmitButton
                  pendingLabel="Finishing..."
                  className="w-full rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-700 sm:w-auto"
                >
                  Finish Attendance
                </PendingSubmitButton>
              </form>
            </div>
          </div>
        </>
      ) : (
        <div className="mt-6 space-y-6">

          {/* SESSION SUMMARY */}

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Attendance Summary
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  Final attendance record for this meeting.
                </p>
              </div>

              <div className="text-left sm:text-right">
                <p className="text-3xl font-bold text-gray-900">
                  {attendanceRate}%
                </p>

                <p className="text-xs text-gray-500">
                  Attendance rate
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs font-medium text-gray-500">
                  Total Students
                </p>

                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {session.total_students}
                </p>
              </div>

              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs font-medium text-gray-500">
                  Checked In
                </p>

                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {checkedInCount}
                </p>
              </div>

              <div className="rounded-lg bg-green-50 p-4">
                <p className="text-xs font-medium text-green-700">
                  Present
                </p>

                <p className="mt-1 text-2xl font-bold text-green-800">
                  {session.present_count}
                </p>
              </div>

              <div className="rounded-lg bg-yellow-50 p-4">
                <p className="text-xs font-medium text-yellow-700">
                  Late
                </p>

                <p className="mt-1 text-2xl font-bold text-yellow-800">
                  {session.late_count}
                </p>
              </div>

              <div className="rounded-lg bg-red-50 p-4">
                <p className="text-xs font-medium text-red-700">
                  Absent
                </p>

                <p className="mt-1 text-2xl font-bold text-red-800">
                  {session.absent_count}
                </p>
              </div>

              <div className="rounded-lg bg-blue-50 p-4">
                <p className="text-xs font-medium text-blue-700">
                  Excused
                </p>

                <p className="mt-1 text-2xl font-bold text-blue-800">
                  {session.excused_count}
                </p>
              </div>

              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs font-medium text-gray-500">
                  QR Scanned
                </p>

                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {session.qr_scanned_count}
                </p>
              </div>

              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs font-medium text-gray-500">
                  Manual Check-ins
                </p>

                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {manualCheckInCount}
                </p>
              </div>
            </div>
          </div>


          {/* SESSION DETAILS */}

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="font-semibold text-gray-900">
              Session Details
            </h3>

            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                  Date
                </p>

                <p className="mt-1 text-sm font-medium text-gray-900">
                  {session.session_date}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                  Meeting
                </p>

                <p className="mt-1 text-sm font-medium text-gray-900">
                  Meeting {session.meeting_no}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                  Started
                </p>

                <p className="mt-1 text-sm font-medium text-gray-900">
                  {formatDateTime(
                    session.started_at
                  )}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                  Finished
                </p>

                <p className="mt-1 text-sm font-medium text-gray-900">
                  {formatDateTime(
                    session.ended_at
                  )}
                </p>
              </div>

              {session.topic && (
                <div className="sm:col-span-2 lg:col-span-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                    Topic
                  </p>

                  <p className="mt-1 text-sm font-medium text-gray-900">
                    {session.topic}
                  </p>
                </div>
              )}

            </div>
          </div>


          {/* STUDENT BREAKDOWN */}

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">

            <div className="border-b border-gray-100 px-6 py-5">
              <h3 className="font-semibold text-gray-900">
                Student Attendance
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                Final attendance status for each student.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">

                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Student
                    </th>

                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Status
                    </th>

                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Time
                    </th>

                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Method
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">

                  {roster.map(
                    (item) => (
                      <tr
                        key={
                          item.enrollment_id
                        }
                      >
                        <td className="px-6 py-4">
                          <Link
                            href={`/classes/${classIdNumber}/students/${item.student_id}`}
                            className="text-sm font-medium text-gray-900 transition hover:text-gray-600"
                          >
                            {getStudentName(
                              item
                            )}
                          </Link>

                          <p className="mt-0.5 text-xs text-gray-500">
                            {
                              item.student_number
                            }
                          </p>
                        </td>

                        <td className="px-6 py-4">
                          <span
                            className={
                              item.status ===
                              "PRESENT"
                                ? "inline-block rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700"

                                : item.status ===
                                    "LATE"
                                  ? "inline-block rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-medium text-yellow-700"

                                  : item.status ===
                                      "ABSENT"
                                    ? "inline-block rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700"

                                    : "inline-block rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700"
                            }
                          >
                            {item.status ?? "—"}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                          {item.status ===
                          "ABSENT"
                            ? "—"
                            : formatTime(
                                item.recorded_at
                              )}
                        </td>

                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                          {item.status ===
                          "ABSENT"
                            ? "Automatic"
                            : item.recording_method ===
                                "QR"
                              ? "QR Scan"
                              : item.recording_method ===
                                  "MANUAL"
                                ? "Manual"
                                : "—"}
                        </td>
                      </tr>
                    )
                  )}

                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
