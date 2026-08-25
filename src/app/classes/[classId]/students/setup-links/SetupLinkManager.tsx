"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import ConfirmationModal from "@/components/ConfirmationModal";
import type { StudentSetupLinkRosterItem } from "@/lib/db/student-setup-links";

import {
  generateStudentSetupLink,
  revokeStudentSetupLink,
} from "./actions";

function getStudentName(student: StudentSetupLinkRosterItem): string {
  const middleInitial = student.middleName
    ? `${student.middleName.charAt(0)}.`
    : "";

  return [
    student.lastName + ",",
    student.firstName,
    middleInitial,
    student.suffix,
  ]
    .filter(Boolean)
    .join(" ");
}

function formatExpiration(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Expiration unavailable";
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
    timeZoneName: "short",
  }).format(date);
}

function PortalStatus({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
        active
          ? "bg-blue-50 text-blue-700 ring-blue-100"
          : "bg-amber-50 text-amber-800 ring-amber-200"
      }`}
    >
      {active ? "Portal Active" : "Needs Setup"}
    </span>
  );
}

function SetupLinkStatus({ student }: { student: StudentSetupLinkRosterItem }) {
  if (student.hasPortalAccount) {
    return <span className="text-sm text-slate-500">Not applicable</span>;
  }

  if (student.delivery?.status === "PENDING") {
    return <span className="text-sm font-medium text-blue-700">Sending by Gmail…</span>;
  }

  if (student.delivery?.status === "SENT") {
    return (
      <div>
        <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">Sent by Gmail</span>
        {student.delivery.sentAt && <p className="mt-1.5 text-xs text-slate-500">{formatExpiration(student.delivery.sentAt)}</p>}
      </div>
    );
  }

  if (student.delivery?.status === "FAILED") {
    return <span className="inline-flex rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200">Last email failed</span>;
  }

  const status = student.setupLink?.status;

  if (!student.setupLink || !status) {
    return <span className="text-sm text-slate-500">Not generated</span>;
  }

  const styles = {
    ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    EXPIRED: "bg-orange-50 text-orange-700 ring-orange-200",
    REVOKED: "bg-slate-100 text-slate-600 ring-slate-200",
    USED: "bg-blue-50 text-blue-700 ring-blue-100",
  }[status];

  const labels = {
    ACTIVE: "Active",
    EXPIRED: "Expired",
    REVOKED: "Revoked",
    USED: "Used",
  }[status];

  return (
    <div>
      <span
        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${styles}`}
      >
        {labels}
      </span>
      {(status === "ACTIVE" || status === "EXPIRED") && (
        <p className="mt-1.5 text-xs leading-5 text-slate-500">
          {status === "ACTIVE" ? "Expires" : "Expired"}{" "}
          {formatExpiration(student.setupLink.expiresAt)}
        </p>
      )}
    </div>
  );
}

function OneTimeSetupLinkModal({
  studentName,
  setupUrl,
  expiresAt,
  onClose,
}: {
  studentName: string;
  setupUrl: string;
  expiresAt: string;
  onClose: () => void;
}) {
  const doneButtonRef = useRef<HTMLButtonElement>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  useEffect(() => {
    doneButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function copyLink() {
    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard unavailable");
      }

      await navigator.clipboard.writeText(setupUrl);
      setCopyFeedback("Copied");
    } catch {
      setCopyFeedback("Select and copy the link manually.");
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close setup link"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="setup-link-title"
        aria-describedby="setup-link-description"
        className="relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="border-b border-slate-200 px-5 py-4 sm:px-6 sm:py-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
            Shown once
          </p>
          <h2 id="setup-link-title" className="mt-1 text-lg font-semibold text-slate-950">
            Student setup link
          </h2>
          <p className="mt-1 break-words text-sm font-medium text-slate-600">
            {studentName}
          </p>
        </div>

        <div className="px-5 py-5 sm:px-6">
          <label htmlFor="generated-setup-link" className="text-sm font-semibold text-slate-800">
            Secure setup URL
          </label>
          <textarea
            id="generated-setup-link"
            readOnly
            value={setupUrl}
            rows={4}
            onFocus={(event) => event.currentTarget.select()}
            className="mt-2 w-full resize-none break-all rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 font-mono text-xs leading-5 text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          <p className="mt-2 text-xs text-slate-500">
            Expires {formatExpiration(expiresAt)}
          </p>
          <p id="setup-link-description" className="mt-4 text-sm leading-6 text-slate-600">
            This setup link is shown only now. Class-pilot stores only a secure
            hash of the token and cannot recover the link later.
          </p>
          <p role="status" aria-live="polite" className="mt-2 min-h-5 text-sm font-medium text-blue-700">
            {copyFeedback}
          </p>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            ref={doneButtonRef}
            type="button"
            onClick={onClose}
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 sm:w-auto"
          >
            Done
          </button>
          <button
            type="button"
            onClick={copyLink}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 sm:w-auto"
          >
            {copyFeedback === "Copied" ? "Copied" : "Copy Link"}
          </button>
        </div>
      </div>
    </div>
  );
}

type ConfirmationState = {
  kind: "replace" | "revoke";
  student: StudentSetupLinkRosterItem;
} | null;

export default function SetupLinkManager({
  classId,
  students,
}: {
  classId: number;
  students: StudentSetupLinkRosterItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingStudentId, setPendingStudentId] = useState<number | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationState>(null);
  const [error, setError] = useState<string | null>(null);
  const [revealedLink, setRevealedLink] = useState<{
    studentName: string;
    setupUrl: string;
    expiresAt: string;
  } | null>(null);

  const closeRevealedLink = useCallback(() => {
    setRevealedLink(null);
  }, []);

  function generateLink(student: StudentSetupLinkRosterItem) {
    setError(null);
    setPendingStudentId(student.studentId);

    startTransition(async () => {
      const result = await generateStudentSetupLink(classId, student.studentId);
      setPendingStudentId(null);

      if (!result.success) {
        setError(result.error);
        return;
      }

      setConfirmation(null);
      setRevealedLink({
        studentName: getStudentName(student),
        setupUrl: new URL(result.setupPath, window.location.origin).toString(),
        expiresAt: result.expiresAt,
      });
      router.refresh();
    });
  }

  function revokeLink(student: StudentSetupLinkRosterItem) {
    setError(null);
    setPendingStudentId(student.studentId);

    startTransition(async () => {
      const result = await revokeStudentSetupLink(classId, student.studentId);
      setPendingStudentId(null);

      if (!result.success) {
        setError(result.error);
        return;
      }

      setConfirmation(null);
      router.refresh();
    });
  }

  function ActionButtons({ student }: { student: StudentSetupLinkRosterItem }) {
    if (student.hasPortalAccount) {
      return <span className="text-xs text-slate-500">No setup needed</span>;
    }

    const isPending = pending && pendingStudentId === student.studentId;
    const hasActiveLink = student.setupLink?.status === "ACTIVE";

    if (hasActiveLink) {
      return (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirmation({ kind: "replace", student })}
            className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`Replace setup link for ${getStudentName(student)}`}
          >
            {isPending ? "Replacing..." : "Replace Link"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirmation({ kind: "revoke", student })}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`Revoke setup link for ${getStudentName(student)}`}
          >
            Revoke
          </button>
        </div>
      );
    }

    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => generateLink(student)}
        className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={`Generate setup link for ${getStudentName(student)}`}
      >
        {isPending
          ? "Generating..."
          : student.setupLink
            ? "Generate New Link"
            : "Generate Link"}
      </button>
    );
  }

  if (students.length === 0) {
    return (
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm sm:p-12">
        <h3 className="font-semibold text-slate-900">No active students</h3>
        <p className="mt-2 text-sm text-slate-500">
          Add or restore students from the class roster before creating setup links.
        </p>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="divide-y divide-slate-100 md:hidden">
          {students.map((student) => (
            <article key={student.studentId} className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="break-words text-sm font-semibold text-slate-950">
                    {getStudentName(student)}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">{student.studentNumber}</p>
                </div>
                <PortalStatus active={student.hasPortalAccount} />
              </div>
              <dl className="mt-4 grid gap-3 text-sm">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Email</dt>
                  <dd className={`mt-1 break-all ${student.email ? "text-slate-700" : "font-medium text-amber-700"}`}>
                    {student.email || "Missing Email"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Setup Link</dt>
                  <dd className="mt-1"><SetupLinkStatus student={student} /></dd>
                </div>
              </dl>
              <div className="mt-4"><ActionButtons student={student} /></div>
            </article>
          ))}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {["Student", "Student No.", "Email", "Portal Status", "Setup Link", "Action"].map((heading) => (
                  <th key={heading} scope="col" className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.map((student) => (
                <tr key={student.studentId} className="align-top">
                  <td className="px-5 py-4 text-sm font-semibold text-slate-900">{getStudentName(student)}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">{student.studentNumber}</td>
                  <td className="max-w-56 px-5 py-4 text-sm">
                    <span className={`break-all ${student.email ? "text-slate-600" : "font-medium text-amber-700"}`}>
                      {student.email || "Missing Email"}
                    </span>
                  </td>
                  <td className="px-5 py-4"><PortalStatus active={student.hasPortalAccount} /></td>
                  <td className="min-w-48 px-5 py-4"><SetupLinkStatus student={student} /></td>
                  <td className="min-w-48 px-5 py-4"><ActionButtons student={student} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmationModal
        open={confirmation !== null}
        title={confirmation?.kind === "replace" ? "Replace setup link?" : "Revoke setup link?"}
        description={
          confirmation ? (
            confirmation.kind === "replace" ? (
              <>The current unused setup link for <strong>{getStudentName(confirmation.student)}</strong> will stop working and a new link will be generated.</>
            ) : (
              <>The current setup link for <strong>{getStudentName(confirmation.student)}</strong> will stop working immediately. Their portal credentials will not be changed.</>
            )
          ) : undefined
        }
        confirmLabel={confirmation?.kind === "replace" ? "Replace Link" : "Revoke Link"}
        pendingLabel={confirmation?.kind === "replace" ? "Replacing..." : "Revoking..."}
        pending={pending}
        variant={confirmation?.kind === "revoke" ? "danger" : "default"}
        onCancel={() => {
          if (!pending) setConfirmation(null);
        }}
        onConfirm={() => {
          if (!confirmation) return;
          if (confirmation.kind === "replace") generateLink(confirmation.student);
          else revokeLink(confirmation.student);
        }}
      />

      {revealedLink && (
        <OneTimeSetupLinkModal
          studentName={revealedLink.studentName}
          setupUrl={revealedLink.setupUrl}
          expiresAt={revealedLink.expiresAt}
          onClose={closeRevealedLink}
        />
      )}
    </>
  );
}
