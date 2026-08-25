import { notFound } from "next/navigation";

import { requireStudent } from "@/lib/auth/student-session";
import { getStudentPortalQuizzes } from "@/lib/db/student-portal";
import {
  getStudentQuizPercentage,
  type StudentQuizRecord,
} from "@/lib/db/student-profile";
import { getStudentPortalContext } from "@/lib/student-portal-class";

const statusBadgeClasses: Record<StudentQuizRecord["status"], string> = {
  SCORED: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  ABSENT: "bg-red-50 text-red-700 ring-red-100",
  EXCUSED: "bg-blue-50 text-blue-700 ring-blue-100",
};

function formatScore(value: number): string {
  return new Intl.NumberFormat("en-PH", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercentage(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  return `${new Intl.NumberFormat("en-PH", {
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

function parseStoredDate(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00+08:00`);
  }

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    return new Date(`${value.replace(" ", "T")}Z`);
  }

  return new Date(value);
}

function formatDate(value: string | null): string | null {
  if (!value) {
    return null;
  }

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

function getQuizLabel(quiz: StudentQuizRecord): string {
  return quiz.sequence_no == null ? "Quiz" : `Quiz ${quiz.sequence_no}`;
}

function formatStatus(status: StudentQuizRecord["status"]): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function StatusBadge({ status }: { status: StudentQuizRecord["status"] }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusBadgeClasses[status]}`}
    >
      {formatStatus(status)}
    </span>
  );
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

export default async function StudentQuizzesPage() {
  const authenticatedStudent = await requireStudent();
  const { selectedClass } = await getStudentPortalContext(
    authenticatedStudent.id
  );

  if (!selectedClass) {
    notFound();
  }

  const quizzes = await getStudentPortalQuizzes(
    authenticatedStudent.id,
    selectedClass
  );

  if (!quizzes) {
    notFound();
  }

  const { classItem, records, summary } = quizzes;

  return (
    <div className="w-full">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            Quizzes
          </h1>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Review your saved quiz scores for this class.
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

      <section aria-label="Quiz summary" className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Quiz Average"
          value={formatPercentage(summary.percentage)}
          detail={summary.scored === 0 ? "No scored quizzes yet" : "Based on total points"}
        />
        <SummaryCard
          label="Quizzes Scored"
          value={String(summary.scored)}
          detail="Saved numeric scores"
        />
        <SummaryCard
          label="Points Earned"
          value={formatScore(summary.earned)}
          detail="Across scored quizzes"
        />
        <SummaryCard
          label="Points Possible"
          value={formatScore(summary.possible)}
          detail="Across scored quizzes"
        />
      </section>

      <section
        aria-labelledby="quiz-results-heading"
        className="mt-7 overflow-hidden rounded-xl border border-slate-200 bg-white"
      >
        <div className="border-b border-slate-100 px-5 py-5 sm:flex sm:items-start sm:justify-between sm:gap-4 sm:px-6">
          <div>
            <h2 id="quiz-results-heading" className="text-lg font-bold tracking-tight text-slate-950">
              Quiz Results
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Scores appear after your instructor saves them.
            </p>
          </div>
          {records.length > 0 && (
            <p className="mt-2 shrink-0 text-sm font-medium text-slate-500 sm:mt-0">
              {records.length} saved {records.length === 1 ? "result" : "results"}
            </p>
          )}
        </div>

        {records.length === 0 ? (
          <div className="px-5 py-12 text-center sm:px-6">
            <div
              aria-hidden="true"
              className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-500"
            >
              Q
            </div>
            <h3 className="mt-4 text-sm font-semibold text-slate-900">
              No quiz scores yet
            </h3>
            <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">
              Your quiz results will appear here after your instructor saves your scores.
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-100 md:hidden">
              {records.map((quiz) => {
                const percentage = getStudentQuizPercentage(quiz);
                const date = formatDate(quiz.date_given);

                return (
                  <article key={quiz.quiz_id} className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{getQuizLabel(quiz)}</p>
                        <p className="mt-1 break-words text-sm leading-5 text-slate-600">{quiz.title}</p>
                        {date && <p className="mt-1 text-xs text-slate-500">{date}</p>}
                      </div>
                      <StatusBadge status={quiz.status} />
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                      <div>
                        <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Score</dt>
                        <dd className="mt-1 text-lg font-bold text-slate-900 tabular-nums">
                          {quiz.status === "SCORED" && quiz.score !== null
                            ? `${formatScore(Number(quiz.score))} / ${formatScore(Number(quiz.max_score))}`
                            : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Percentage</dt>
                        <dd className="mt-1 text-lg font-bold text-slate-900 tabular-nums">
                          {formatPercentage(percentage)}
                        </dd>
                      </div>
                    </dl>
                  </article>
                );
              })}
            </div>

            <div className="hidden md:block">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50/80">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Quiz</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Score</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Percentage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {records.map((quiz) => {
                    const percentage = getStudentQuizPercentage(quiz);
                    const date = formatDate(quiz.date_given);

                    return (
                      <tr key={quiz.quiz_id} className="transition-colors hover:bg-slate-50/70">
                        <td className="px-6 py-4">
                          <p className="text-sm font-semibold text-slate-900">{getQuizLabel(quiz)}</p>
                          <p className="mt-1 max-w-lg break-words text-sm text-slate-600">{quiz.title}</p>
                          {date && <p className="mt-1 text-xs text-slate-500">{date}</p>}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          {quiz.status === "SCORED" && quiz.score !== null ? (
                            <div>
                              <p className="text-sm font-bold text-slate-900 tabular-nums">
                                {formatScore(Number(quiz.score))} / {formatScore(Number(quiz.max_score))}
                              </p>
                              <div className="mt-2"><StatusBadge status={quiz.status} /></div>
                            </div>
                          ) : (
                            <StatusBadge status={quiz.status} />
                          )}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-slate-700 tabular-nums">
                          {formatPercentage(percentage)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
