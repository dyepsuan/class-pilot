import { formatPhilippineLongDateTime } from "@/lib/datetime";
import type { LaboratorySubmissionTiming } from "@/lib/laboratory-submissions/deadline";

export type InstructorGroupSubmissionView = {
  groupId: number;
  originalFilename: string;
  fileSize: number;
  uploadedByName: string;
  submittedAt: string;
  updatedAt: string;
  timing: LaboratorySubmissionTiming | null;
};

function formatFileSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(
    Math.floor(Math.log(size) / Math.log(1024)),
    units.length - 1
  );
  const value = size / 1024 ** exponent;
  return `${new Intl.NumberFormat("en-PH", {
    maximumFractionDigits: value >= 10 || exponent === 0 ? 0 : 1,
  }).format(value)} ${units[exponent]}`;
}

function formatSubmissionDate(value: string): string {
  return formatPhilippineLongDateTime(value, value);
}

export function getInstructorSubmissionStatusLabel(
  submission: InstructorGroupSubmissionView | null
): string {
  if (!submission) return "Not submitted";
  return submission.timing === "LATE" ? "Late" : "Submitted";
}

function SubmissionBadge({ submission }: {
  submission: InstructorGroupSubmissionView;
}) {
  if (submission.timing === "LATE") {
    return (
      <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-100">
        Late
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-100">
      Submitted
    </span>
  );
}

export default function InstructorGroupSubmission({
  classId,
  laboratoryId,
  groupId,
  submission,
}: {
  classId: string;
  laboratoryId: string;
  groupId: number;
  submission: InstructorGroupSubmissionView | null;
}) {
  return (
    <section className="border-t border-slate-200 bg-slate-50/60 px-5 py-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          Group Submission
        </h4>
        {submission && <SubmissionBadge submission={submission} />}
      </div>

      {!submission ? (
        <p className="mt-3 text-sm font-medium text-slate-500">
          Not submitted yet
        </p>
      ) : (
        <div className="mt-3 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 gap-3">
              <div
                aria-hidden="true"
                className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-slate-600 ring-1 ring-slate-200"
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                  <path
                    d="M7 3.75h6.25L17 7.5v12.75H7V3.75Z"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M13 3.75V7.5h4"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-semibold leading-5 text-slate-900">
                  {submission.originalFilename}
                </p>
                <p className="mt-1 text-xs font-medium tabular-nums text-slate-500">
                  {formatFileSize(submission.fileSize)}
                </p>
                <dl className="mt-3 space-y-1 text-xs leading-5 text-slate-600">
                  <div>
                    <dt className="inline font-semibold text-slate-500">
                      {submission.submittedAt === submission.updatedAt
                        ? "Uploaded by:"
                        : "Last replaced by:"}
                    </dt>{" "}
                    <dd className="inline break-words">
                      {submission.uploadedByName}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold text-slate-500">
                      {submission.submittedAt === submission.updatedAt
                        ? "Submitted:"
                        : "Last replaced:"}
                    </dt>{" "}
                    <dd className="inline">
                      <time dateTime={submission.updatedAt}>
                        {formatSubmissionDate(submission.updatedAt)}
                      </time>
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>

          <a
            href={`/api/classes/${classId}/laboratories/${laboratoryId}/groups/${groupId}/submission`}
            className="inline-flex w-full items-center justify-center rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:w-auto"
          >
            View / Download
          </a>
        </div>
      )}
    </section>
  );
}
