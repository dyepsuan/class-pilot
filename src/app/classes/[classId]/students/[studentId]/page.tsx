import Link from "next/link";
import { notFound } from "next/navigation";
import EditStudentModal from "@/components/EditStudentModal";
import StudentEnrollmentActions from "@/components/StudentEnrollmentActions";

import {
  getStudentLaboratoryScore,
  getStudentProfile,
  getStudentQuizPercentage,
  summarizeStudentAttendance,
  summarizeStudentLaboratories,
  summarizeStudentQuizzes,
  type AttendanceStatus,
} from "@/lib/db/student-profile";
import {
  formatPhilippineDateTime,
  parseStoredTimestamp,
} from "@/lib/datetime";

type PageProps = {
  params: Promise<{
    classId: string;
    studentId: string;
  }>;
};

type ActivityItem = {
  key: string;
  occurredAt: string;
  label: string;
  detail: string;
  tone: "green" | "yellow" | "red" | "blue" | "gray";
};

const attendanceBadgeClasses: Record<AttendanceStatus, string> = {
  PRESENT: "bg-green-100 text-green-700",
  LATE: "bg-yellow-100 text-yellow-700",
  ABSENT: "bg-red-100 text-red-700",
  EXCUSED: "bg-blue-100 text-blue-700",
};

const activityToneClasses: Record<ActivityItem["tone"], string> = {
  green: "bg-green-100 text-green-700",
  yellow: "bg-yellow-100 text-yellow-700",
  red: "bg-red-100 text-red-700",
  blue: "bg-blue-100 text-blue-700",
  gray: "bg-gray-100 text-gray-600",
};

function getFullName(student: {
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
}) {
  return [
    student.first_name,
    student.middle_name,
    student.last_name,
    student.suffix,
  ]
    .filter(Boolean)
    .join(" ");
}

function getInitials(student: {
  first_name: string;
  last_name: string;
}) {
  return `${student.first_name.charAt(0)}${student.last_name.charAt(0)}`.toUpperCase();
}

function parseStoredDate(value: string) {
  return parseStoredTimestamp(value) ?? new Date(Number.NaN);
}

function formatDate(value: string | null) {
  if (!value) {
    return "—";
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

function formatActivityDate(value: string) {
  return formatPhilippineDateTime(value, value);
}

function formatScore(value: number) {
  return new Intl.NumberFormat("en-PH", {
    maximumFractionDigits: 2,
  }).format(value);
}

function SummaryCard({
  label,
  value,
  supportingText,
  emphasized = false,
}: {
  label: string;
  value: string;
  supportingText: string;
  emphasized?: boolean;
}) {
  return (
    <article
      className={`relative overflow-hidden rounded-xl border p-5 ${
        emphasized
          ? "border-gray-300 bg-gray-50"
          : "border-gray-200 bg-white"
      }`}
    >
      {emphasized && (
        <span
          className="absolute inset-y-0 left-0 w-1 bg-gray-300"
          aria-hidden="true"
        />
      )}
      <p className="text-xs font-semibold tracking-wide text-gray-500">
        {label}
      </p>
      <p
        className={`mt-3 font-semibold tabular-nums tracking-tight text-gray-950 ${
          emphasized ? "text-3xl" : "text-2xl"
        }`}
      >
        {value}
      </p>
      <p className="mt-1.5 text-xs leading-5 text-gray-500">
        {supportingText}
      </p>
    </article>
  );
}

function SectionHeader({
  title,
  subtitle,
  summary,
}: {
  title: string;
  subtitle: string;
  summary?: string;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-gray-950">
          {title}
        </h2>
        <p className="mt-1 text-sm leading-5 text-gray-500">{subtitle}</p>
      </div>
      {summary && (
        <p className="shrink-0 text-sm font-medium text-gray-600">
          {summary}
        </p>
      )}
    </div>
  );
}

function EmptyState({
  marker,
  title,
  description,
}: {
  marker: string;
  title: string;
  description: string;
}) {
  return (
    <div className="px-6 py-9 text-center">
      <span
        className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-xs font-semibold text-gray-500"
        aria-hidden="true"
      >
        {marker}
      </span>
      <p className="mt-3 text-sm font-medium text-gray-900">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm leading-5 text-gray-500">
        {description}
      </p>
    </div>
  );
}

export default async function StudentProfilePage({ params }: PageProps) {
  const { classId, studentId } = await params;
  const numericClassId = Number(classId);
  const numericStudentId = Number(studentId);

  if (
    !Number.isInteger(numericClassId) ||
    numericClassId <= 0 ||
    !Number.isInteger(numericStudentId) ||
    numericStudentId <= 0
  ) {
    notFound();
  }

  const profile = await getStudentProfile(
    numericClassId,
    numericStudentId
  );

  if (!profile) {
    notFound();
  }

  const { student, attendance, quizzes, laboratories } = profile;
  const studentName = getFullName(student);
  const isArchived = student.enrollment_status !== "ACTIVE";

  const attendanceSummaryValues = summarizeStudentAttendance(attendance);
  const attendanceCounts: Record<AttendanceStatus, number> = {
    PRESENT: attendanceSummaryValues.present,
    LATE: attendanceSummaryValues.late,
    ABSENT: attendanceSummaryValues.absent,
    EXCUSED: attendanceSummaryValues.excused,
  };
  const attendedCount = attendanceSummaryValues.attended;
  const attendancePercentage = attendanceSummaryValues.percentage;

  const quizSummaryValues = summarizeStudentQuizzes(quizzes);
  const scoredQuizzes = quizzes.filter(
    (quiz) => quiz.status === "SCORED" && quiz.score !== null
  );
  const quizPercentage = quizSummaryValues.percentage;

  const laboratorySummaryValues = summarizeStudentLaboratories(laboratories);
  const gradedLaboratories = laboratories.flatMap((laboratory) => {
    const score = getStudentLaboratoryScore(laboratory);

    return score === null ? [] : [{ laboratory, score }];
  });
  const laboratoryPercentage = laboratorySummaryValues.percentage;

  const availablePercentages = [
    attendancePercentage,
    quizPercentage,
    laboratoryPercentage,
  ].filter((value): value is number => value !== null);
  const performanceAverage =
    availablePercentages.length > 0
      ? availablePercentages.reduce((total, value) => total + value, 0) /
        availablePercentages.length
      : null;

  const attendanceSummary = (
    ["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const
  )
    .filter((status) => attendanceCounts[status] > 0)
    .map((status) => ({
      status,
      label: `${attendanceCounts[status]} ${status.charAt(0)}${status
        .slice(1)
        .toLowerCase()}`,
    }));

  const activities: ActivityItem[] = [];

  for (const record of attendance) {
    if (!record.recorded_at) {
      continue;
    }

    const statusLabel =
      record.status.charAt(0) + record.status.slice(1).toLowerCase();
    const tone: ActivityItem["tone"] =
      record.status === "PRESENT"
        ? "green"
        : record.status === "LATE"
          ? "yellow"
          : record.status === "ABSENT"
            ? "red"
            : "blue";

    activities.push({
      key: `attendance-${record.session_id}`,
      occurredAt: record.recorded_at,
      label: "Attendance",
      detail: `${statusLabel} during Meeting ${record.meeting_no}`,
      tone,
    });
  }

  for (const quiz of quizzes) {
    const detail =
      quiz.status === "SCORED" && quiz.score !== null
        ? `Scored ${formatScore(Number(quiz.score))} / ${formatScore(
            Number(quiz.max_score)
          )} on Quiz ${quiz.sequence_no}`
        : `${quiz.status === "ABSENT" ? "Absent" : "Excused"} for Quiz ${
            quiz.sequence_no
          }`;

    activities.push({
      key: `quiz-${quiz.quiz_id}`,
      occurredAt: quiz.updated_at,
      label: "Quiz",
      detail,
      tone:
        quiz.status === "SCORED"
          ? "green"
          : quiz.status === "ABSENT"
            ? "red"
            : "blue",
    });
  }

  for (const { laboratory, score } of gradedLaboratories) {
    if (!laboratory.score_updated_at) {
      continue;
    }

    activities.push({
      key: `laboratory-${laboratory.laboratory_id}`,
      occurredAt: laboratory.score_updated_at,
      label: "Laboratory",
      detail: `Scored ${formatScore(score)} / ${formatScore(
        Number(laboratory.total_points)
      )} on Laboratory ${laboratory.lab_no}`,
      tone: "gray",
    });
  }

  activities.sort(
    (left, right) =>
      parseStoredDate(right.occurredAt).getTime() -
      parseStoredDate(left.occurredAt).getTime()
  );
  const recentActivities = activities.slice(0, 10);

  return (
    <div className="w-full">
      <nav aria-label="Student navigation">
        <Link
          href={`/classes/${numericClassId}/students${
            isArchived ? "?view=archived" : ""
          }`}
          className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-gray-500 transition-colors hover:text-gray-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2"
        >
          <span aria-hidden="true">&larr;</span>
          Back to Students
        </Link>
      </nav>

      <header className="mt-4 flex flex-col gap-4 border-b border-gray-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-4 sm:items-center">
          <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-xl bg-gray-200 text-sm font-semibold tracking-wide text-gray-700 ring-1 ring-inset ring-gray-300">
            {getInitials(student)}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold tracking-wide text-gray-500">
              Student profile
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="mt-1 min-w-0 text-2xl font-bold leading-tight tracking-tight text-gray-950 sm:text-3xl">
                {studentName}
              </h1>
              {isArchived && (
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                  Archived
                </span>
              )}
            </div>

            <div className="mt-2 flex min-w-0 flex-col gap-1 text-sm text-gray-500 sm:flex-row sm:flex-wrap sm:gap-x-3">
              <span className="font-medium text-gray-600">
                {student.student_number}
              </span>
              {student.email && (
                <>
                  <span className="hidden text-gray-300 sm:inline" aria-hidden="true">
                    &bull;
                  </span>
                  <span className="min-w-0 break-all sm:break-normal">
                    {student.email}
                  </span>
                </>
              )}
              {isArchived && student.left_on && (
                <>
                  <span className="hidden text-gray-300 sm:inline" aria-hidden="true">
                    &bull;
                  </span>
                  <span>Removed {formatDate(student.left_on)}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <EditStudentModal
            classId={numericClassId}
            studentId={numericStudentId}
            student={{
              student_number: student.student_number,
              first_name: student.first_name,
              middle_name: student.middle_name,
              last_name: student.last_name,
              suffix: student.suffix,
              email: student.email,
            }}
          />
          <StudentEnrollmentActions
            classId={numericClassId}
            studentId={numericStudentId}
            studentName={studentName}
            archived={isArchived}
          />
        </div>
      </header>

      <section
        aria-label="Student performance summary"
        className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <SummaryCard
          label="Attendance"
          value={
            attendancePercentage === null
              ? "—"
              : `${Math.round(attendancePercentage)}%`
          }
          supportingText={
            attendance.length > 0
              ? `${attendedCount} attended out of ${attendance.length} sessions`
              : "No finalized attendance records yet"
          }
        />
        <SummaryCard
          label="Quiz Average"
          value={
            quizPercentage === null ? "—" : `${Math.round(quizPercentage)}%`
          }
          supportingText={`${scoredQuizzes.length} ${
            scoredQuizzes.length === 1 ? "quiz" : "quizzes"
          } recorded`}
        />
        <SummaryCard
          label="Laboratory Average"
          value={
            laboratoryPercentage === null
              ? "—"
              : `${Math.round(laboratoryPercentage)}%`
          }
          supportingText={
            gradedLaboratories.length > 0
              ? `${gradedLaboratories.length} ${
                  gradedLaboratories.length === 1
                    ? "laboratory"
                    : "laboratories"
                } graded`
              : "No graded laboratories yet"
          }
        />
        <SummaryCard
          label="Performance Average"
          value={
            performanceAverage === null
              ? "—"
              : `${Math.round(performanceAverage)}%`
          }
          supportingText="Based on available class records"
          emphasized
        />
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.75fr)] xl:items-start">
        <div className="space-y-6">
          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <SectionHeader
              title="Attendance History"
              subtitle="Finalized attendance records for this class."
              summary={`${attendance.length} finalized ${
                attendance.length === 1 ? "session" : "sessions"
              }`}
            />

            {attendance.length === 0 ? (
              <EmptyState
                marker="A"
                title="No attendance records yet."
                description="Finalized attendance records will appear here."
              />
            ) : (
              <>
                <div className="flex flex-wrap gap-2 border-b border-gray-100 px-5 py-3 sm:px-6">
                  {attendanceSummary.map((item) => (
                    <span
                      key={item.status}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold ${attendanceBadgeClasses[item.status]}`}
                    >
                      {item.label}
                    </span>
                  ))}
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-[520px] divide-y divide-gray-200 sm:min-w-full">
                  <thead className="bg-gray-50/80">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 sm:px-6">
                        Date
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 sm:px-6">
                        Meeting
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 sm:px-6">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {attendance.map((record) => (
                      <tr key={record.session_id} className="transition-colors hover:bg-gray-50/70">
                        <td className="whitespace-nowrap px-5 py-4 text-sm tabular-nums text-gray-600 sm:px-6">
                          {formatDate(record.session_date)}
                        </td>
                        <td className="px-5 py-4 sm:px-6">
                          <Link
                            href={`/classes/${numericClassId}/attendance/${record.session_id}`}
                            className="rounded-sm text-sm font-medium text-gray-900 transition-colors hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                          >
                            Meeting {record.meeting_no}
                          </Link>
                          {record.topic && (
                            <p className="mt-0.5 max-w-xs truncate text-xs text-gray-500">
                              {record.topic}
                            </p>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 sm:px-6">
                          <span
                            className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${attendanceBadgeClasses[record.status]}`}
                          >
                            {record.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  </table>
                </div>
              </>
            )}
          </section>

          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <SectionHeader
              title="Quiz Performance"
              subtitle="Recorded quiz results and points earned."
              summary={`${quizzes.length} recorded ${
                quizzes.length === 1 ? "quiz" : "quizzes"
              }`}
            />

            {quizzes.length === 0 ? (
              <EmptyState
                marker="Q"
                title="No quiz scores recorded yet."
                description="Quiz results will appear after scores are recorded."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[640px] divide-y divide-gray-200 sm:min-w-full">
                  <thead className="bg-gray-50/80">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 sm:px-6">
                        Quiz
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 sm:px-6">
                        Score
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 sm:px-6">
                        Percentage
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 sm:px-6">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {quizzes.map((quiz) => {
                      const scorePercentage = getStudentQuizPercentage(quiz);

                      return (
                        <tr key={quiz.quiz_id} className="transition-colors hover:bg-gray-50/70">
                          <td className="px-5 py-4 sm:px-6">
                            <Link
                              href={`/classes/${numericClassId}/quizzes/${quiz.quiz_id}`}
                              className="rounded-sm text-sm font-medium text-gray-900 transition-colors hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                            >
                              Quiz {quiz.sequence_no}
                            </Link>
                            <p className="mt-0.5 max-w-xs truncate text-xs text-gray-500">
                              {quiz.title}
                            </p>
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 text-sm sm:px-6">
                            {quiz.status === "SCORED" && quiz.score !== null ? (
                              <span className="font-semibold tabular-nums text-gray-900">
                                {formatScore(Number(quiz.score))} /{" "}
                                {formatScore(Number(quiz.max_score))}
                              </span>
                            ) : (
                              <span
                                className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
                                  quiz.status === "ABSENT"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-blue-100 text-blue-700"
                                }`}
                              >
                                {quiz.status}
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 text-sm sm:px-6">
                            {scorePercentage === null
                              ? <span className="text-gray-400">&mdash;</span>
                              : (
                                  <span className="inline-flex rounded-md bg-gray-100 px-2 py-1 text-xs font-semibold tabular-nums text-gray-700">
                                    {scorePercentage.toFixed(1)}%
                                  </span>
                                )}
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600 sm:px-6">
                            {formatDate(quiz.date_given)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <SectionHeader
              title="Laboratory Performance"
              subtitle="Individual totals include the shared group score when applicable."
              summary={`${gradedLaboratories.length} graded ${
                gradedLaboratories.length === 1 ? "laboratory" : "laboratories"
              }`}
            />

            {laboratories.length === 0 ? (
              <EmptyState
                marker="L"
                title="No laboratory scores recorded yet."
                description="Laboratory results will appear after scores are recorded."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[520px] divide-y divide-gray-200 sm:min-w-full">
                  <thead className="bg-gray-50/80">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 sm:px-6">
                        Laboratory
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 sm:px-6">
                        Score
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 sm:px-6">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {laboratories.map((laboratory) => {
                      const score = getStudentLaboratoryScore(laboratory);
                      const isScored = score !== null;

                      return (
                        <tr key={laboratory.laboratory_id} className="transition-colors hover:bg-gray-50/70">
                          <td className="px-5 py-4 sm:px-6">
                            <Link
                              href={`/classes/${numericClassId}/laboratories/${laboratory.laboratory_id}`}
                              className="rounded-sm text-sm font-medium text-gray-900 transition-colors hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                            >
                              Laboratory {laboratory.lab_no}
                            </Link>
                            <p className="mt-0.5 max-w-xs truncate text-xs text-gray-500">
                              {laboratory.title}
                            </p>
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 text-sm sm:px-6">
                            {isScored ? (
                              <span className="font-semibold tabular-nums text-gray-900">
                                {formatScore(score)} /{" "}
                                {formatScore(Number(laboratory.total_points))}
                              </span>
                            ) : (
                              <span className="text-gray-400">&mdash;</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 sm:px-6">
                            <span
                              className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
                                isScored
                                  ? "bg-green-100 text-green-700"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {isScored ? "Scored" : "Pending"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white xl:sticky xl:top-6">
          <SectionHeader
            title="Recent Activity"
            subtitle="The student&apos;s latest class records."
            summary="Latest class records"
          />

          {recentActivities.length === 0 ? (
            <EmptyState
              marker="R"
              title="No recent activity yet."
              description="Recorded attendance and scores will appear here."
            />
          ) : (
            <ol className="px-5 py-1 sm:px-6">
              {recentActivities.map((activity, index) => (
                <li key={activity.key} className="relative flex gap-3 py-[1.125rem]">
                  <div className="relative flex w-8 shrink-0 justify-center">
                    {index < recentActivities.length - 1 && (
                      <span
                        className="absolute left-1/2 top-8 h-[calc(100%+0.25rem)] w-px -translate-x-1/2 bg-gray-200"
                        aria-hidden="true"
                      />
                    )}
                    <span
                      className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-bold ${activityToneClasses[activity.tone]}`}
                      aria-hidden="true"
                    >
                      {activity.label.charAt(0)}
                    </span>
                  </div>
                  <div
                    className={`min-w-0 flex-1 pb-[1.125rem] ${
                      index < recentActivities.length - 1
                        ? "border-b border-gray-100"
                        : ""
                    }`}
                  >
                    <p className="text-sm font-medium leading-5 text-gray-900">
                      {activity.detail}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-gray-500">
                      <span className="font-medium text-gray-600">{activity.label}</span>
                      <span className="px-1.5 text-gray-300" aria-hidden="true">&bull;</span>
                      <time dateTime={activity.occurredAt}>
                        {formatActivityDate(activity.occurredAt)}
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
