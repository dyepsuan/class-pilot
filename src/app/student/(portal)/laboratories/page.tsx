import { notFound } from "next/navigation";

import { requireStudent } from "@/lib/auth/student-session";
import { formatPhilippineDateOnly } from "@/lib/datetime";
import {
  getStudentPortalLaboratories,
  type StudentPortalLaboratoryRecord,
} from "@/lib/db/student-portal";
import {
  getStudentLaboratoryPercentage,
  getStudentLaboratoryScore,
} from "@/lib/db/student-profile";
import {
  LABORATORY_SUBMISSION_FILE_ACCEPT,
  MAX_LABORATORY_SUBMISSION_SIZE,
} from "@/lib/laboratory-submissions/validation";
import { getStudentPortalContext } from "@/lib/student-portal-class";

import StudentGroupSubmission from "./StudentGroupSubmission";

function formatScore(value: number): string {
  return new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 }).format(value);
}

function formatPercentage(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 }).format(value)}%`;
}

function formatDate(value: string | null): string | null {
  return value ? formatPhilippineDateOnly(value, value) : null;
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

function TypeBadge({ type }: { type: StudentPortalLaboratoryRecord["lab_type"] }) {
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

function StatusBadge({ status }: { status: StudentPortalLaboratoryRecord["status"] }) {
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

function StudentScoreBadge({ score, possible }: {
  score: number | null;
  possible: number;
}) {
  return (
    <div className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-200 sm:shrink-0">
      <span className="text-slate-500">Your Score:</span>
      <span className="min-w-0 tabular-nums text-slate-950">
        {score === null
          ? "Not scored"
          : `${formatScore(score)} / ${formatScore(possible)}`}
      </span>
    </div>
  );
}

function LaboratoryResult({
  laboratory,
  authenticatedStudentId,
}: {
  laboratory: StudentPortalLaboratoryRecord;
  authenticatedStudentId: number;
}) {
  const score = getStudentLaboratoryScore(laboratory);
  const percentage = getStudentLaboratoryPercentage(laboratory);
  const startDate = formatDate(laboratory.start_date);
  const dueDate = formatDate(laboratory.due_date);

  return (
    <article
      id={`laboratory-${laboratory.laboratory_id}`}
      className="scroll-mt-24 overflow-hidden rounded-xl border border-slate-200 bg-white target:ring-2 target:ring-blue-300 target:ring-offset-2"
    >
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

        {laboratory.lab_type === "group" && laboratory.group_name && (
          <section className="mt-5 border-t border-slate-100 pt-5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Your Group
            </p>
            <div className="mt-1 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h4 className="min-w-0 break-words text-base font-bold text-slate-950">
                {laboratory.group_name}
              </h4>
              <StudentScoreBadge
                score={score}
                possible={Number(laboratory.total_points)}
              />
            </div>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {laboratory.group_members.map((member) => (
                <li
                  key={member.student_id}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                >
                  {member.name}
                  {member.student_id === authenticatedStudentId && (
                    <span className="ml-1 font-semibold text-blue-700">— You</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {score !== null && laboratory.lab_type === "individual" && (
        <div className="mt-5 border-t border-slate-100 pt-5">
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
        </div>
        )}

        {laboratory.lab_type === "group" && laboratory.group_name && (
          <StudentGroupSubmission
            laboratoryId={laboratory.laboratory_id}
            laboratoryStatus={laboratory.status}
            submission={laboratory.group_submission}
            accept={LABORATORY_SUBMISSION_FILE_ACCEPT}
            maximumFileSize={MAX_LABORATORY_SUBMISSION_SIZE}
          />
        )}
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
            Review your official group assignments and laboratory scores for this class.
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
              Locked group assignments appear here alongside saved score details.
            </p>
          </div>
          {records.length > 0 && (
            <p className="shrink-0 text-sm font-medium text-slate-500">
              {records.length} {records.length === 1 ? "laboratory" : "laboratories"}
            </p>
          )}
        </div>

        {records.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-5 py-12 text-center sm:px-6">
            <div aria-hidden="true"
              className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-500">L</div>
            <h3 className="mt-4 text-sm font-semibold text-slate-900">No laboratory activity yet</h3>
            <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">
              Official group assignments and saved results will appear here when available.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {records.map((laboratory) => (
              <LaboratoryResult
                key={laboratory.laboratory_id}
                laboratory={laboratory}
                authenticatedStudentId={authenticatedStudent.id}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
