"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  BrowserQRCodeReader,
} from "@zxing/browser";

import Link from "next/link";

import type {
  AttendanceRosterItem,
} from "@/lib/db/attendance";

type ScanStudent = {
  enrollmentId: number;
  studentNumber: string;
  name: string;
  status: string | null;
  recordedAt: string | null;
  recordingMethod?: "QR" | "MANUAL" | null;
};

type ApiResponse = {
  code: string;
  message: string;
  student?: ScanStudent;
};

type Props = {
  classId: number;
  sessionId: number;
  initialRoster: AttendanceRosterItem[];
};

export default function AttendanceQrScanner({
  classId,
  sessionId,
  initialRoster,
}: Props) {
  const videoRef =
    useRef<HTMLVideoElement>(null);

  const busyRef =
    useRef(false);

  const lastPayloadRef =
    useRef("");

  const lastScanTimeRef =
    useRef(0);

  const [
    roster,
    setRoster,
  ] = useState(initialRoster);

  const [
    status,
    setStatus,
  ] = useState<
    | "IDLE"
    | "SUCCESS"
    | "WARNING"
    | "ERROR"
  >("IDLE");

  const [
    message,
    setMessage,
  ] = useState(
    "Point the camera at a student QR code."
  );

  const [
    student,
    setStudent,
  ] = useState<
    ScanStudent | undefined
  >();

  const [
    manualBusyEnrollment,
    setManualBusyEnrollment,
  ] = useState<
    number | null
  >(null);

  const checkedInCount =
    useMemo(
      () =>
        roster.filter(
          (item) =>
            item.status === "PRESENT" ||
            item.status === "LATE"
        ).length,
      [roster]
    );

  const totalStudents =
    roster.length;

  // ---------------------------------------------------------
  // UPDATE A STUDENT IN THE LIVE ROSTER
  // ---------------------------------------------------------

  function updateRoster(
    updatedStudent:
      | ScanStudent
      | undefined,
    defaultMethod:
      | "QR"
      | "MANUAL"
      | null
  ) {
    if (!updatedStudent) {
      return;
    }

    setRoster(
      (currentRoster) =>
        currentRoster.map(
          (item) => {
            if (
              item.enrollment_id !==
              updatedStudent.enrollmentId
            ) {
              return item;
            }

            return {
              ...item,

              status:
                updatedStudent.status as
                  | "PRESENT"
                  | "LATE"
                  | "ABSENT"
                  | "EXCUSED"
                  | null,

              recorded_at:
                updatedStudent.recordedAt,

              recording_method:
                updatedStudent.recordingMethod ??
                defaultMethod,
            };
          }
        )
    );
  }

  // ---------------------------------------------------------
  // QR CAMERA
  // ---------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    let controls:
      | {
          stop: () => void;
        }
      | undefined;

    const reader =
      new BrowserQRCodeReader(
        undefined,
        {
          delayBetweenScanAttempts:
            100,

          delayBetweenScanSuccess:
            500,
        }
      );

    async function startScanner() {
      if (
        cancelled ||
        !videoRef.current
      ) {
        return;
      }

      try {
        const newControls =
          await reader.decodeFromConstraints(
            {
              audio: false,

              video: {
                facingMode: {
                  ideal:
                    "environment",
                },
              },
            },

            videoRef.current,

            async (
              result,
              error
            ) => {
              if (
                error &&
                error.name !==
                  "NotFoundException"
              ) {
                console.warn(
                  "ZXing decode error:",
                  error
                );
              }

              if (
                cancelled ||
                !result
              ) {
                return;
              }

              const payload =
                result.getText();

              const now =
                Date.now();

              if (
                payload ===
                  lastPayloadRef.current &&
                now -
                  lastScanTimeRef.current <
                  3000
              ) {
                return;
              }

              if (
                busyRef.current
              ) {
                return;
              }

              busyRef.current =
                true;

              lastPayloadRef.current =
                payload;

              lastScanTimeRef.current =
                now;

              try {
                const response =
                  await fetch(
                    `/api/classes/${classId}/attendance/${sessionId}/scan`,
                    {
                      method:
                        "POST",

                      headers: {
                        "Content-Type":
                          "application/json",
                      },

                      body:
                        JSON.stringify({
                          payload,
                        }),
                    }
                  );

                const contentType =
                  response.headers.get(
                    "content-type"
                  ) ?? "";

                const rawBody =
                  await response.text();

                if (
                  !contentType.includes(
                    "application/json"
                  )
                ) {
                  setStatus(
                    "ERROR"
                  );

                  setStudent(
                    undefined
                  );

                  setMessage(
                    `Scan endpoint returned HTTP ${response.status}.`
                  );

                  return;
                }

                const data =
                  JSON.parse(
                    rawBody
                  ) as ApiResponse;

                // NEW QR RECORD

                if (
                  data.code ===
                  "RECORDED"
                ) {
                  setStudent(
                    data.student
                  );

                  setStatus(
                    "SUCCESS"
                  );

                  setMessage(
                    data.message
                  );

                  updateRoster(
                    data.student,
                    "QR"
                  );

                  return;
                }

                // QR ALREADY RECORDED

                if (
                  data.code ===
                  "ALREADY_RECORDED"
                ) {
                  setStudent(
                    data.student
                  );

                  setStatus(
                    "WARNING"
                  );

                  setMessage(
                    data.message
                  );

                  updateRoster(
                    data.student,
                    "QR"
                  );

                  return;
                }

                setStudent(
                  data.student
                );

                setStatus(
                  "ERROR"
                );

                setMessage(
                  data.message
                );
              } catch (error) {
                console.error(
                  "Attendance scan request failed:",
                  error
                );

                setStatus(
                  "ERROR"
                );

                setStudent(
                  undefined
                );

                setMessage(
                  "Could not record attendance."
                );
              } finally {
                window.setTimeout(
                  () => {
                    busyRef.current =
                      false;
                  },
                  800
                );
              }
            }
          );

        if (cancelled) {
          newControls.stop();
          return;
        }

        controls =
          newControls;
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error(
          "QR scanner startup failed:",
          error
        );

        setStatus(
          "ERROR"
        );

        setMessage(
          "Camera could not be started. Check your browser camera permission."
        );
      }
    }

    const startTimer =
      window.setTimeout(
        () => {
          void startScanner();
        },
        100
      );

    return () => {
      cancelled = true;

      window.clearTimeout(
        startTimer
      );

      controls?.stop();

      const video =
        videoRef.current;

      if (
        video?.srcObject instanceof
        MediaStream
      ) {
        video.srcObject
          .getTracks()
          .forEach(
            (track) =>
              track.stop()
          );

        video.srcObject =
          null;
      }
    };
  }, [
    classId,
    sessionId,
  ]);

  // ---------------------------------------------------------
  // MANUAL ATTENDANCE
  // ---------------------------------------------------------

  async function setManualAttendance(
    enrollmentId: number,
    attendanceStatus:
      | "PRESENT"
      | "LATE"
      | "EXCUSED"
      | "CLEAR"
  ) {
    if (
      manualBusyEnrollment !== null
    ) {
      return;
    }

    setManualBusyEnrollment(
      enrollmentId
    );

    try {
      const response =
        await fetch(
          `/api/classes/${classId}/attendance/${sessionId}/manual`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                enrollmentId,
                status:
                  attendanceStatus,
              }),
          }
        );

      const contentType =
        response.headers.get(
          "content-type"
        ) ?? "";

      const rawBody =
        await response.text();

      if (
        !contentType.includes(
          "application/json"
        )
      ) {
        setStatus(
          "ERROR"
        );

        setMessage(
          `Manual attendance returned HTTP ${response.status}.`
        );

        return;
      }

      const data =
        JSON.parse(
          rawBody
        ) as ApiResponse;

      if (
        data.code ===
          "UPDATED" ||
        data.code ===
          "CLEARED"
      ) {
        updateRoster(
          data.student,
          data.code === "CLEARED"
            ? null
            : "MANUAL"
        );

        setStudent(
          data.student
        );

        setStatus(
          "SUCCESS"
        );

        setMessage(
          data.message
        );

        return;
      }

      setStatus(
        "ERROR"
      );

      setMessage(
        data.message ||
          "Could not update attendance."
      );
    } catch (error) {
      console.error(
        "Manual attendance request failed:",
        error
      );

      setStatus(
        "ERROR"
      );

      setMessage(
        "Could not update attendance."
      );
    } finally {
      setManualBusyEnrollment(
        null
      );
    }
  }

  // ---------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------

  function formatTime(
    value: string | null
  ) {
    if (!value) {
      return "";
    }

    return new Date(
      value
    ).toLocaleTimeString(
      undefined,
      {
        hour:
          "numeric",

        minute:
          "2-digit",
      }
    );
  }

  function getStudentName(
    item: AttendanceRosterItem
  ) {
    const middleInitial =
      item.middle_name
        ? `${item.middle_name.charAt(
            0
          )}.`
        : "";

    return [
      `${item.last_name},`,
      item.first_name,
      middleInitial,
      item.suffix,
    ]
      .filter(Boolean)
      .join(" ");
  }

  // ---------------------------------------------------------
  // UI
  // ---------------------------------------------------------

  return (
    <div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">

        {/* =================================================
            QR SCANNER
        ================================================= */}

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <div>
              <p className="text-sm text-gray-500">
                Checked in
              </p>

              <p className="text-2xl font-bold text-gray-900">
                {checkedInCount}
                {" / "}
                {totalStudents}
              </p>
            </div>

            <div className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
              Scanner Active
            </div>
          </div>

          <div className="relative overflow-hidden bg-black">
            <video
              ref={videoRef}
              className="attendance-camera-preview aspect-4/3 w-full -scale-x-100 object-cover"
              muted
              playsInline
            />

            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-52 w-52 rounded-2xl border-2 border-white/80" />
            </div>
          </div>

          <div
            className={
              status === "SUCCESS"
                ? "rounded-xl border border-green-200 bg-green-50 p-5"

                : status === "WARNING"
                  ? "rounded-xl border border-yellow-200 bg-yellow-50 p-5"

                  : status === "ERROR"
                    ? "rounded-xl border border-red-200 bg-red-50 p-5"

                    : "rounded-xl border border-gray-200 bg-gray-50 p-5"
            }
          >
            <p className="font-semibold text-gray-900">
              {status === "SUCCESS"
                ? "✓ Attendance Updated"

                : status === "WARNING"
                  ? "Already Recorded"

                  : status === "ERROR"
                    ? "Attendance Error"

                    : "Ready to Scan"}
            </p>

            {student && (
              <div className="mt-2">
                <p className="text-lg font-semibold text-gray-900">
                  {student.name}
                </p>

                <p className="text-sm text-gray-600">
                  {student.studentNumber}

                  {student.status && (
                    <>
                      {" • "}
                      {student.status}
                    </>
                  )}

                  {student.recordedAt
                    ? ` • ${formatTime(
                        student.recordedAt
                      )}`
                    : ""}
                </p>
              </div>
            )}

            <p className="mt-2 text-sm text-gray-600">
              {message}
            </p>
          </div>
        </div>

        {/* =================================================
            LIVE ROSTER
        ================================================= */}

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4">

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">
                  Live Roster
                </h3>

                <p className="mt-1 text-xs text-gray-500">
                  QR or manual attendance.
                </p>
              </div>

              <div className="text-sm font-semibold text-gray-900">
                {checkedInCount}
                {" / "}
                {totalStudents}
              </div>
            </div>
          </div>

          <div className="max-h-650px divide-y divide-gray-100 overflow-y-auto">

            {roster.map(
              (item) => {

                const checkedIn =
                  item.status ===
                    "PRESENT" ||
                  item.status ===
                    "LATE";

                const busy =
                  manualBusyEnrollment ===
                  item.enrollment_id;

                return (
                  <div
                    key={
                      item.enrollment_id
                    }
                    className={
                      checkedIn
                        ? "bg-green-50/40 px-5 py-4"
                        : "px-5 py-4"
                    }
                  >

                    <div className="flex items-start justify-between gap-4">

                      {/* STUDENT */}

                      <div className="flex min-w-0 items-start gap-3">

                        <span
                          className={
                            checkedIn
                              ? "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-700"

                              : item.status ===
                                  "EXCUSED"
                                ? "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700"

                                : "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs text-gray-400"
                          }
                        >
                          {checkedIn
                            ? "✓"

                            : item.status ===
                                "EXCUSED"
                              ? "E"

                              : "○"}
                        </span>

                        <div className="min-w-0">
                          <Link
                            href={`/classes/${classId}/students/${item.student_id}`}
                            className="block truncate text-sm font-medium text-gray-900 transition hover:text-gray-600"
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
                        </div>
                      </div>

                      {/* STATUS */}

                      <div className="shrink-0 text-right">

                        {item.status ? (
                          <>
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
                              {item.status}
                            </span>

                            {item.recorded_at && (
                              <p className="mt-1 text-xs text-gray-500">
                                {formatTime(
                                  item.recorded_at
                                )}

                                {item.recording_method
                                  ? ` • ${item.recording_method}`
                                  : ""}
                              </p>
                            )}
                          </>
                        ) : (
                          <span className="text-xs font-medium text-gray-400">
                            Not scanned
                          </span>
                        )}
                      </div>
                    </div>

                    {/* MANUAL CONTROLS */}

                    <div className="mt-3 flex flex-wrap gap-2 pl-9">

                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void setManualAttendance(
                            item.enrollment_id,
                            "PRESENT"
                          )
                        }
                        className="rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Present
                      </button>

                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void setManualAttendance(
                            item.enrollment_id,
                            "LATE"
                          )
                        }
                        className="rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Late
                      </button>

                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void setManualAttendance(
                            item.enrollment_id,
                            "EXCUSED"
                          )
                        }
                        className="rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Excused
                      </button>

                      {item.status && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void setManualAttendance(
                              item.enrollment_id,
                              "CLEAR"
                            )
                          }
                          className="rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          Clear
                        </button>
                      )}

                    </div>

                  </div>
                );
              }
            )}

          </div>
        </div>

      </div>
    </div>
  );
}
