import { notFound } from "next/navigation";

import { requireStudent } from "@/lib/auth/student-session";
import { getStudentPortalLaboratories } from "@/lib/db/student-portal";
import {
  getStudentLaboratoryPercentage,
  getStudentLaboratoryScore,
  type StudentLaboratoryRecord,
} from "@/lib/db/student-profile";
import { getStudentPortalContext } from "@/lib/student-portal-class";

function formatScore(value: number): string {
  return new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 }).format(value);
}

function formatPercentage(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 }).format(value)}%`;
}

function parseStoredDate(value: string): Date {
  if (/^d{4}-d{2}-d{2}$/.test(value)) return new Date(`${value}T00:00:00+08:00`);
  if (/^d{4}-d{2}-d{2} d{2}:d{2}:d{2}$/.test(value)) {
    return new Date(`${value.replace(" ", "T")}Z`);
  }
  return new Date(value);
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const date = parseStoredDate(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-PH", {
    month: "long", day: "numeric", year: "numeric", timeZone: "Asia/Manila",
  }).format(date);
}

function formatTerm(term: string): string {
  switch (term) {
    case "1ST_SEMESTER": return "1st Semester";
    case "2ND_SEMESTER": return "2nd Semester";
    case "SUMMER": return "Summer";
    default: return term;
  }
}

function SummaryCard({ label, value, detail }: {
  label: string; value: string; detail: string;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(30,64,175,0.04)]">
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950 tabular-nums">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </article>
  );
}

function TypeBadge({ type }: { type: StudentLaboratoryRecord["lab_type"] }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
      type === "group"
        ? "bg-violet-50 text-violet-700 ring-violet-100"
        : "bg-blue-50 text-blue-700 ring-blue-100"
    }`}>
      {type === "group" ? "Group" : "Individual"}
    </span>
  );
}

function StatusBadge({ status }: { status: StudentLaboratoryRecord["status"] }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
      status === "completed"
        ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
        : "bg-amber-50 text-amber-700 ring-amber-100"
    }`}>
      {status === "completed" ? "Completed" : "Open"}
    </span>
  );
}

function ScoreItem({ label, score, possible, emphasized = false }: {
  label: string; score: number; possible: number; emphasized?: boolean;
}) {
  return (
    <div className={`min-w-0 rounded-lg border px-4 py-3 ${
      emphasized
        ? "border-slate-300 bg-slate-900 text-white"
        : "border-slate-200 bg-slate-50/70"
    }`}>
      <dt className={`text-xs font-semibold uppercase tracking-wide ${
        emphasized ? "text-slate-300" : "text-slate-500"
      }`}>{label}</dt>
      <dd className={`mt-1 text-lg font-bold tabular-nums ${
        emphasized ? "text-white" : "text-slate-900"
      }`}>
        {formatScore(score)} / {formatScore(possible)}
      </dd>
    </div>
  );
}

function LaboratoryResult({ laboratory }: { laboratory: StudentLaboratoryRecord }) {
  const score = getStudentLaboratoryScore(laboratory);
  const percentage = getStudentLaboratoryPercentage(laboratory);
  const startDate = formatDate(laboratory.start_date);
  const dueDate = formatDate(laboratory.due_date);

  if (score === null) return null;

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Laboratory {laboratory.lab_no}
            </p>
            <h3 className="mt-1 break-words text-lg font-bold tracking-tight text-slate-950">
              {laboratory.title}
            </h3>
            {(startDate || dueDate) && (
              <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs leading-5 text-slate-500">
                {startDate && <span>Started: {startDate}</span>}
                {dueDate && <span>Due: {dueDate}</span>}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <TypeBadge type={laboratory.lab_type} />
            <StatusBadge status={laboratory.status} />
          </div>
        </div>

        <div className="mt-5 border-t border-slate-100 pt-5">
          {laboratory.lab_type === "individual" ? (
            <dl className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
              <ScoreItem label="Individual Score" score={score}
                possible={Number(laboratory.individual_points)} emphasized />
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Percentage</dt>
                <dd className="mt-1 text-lg font-bold text-slate-900 tabular-nums">
                  {formatPercentage(percentage)}
                </dd>
              </div>
            </dl>
          ) : (
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_10rem]">
              <ScoreItem label="Group Score" score={Number(laboratory.group_score)}
                possible={Number(laboratory.group_points)} />
              <ScoreItem label="Individual Contribution" score={Number(laboratory.individual_score)}
                possible={Number(laboratory.individual_points)} />
              <ScoreItem label="Final Score" score={score}
                possible={Number(laboratory.total_points)} emphasized />
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Percentage</dt>
                <dd className="mt-1 text-lg font-bold text-slate-900 tabular-nums">
                  {formatPercentage(percentage)}
                </dd>
              </div>
            </dl>
          )}
        </div>
      </div>
    </article>
  );
}

export default async function StudentLaboratoriesPage() {
  const authenticatedStudent = await requireStudent();
  const { selectedClass } = await getStudentPortalContext(
    authenticatedStudent.id
  );

  if (!selectedClass) {
    notFound();
  }

  const laboratories = await getStudentPortalLaboratories(
    authenticatedStudent.id,
    selectedClass
  );
  if (!laboratories) notFound();

  const { classItem, records, summary } = laboratories;

  return (
    <div className="w-full">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Laboratories</h1>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Review your laboratory scores and performance for this class.
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

      <section aria-label="Laboratory summary"
        className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Laboratory Average" value={formatPercentage(summary.percentage)}
          detail={summary.scored === 0 ? "No scored laboratories yet" : "Based on total points"} />
        <SummaryCard label="Laboratories Scored" value={String(summary.scored)}
          detail="Complete saved results" />
        <SummaryCard label="Points Earned" value={formatScore(summary.earned)}
          detail="Across scored laboratories" />
        <SummaryCard label="Points Possible" value={formatScore(summary.possible)}
          detail="Across scored laboratories" />
      </section>

      <section aria-labelledby="laboratory-results-heading" className="mt-7">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div>
            <h2 id="laboratory-results-heading"
              className="text-lg font-bold tracking-tight text-slate-950">Laboratory Results</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Group results include your shared group score and your own contribution.
            </p>
          </div>
          {records.length > 0 && (
            <p className="shrink-0 text-sm font-medium text-slate-500">
              {records.length} scored {records.length === 1 ? "laboratory" : "laboratories"}
            </p>
          )}
        </div>

        {records.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-5 py-12 text-center sm:px-6">
            <div aria-hidden="true"
              className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-500">L</div>
            <h3 className="mt-4 text-sm font-semibold text-slate-900">No laboratory scores yet</h3>
            <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">
              Your laboratory results will appear here after your instructor completes the scoring.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {records.map((laboratory) => (
              <LaboratoryResult key={laboratory.laboratory_id} laboratory={laboratory} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
