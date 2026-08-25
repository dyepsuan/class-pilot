"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import ConfirmationModal from "@/components/ConfirmationModal";
import type { StudentSetupLinkRosterItem } from "@/lib/db/student-setup-links";
import { isValidEmailAddress } from "@/lib/validation/email";

import {
  disconnectGmailConnection,
  sendStudentSetupLinks,
  type GmailRecipientResult,
} from "./gmail-actions";

function studentName(student: StudentSetupLinkRosterItem): string {
  return [
    `${student.lastName},`,
    student.firstName,
    student.middleName ? `${student.middleName.charAt(0)}.` : null,
    student.suffix,
  ]
    .filter(Boolean)
    .join(" ");
}

const OAUTH_STATUS_MESSAGES: Record<string, string> = {
  "oauth-state-error":
    "Class-pilot could not validate this OAuth session. Start Connect Gmail again.",
  "pkce-error":
    "The secure Gmail connection attempt expired or lost its verifier. Start again.",
  "token-exchange-error":
    "Google authorized the connection, but Class-pilot could not complete the OAuth token exchange.",
  "missing-refresh-token":
    "Google did not provide the offline credential required to send later. Reconnect and grant access again.",
  "identity-error":
    "Google authorization succeeded, but Class-pilot could not verify the connected Gmail address.",
  "encryption-error":
    "Google authorization succeeded, but Class-pilot could not secure the Gmail credential.",
  "database-error":
    "Google authorization succeeded, but Class-pilot could not save the Gmail connection.",
  "authorization-error":
    "The Gmail authorization was cancelled or could not be completed.",
  "scope-error":
    "Google did not grant the Gmail send permission required by Class-pilot.",
  "configuration-error":
    "The Gmail integration configuration is incomplete or invalid.",
  "refresh-token-error":
    "Google did not provide the offline credential required to send later.",
  connected: "Gmail connected successfully.",
};

function deliveryLabel(student: StudentSetupLinkRosterItem): string {
  if (student.hasPortalAccount) return "Portal active";
  if (student.delivery?.status === "SENT") return "Setup link sent";
  if (student.delivery?.status === "FAILED") return "Last send failed";
  if (student.delivery?.status === "PENDING") return "Sending";
  if (!student.email?.trim()) return "Email missing";
  if (!isValidEmailAddress(student.email)) return "Email invalid";
  return "Ready to send";
}

export default function GmailDistributionPanel({
  classId,
  className,
  instructorName,
  students,
  configured,
  connectedEmail,
  oauthStatus,
}: {
  classId: number;
  className: string;
  instructorName: string;
  students: StudentSetupLinkRosterItem[];
  configured: boolean;
  connectedEmail: string | null;
  oauthStatus: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const oauthMessage = oauthStatus
    ? OAUTH_STATUS_MESSAGES[oauthStatus]
    : undefined;
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    sent: number;
    failed: number;
    skipped: number;
    reconnectRequired: boolean;
    recipients: GmailRecipientResult[];
  } | null>(null);

  const eligible = useMemo(
    () =>
      students.filter(
        (student) =>
          !student.hasPortalAccount &&
          student.delivery?.status !== "PENDING" &&
          Boolean(student.email && isValidEmailAddress(student.email))
      ),
    [students]
  );
  const selectedStudents = eligible.filter((student) => selected.has(student.studentId));
  const allSelected = eligible.length > 0 && eligible.every((student) => selected.has(student.studentId));
  const first = selectedStudents[0];
  const replacements = selectedStudents.filter(
    (student) => student.setupLink?.status === "ACTIVE"
  ).length;

  function toggleStudent(studentId: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  function toggleAll() {
    setSelected(
      allSelected ? new Set() : new Set(eligible.map((student) => student.studentId))
    );
  }

  function send() {
    const ids = selectedStudents.map((student) => student.studentId);
    setError(null);
    setResult(null);
    startTransition(async () => {
      const response = await sendStudentSetupLinks(classId, ids);
      setConfirming(false);
      if (response.error) setError(response.error);
      setResult(response);
      setSelected(new Set());
      router.refresh();
    });
  }

  function retryFailed() {
    if (!result) return;
    setSelected(
      new Set(
        result.recipients
          .filter((item) => item.status === "FAILED")
          .map((item) => item.studentId)
      )
    );
    setResult(null);
  }

  function disconnect() {
    setError(null);
    startTransition(async () => {
      const response = await disconnectGmailConnection(classId);
      if (!response.success) setError(response.error);
      router.refresh();
    });
  }

  const returnTo = `/classes/${classId}/students/setup-links`;
  const connectHref = `/api/integrations/gmail/connect?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Email distribution</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-950">Send securely with Gmail</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Each selected student receives a different one-time setup link.
          </p>
        </div>
        {connectedEmail ? (
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
              Connected as {connectedEmail}
            </span>
            <div className="flex gap-3 text-sm">
              <a href={connectHref} className="font-semibold text-blue-700 hover:text-blue-800">Reconnect</a>
              <button type="button" disabled={pending} onClick={disconnect} className="font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-50">
                Disconnect
              </button>
            </div>
          </div>
        ) : configured ? (
          <a href={connectHref} className="inline-flex justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">
            Connect Gmail
          </a>
        ) : (
          <span className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 ring-1 ring-amber-200">
            Gmail configuration required
          </span>
        )}
      </div>
      {oauthMessage && (
        <div
          role="status"
          className={`border-b px-5 py-3 text-sm sm:px-6 ${
            oauthStatus === "connected"
              ? "border-emerald-100 bg-emerald-50 text-emerald-800"
              : "border-amber-100 bg-amber-50 text-amber-900"
          }`}
        >
          {oauthMessage}
        </div>
      )}

      {error && <div role="alert" className="border-b border-red-100 bg-red-50 px-5 py-3 text-sm text-red-800 sm:px-6">{error}</div>}
      {result && (
        <div role="status" className="flex flex-col gap-3 border-b border-blue-100 bg-blue-50 px-5 py-4 text-sm text-blue-950 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            <strong>{result.sent} sent</strong> · {result.failed} failed · {result.skipped} skipped
            {result.reconnectRequired ? ". Reconnect Gmail before retrying." : "."}
          </p>
          {result.failed > 0 && !result.reconnectRequired && (
            <button type="button" onClick={retryFailed} className="self-start font-semibold text-blue-700 hover:text-blue-900">Select failed students</button>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <label className="inline-flex items-center gap-3 text-sm font-semibold text-slate-800">
          <input type="checkbox" checked={allSelected} disabled={eligible.length === 0 || pending} onChange={toggleAll} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
          Select all ready ({eligible.length})
        </label>
        <button
          type="button"
          disabled={!connectedEmail || selectedStudents.length === 0 || pending}
          onClick={() => setConfirming(true)}
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send {selectedStudents.length > 0 ? `${selectedStudents.length} ` : ""}setup link{selectedStudents.length === 1 ? "" : "s"}
        </button>
      </div>

      <ul className="divide-y divide-slate-100">
        {students.map((student) => {
          const selectable = eligible.some((item) => item.studentId === student.studentId);
          return (
            <li key={student.studentId} className="flex items-start gap-3 px-5 py-4 sm:px-6">
              <input
                type="checkbox"
                aria-label={`Select ${studentName(student)}`}
                checked={selected.has(student.studentId)}
                disabled={!selectable || pending}
                onChange={() => toggleStudent(student.studentId)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              <div className="min-w-0 flex-1 sm:flex sm:items-center sm:justify-between sm:gap-4">
                <div>
                  <p className="font-medium text-slate-900">{studentName(student)}</p>
                  <p className="mt-0.5 break-all text-xs text-slate-500">{student.email?.trim() || "No email address"}</p>
                </div>
                <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset sm:mt-0 ${selectable ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-600 ring-slate-200"}`}>
                  {deliveryLabel(student)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <ConfirmationModal
        open={confirming}
        title={`Send ${selectedStudents.length} setup link${selectedStudents.length === 1 ? "" : "s"}?`}
        confirmLabel="Send with Gmail"
        pendingLabel="Sending..."
        pending={pending}
        onCancel={() => setConfirming(false)}
        onConfirm={send}
        description={first ? (
          <div className="space-y-4">
            <p>Class-pilot will generate a fresh, unique 48-hour link for every recipient.</p>
            {replacements > 0 && <p className="font-medium text-amber-800">{replacements} existing active link{replacements === 1 ? "" : "s"} will be replaced only when sending begins.</p>}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Preview for {first.firstName}</p>
              <p className="mt-2 font-semibold text-slate-900">Set up your Class-pilot account — {className}</p>
              <pre className="mt-3 whitespace-pre-wrap font-sans text-xs leading-5 text-slate-600">{`Hello ${first.firstName},\n\nYour Class-pilot account for ${className} is ready to set up.\n\n[Your unique setup link will appear here]\n\nThis link can be used only once and expires in 48 hours.\n\n— ${instructorName}`}</pre>
            </div>
          </div>
        ) : undefined}
      />
    </section>
  );
}
