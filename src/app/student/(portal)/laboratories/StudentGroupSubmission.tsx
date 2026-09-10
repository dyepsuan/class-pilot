"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";

import ConfirmationModal from "@/components/ConfirmationModal";
import type { StudentPortalGroupSubmission } from "@/lib/db/student-portal";

type UploadResponse = {
  message?: string;
};

type SelectedFile = {
  file: File;
  error: string | null;
};

function getExtension(filename: string): string | null {
  const lastDot = filename.lastIndexOf(".");
  return lastDot > 0 && lastDot < filename.length - 1
    ? filename.slice(lastDot + 1).toLowerCase()
    : null;
}

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
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  }).format(date);
}

function SubmissionStatusBadge({ submission }: {
  submission: StudentPortalGroupSubmission;
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

export default function StudentGroupSubmission({
  laboratoryId,
  laboratoryStatus,
  submission,
  accept,
  maximumFileSize,
}: {
  laboratoryId: number;
  laboratoryStatus: "open" | "completed";
  submission: StudentPortalGroupSubmission | null;
  accept: string;
  maximumFileSize: number;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadingRef = useRef(false);
  const [selected, setSelected] = useState<SelectedFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const allowedExtensions = new Set(
    accept.split(",").map((value) => value.trim().replace(/^\./u, ""))
  );
  const canUpload = laboratoryStatus === "open";

  function chooseFile() {
    setError(null);
    setSuccess(null);
    inputRef.current?.click();
  }

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] ?? null;

    if (!file) {
      setSelected(null);
      return;
    }

    let localError: string | null = null;
    const extension = getExtension(file.name);

    if (!extension || !allowedExtensions.has(extension)) {
      localError = "Only PDF, DOCX, PPTX, ZIP, PNG, and JPG files are supported.";
    } else if (file.size === 0) {
      localError = "Empty files cannot be submitted.";
    } else if (file.size > maximumFileSize) {
      localError = "Files must be 20 MB or smaller.";
    }

    setSelected({ file, error: localError });
  }

  async function uploadSelectedFile() {
    if (!selected || selected.error || uploadingRef.current || !canUpload) {
      return;
    }

    uploadingRef.current = true;
    setUploading(true);
    setError(null);
    setSuccess(null);

    const body = new FormData();
    body.append("laboratoryId", String(laboratoryId));
    body.append("file", selected.file);

    if (submission) {
      body.append("expectedSubmissionId", submission.id);
      body.append("expectedUpdatedAt", submission.updated_at);
    }

    try {
      const response = await fetch("/api/student/laboratory-submissions", {
        method: "POST",
        body,
      });
      const result = (await response.json()) as UploadResponse;

      if (!response.ok) {
        setError(result.message || "Could not upload the group submission.");
        return;
      }

      setSelected(null);
      setConfirmationOpen(false);
      setSuccess(
        submission
          ? "Group submission replaced."
          : "Group submission uploaded."
      );
      router.refresh();
    } catch {
      setError("Could not upload the group submission. Please try again.");
    } finally {
      uploadingRef.current = false;
      setUploading(false);

      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  return (
    <section
      aria-labelledby={`group-submission-${laboratoryId}`}
      aria-busy={uploading}
      className="mt-5 border-t border-slate-100 pt-5"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h4
          id={`group-submission-${laboratoryId}`}
          className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
        >
          Group Submission
        </h4>
        {submission && <SubmissionStatusBadge submission={submission} />}
      </div>

      {submission ? (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-4">
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
              <p className="wrap-break-word text-sm font-semibold leading-5 text-slate-900">
                {submission.original_filename}
              </p>
              <p className="mt-1 text-xs font-medium tabular-nums text-slate-500">
                {formatFileSize(submission.file_size)}
              </p>
              <dl className="mt-3 space-y-1 text-xs leading-5 text-slate-600">
                <div>
                  <dt className="inline font-semibold text-slate-500">
                    {submission.submitted_at === submission.updated_at
                      ? "Submitted by:"
                      : "Last replaced by:"}
                  </dt>{" "}
                  <dd className="inline wrap-break-word">
                    {submission.uploaded_by_name}
                  </dd>
                </div>
                <div>
                  <dt className="inline font-semibold text-slate-500">
                    {submission.submitted_at === submission.updated_at
                      ? "Submitted:"
                      : "Last replaced:"}
                  </dt>{" "}
                  <dd className="inline">
                    <time dateTime={submission.updated_at}>
                      {formatSubmissionDate(submission.updated_at)}
                    </time>
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50/70 px-4 py-4">
          <p className="text-sm font-medium text-slate-700">
            {canUpload
              ? "No file has been submitted by your group yet."
              : "No group submission was recorded for this laboratory."}
          </p>
          {canUpload && (
            <>
              <p className="mt-1 text-sm text-slate-500">
                Upload your group&apos;s laboratory output.
              </p>
              <p className="mt-3 text-xs leading-5 text-slate-500">
                PDF, DOCX, PPTX, ZIP, PNG or JPG - Maximum 20 MB
              </p>
            </>
          )}
        </div>
      )}

      {selected && canUpload && (
        <div
          role={selected.error ? "alert" : "status"}
          aria-live="polite"
          className={`mt-3 rounded-lg border px-4 py-3 text-sm ${
            selected.error
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-blue-200 bg-blue-50 text-blue-800"
          }`}
        >
          <p className="wrap-break-word font-semibold">{selected.file.name}</p>
          <p className="mt-1 text-xs tabular-nums">
            {formatFileSize(selected.file.size)}
          </p>
          {selected.error && <p className="mt-2 text-xs">{selected.error}</p>}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}
      {success && (
        <div
          role="status"
          aria-live="polite"
          className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          {success}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        disabled={!canUpload || uploading}
        onChange={selectFile}
        className="sr-only"
        aria-label="Choose a group laboratory submission file"
      />

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {submission && (
          <a
            href={`/api/student/laboratory-submissions/${laboratoryId}/download`}
            className="inline-flex items-center justify-center rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            View / Download
          </a>
        )}

        {canUpload && (
          <button
            type="button"
            disabled={uploading}
            onClick={chooseFile}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
          >
            {submission ? "Choose Replacement" : "Choose File"}
          </button>
        )}

        {canUpload && selected && !submission && (
          <button
            type="button"
            disabled={uploading || Boolean(selected.error)}
            onClick={() => void uploadSelectedFile()}
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
          >
            {uploading ? "Uploading..." : "Upload File"}
          </button>
        )}

        {canUpload && selected && submission && (
          <button
            type="button"
            disabled={uploading || Boolean(selected.error)}
            onClick={() => setConfirmationOpen(true)}
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
          >
            {uploading ? "Uploading..." : "Replace File"}
          </button>
        )}
      </div>

      <ConfirmationModal
        open={confirmationOpen}
        title="Replace group submission?"
        description="This will replace the current file for your entire group. All group members and the instructor will see the new file."
        confirmLabel="Replace Submission"
        pendingLabel="Uploading..."
        pending={uploading}
        onConfirm={() => void uploadSelectedFile()}
        onCancel={() => setConfirmationOpen(false)}
      />
    </section>
  );
}
