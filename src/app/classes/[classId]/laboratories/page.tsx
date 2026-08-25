import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";

import CollapsibleCompletedLabs from "./CollapsibleCompletedLabs";

type Laboratory = {
  id: number;
  lab_no: number;
  title: string;
  description: string | null;

  lab_type: "individual" | "group";

  total_points: number;
  group_points: number;
  individual_points: number;

  start_date: string | null;
  due_date: string | null;

  status: "open" | "completed";

  graded_count: number;
  group_count: number;
  scored_group_count: number;

  student_count: number;

  class_average: number | null;
};

type PageProps = {
  params: Promise<{
    classId: string;
  }>;
};

function formatShortDate(date: string | null) {
  if (!date) {
    return null;
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(
    new Date(`${date}T00:00:00+08:00`)
  );
}

function formatDateRange(
  startDate: string | null,
  dueDate: string | null
) {
  const start = formatShortDate(startDate);
  const due = formatShortDate(dueDate);

  if (start && due) {
    return `${start} → ${due}`;
  }

  if (start) {
    return `Starts ${start}`;
  }

  if (due) {
    return `Due ${due}`;
  }

  return "Dates not set";
}



export default async function LaboratoriesPage({
  params,
}: PageProps) {
  const { classId } = await params;

  const numericClassId = Number(classId);

  const { env } = getCloudflareContext();

  const result = await env.DB.prepare(
    `
      SELECT
        l.id,
        l.lab_no,
        l.title,
        l.description,
        l.lab_type,
        l.total_points,
        l.group_points,
        l.individual_points,
        l.start_date,
        l.due_date,
        l.status,

        /* Active students in the class */
        (
          SELECT COUNT(*)
          FROM enrollments e
          WHERE e.class_id = l.class_id
            AND e.status = 'ACTIVE'
        ) AS student_count,

        /* Individual/student scores entered */
        (
          SELECT COUNT(*)
          FROM laboratory_scores ls
          WHERE ls.laboratory_id = l.id
            AND ls.individual_score IS NOT NULL
        ) AS graded_count,

        /* Total groups */
        (
          SELECT COUNT(*)
          FROM laboratory_groups lg
          WHERE lg.laboratory_id = l.id
        ) AS group_count,

        /* Groups with a shared group score */
        (
          SELECT COUNT(*)
          FROM laboratory_groups lg
          WHERE lg.laboratory_id = l.id
            AND lg.group_score IS NOT NULL
        ) AS scored_group_count,

        /* Class average percentage */
        CASE

          WHEN l.lab_type = 'individual' THEN (
            SELECT
              AVG(
                (ls.individual_score / l.total_points) * 100
              )
            FROM laboratory_scores ls
            WHERE ls.laboratory_id = l.id
              AND ls.individual_score IS NOT NULL
          )

          ELSE (
            SELECT
              AVG(
                (
                  lg.group_score +
                  ls.individual_score
                ) / l.total_points * 100
              )

            FROM laboratory_group_members lgm

            INNER JOIN laboratory_groups lg
              ON lg.id = lgm.laboratory_group_id

            INNER JOIN laboratory_scores ls
              ON ls.laboratory_id = l.id
              AND ls.student_id = lgm.student_id

            WHERE lg.laboratory_id = l.id
              AND lg.group_score IS NOT NULL
              AND ls.individual_score IS NOT NULL
          )

        END AS class_average

      FROM laboratories l

      WHERE l.class_id = ?

      ORDER BY
        l.lab_no DESC,
        l.id DESC
    `
  )
    .bind(numericClassId)
    .all<Laboratory>();

  const laboratories = result.results ?? [];

  /* Separate laboratories by status */

  const openLaboratories = laboratories.filter(
    (laboratory) => laboratory.status === "open"
  );

  const completedLaboratories = laboratories.filter(
    (laboratory) => laboratory.status === "completed"
  );

  /* Summary card counts */

  const openCount = openLaboratories.length;
  const completedCount = completedLaboratories.length;
  
function LaboratoryCard({
  laboratory,
  classId,
}: {
  laboratory: Laboratory;
  classId: string;
}) {
  const isGroup =
    laboratory.lab_type === "group";

  const progressCurrent = isGroup
    ? laboratory.scored_group_count
    : laboratory.graded_count;

  const progressTotal = isGroup
    ? laboratory.group_count
    : laboratory.student_count;

  const progressPercentage =
    progressTotal > 0
      ? Math.min(
          100,
          (progressCurrent / progressTotal) * 100
        )
      : 0;

  const progressLabel = isGroup
    ? `${progressCurrent} / ${progressTotal} groups scored`
    : `${progressCurrent} / ${progressTotal} students graded`;

  const isCompleted =
    laboratory.status === "completed";

  return (
    <article
      className={`rounded-xl border bg-white p-5 transition-colors ${
        isCompleted
          ? "border-gray-200"
          : "border-gray-200 shadow-sm hover:border-gray-300 hover:bg-gray-50/40"
      }`}
    >
      {/* Top */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-medium text-gray-500">
            Laboratory {laboratory.lab_no}
          </div>

          <h3
            className={`mt-1 text-lg font-semibold ${
              isCompleted ? "text-gray-800" : "text-gray-900"
            }`}
          >
            {laboratory.title}
          </h3>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium capitalize text-gray-600">
            {laboratory.lab_type}
          </span>

          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              laboratory.status === "completed"
                ? "bg-green-100 text-green-700"
                : "bg-sky-100 text-sky-700"
            }`}
          >
            {laboratory.status === "completed"
              ? "Completed"
              : "Open"}
          </span>
        </div>
      </div>

      {/* Details */}
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-500">
        <span className="font-medium text-gray-700">
          {laboratory.total_points} points
        </span>

        {isGroup && (
          <span>
            {laboratory.group_points} Group +{" "}
            {laboratory.individual_points} Individual
          </span>
        )}

        <span>
          {formatDateRange(
            laboratory.start_date,
            laboratory.due_date
          )}
        </span>
      </div>

      {/* Progress / Completion */}
      <div className="mt-4 border-t border-gray-100 pt-4">
        {!isCompleted ? (
          <>
            <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <span className="font-medium text-gray-700">
                Grading Progress
              </span>

              <span className="text-gray-500">
                {progressLabel}
              </span>
            </div>

            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-gray-700 transition-all"
                style={{
                  width: `${progressPercentage}%`,
                }}
              />
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm font-medium text-green-700">
              ✓ {progressLabel}
            </div>

            {laboratory.class_average !== null && (
              <div className="text-sm text-gray-500">
                Class Average{" "}
                <span className="font-semibold text-gray-800">
                  {Number(
                    laboratory.class_average
                  ).toFixed(1)}
                  %
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-gray-500">
          {isGroup ? (
            <>
              {laboratory.group_count}{" "}
              {laboratory.group_count === 1
                ? "group"
                : "groups"}{" "}
              · {laboratory.student_count} students
            </>
          ) : (
            <>
              {laboratory.student_count} students
            </>
          )}
        </div>

        <Link
          href={`/classes/${classId}/laboratories/${laboratory.id}`}
          className="inline-flex h-9 w-full items-center justify-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 transition-colors hover:border-gray-400 hover:bg-gray-50 sm:w-auto"
        >
          View Laboratory
        </Link>
      </div>
    </article>
  );
}
  
  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Laboratories
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Create laboratory activities, organize groups, and manage laboratory scores.
          </p>
        </div>

        <Link
          href={`/classes/${classId}/laboratories/new`}
          className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 shadow-sm px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 sm:w-auto"
        >
          + Create Laboratory
        </Link>
      </div>

      {/* Summary */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="text-sm text-gray-500">
            Total Laboratories
          </div>

          <div className="mt-2 text-2xl font-semibold text-gray-900">
            {laboratories.length}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="text-sm text-gray-500">
            Open
          </div>

          <div className="mt-2 text-2xl font-semibold text-gray-900">
            {openCount}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="text-sm text-gray-500">
            Completed
          </div>

          <div className="mt-2 text-2xl font-semibold text-gray-900">
            {completedCount}
          </div>
        </div>
      </div>

      {/* Laboratory list */}
      <div className="mt-8 space-y-8">
      {laboratories.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center sm:p-12">
          <h3 className="font-semibold text-gray-900">
            No laboratories yet
          </h3>

          <p className="mt-2 text-sm text-gray-500">
            Create your first laboratory to begin recording
            scores.
          </p>

          <Link
            href={`/classes/${classId}/laboratories/new`}
            className="mt-5 inline-flex items-center justify-center rounded-lg bg-blue-600 shadow-sm px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            + Create Laboratory
          </Link>
        </div>
      )}

      {/* Open */}
      {openLaboratories.length > 0 && (
        <section>
          <div className="mb-4">
            <h2 className="text-base font-semibold text-gray-900">
              Open Laboratories
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Laboratories that are currently in progress.
            </p>
          </div>

          <div className="space-y-4">
            {openLaboratories.map(
              (laboratory) => (
                <LaboratoryCard
                  key={laboratory.id}
                  laboratory={laboratory}
                  classId={classId}
                />
              )
            )}
          </div>
        </section>
      )}

      {/* Completed */}
      {completedLaboratories.length > 0 && (
        <CollapsibleCompletedLabs
          count={completedLaboratories.length}
        >
          <div className="space-y-4">
            {completedLaboratories.map(
              (laboratory) => (
                <LaboratoryCard
                  key={laboratory.id}
                  laboratory={laboratory}
                  classId={classId}
                />
              )
            )}
          </div>
        </CollapsibleCompletedLabs>
      )}
    </div>
    </div>
  );
}
