"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  generateStudentPortalPin,
  resetStudentPortalPin,
} from "@/app/classes/[classId]/students/portal-actions";

import ConfirmationModal from "./ConfirmationModal";

function OneTimePinModal({
  studentName,
  pin,
  onClose,
}: {
  studentName: string;
  pin: string;
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

  async function copyPin() {
    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard unavailable");
      }

      await navigator.clipboard.writeText(pin);
      setCopyFeedback("Copied");
    } catch {
      setCopyFeedback("Select and copy the PIN manually.");
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close student portal PIN"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-portal-pin-title"
        aria-describedby="student-portal-pin-description"
        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="border-b border-slate-200 px-5 py-4 sm:px-6 sm:py-5">
          <h2
            id="student-portal-pin-title"
            className="text-lg font-semibold text-slate-900"
          >
            Student Portal PIN
          </h2>
          <p className="mt-1 break-words text-sm font-medium text-slate-600">
            {studentName}
          </p>
        </div>

        <div className="px-5 py-6 text-center sm:px-6">
          <p
            aria-label={`Generated PIN ${pin.split("").join(" ")}`}
            className="select-all font-mono text-4xl font-bold tracking-[0.2em] text-slate-950 tabular-nums"
          >
            {pin}
          </p>
          <p
            id="student-portal-pin-description"
            className="mx-auto mt-5 max-w-sm text-sm leading-6 text-slate-600"
          >
            Give this PIN to the student so they can sign in to the Class-pilot
            Student Portal. It will not be shown again after you close this
            window.
          </p>
          <p
            role="status"
            aria-live="polite"
            className="mt-3 min-h-5 text-sm font-medium text-blue-700"
          >
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
            onClick={copyPin}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 active:translate-y-px sm:w-auto"
          >
            {copyFeedback === "Copied" ? "Copied" : "Copy PIN"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StudentPortalPinAction({
  classId,
  studentId,
  studentName,
  initialHasAccount,
}: {
  classId: number;
  studentId: number;
  studentName: string;
  initialHasAccount: boolean;
}) {
  const router = useRouter();
  const [hasAccount, setHasAccount] = useState(initialHasAccount);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [revealedPin, setRevealedPin] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const closePinModal = useCallback(() => {
    setRevealedPin(null);
  }, []);

  function confirmPinAction() {
    setError(null);

    startTransition(async () => {
      const result = hasAccount
        ? await resetStudentPortalPin(classId, studentId)
        : await generateStudentPortalPin(classId, studentId);

      if (!result.success) {
        setError(result.error);
        return;
      }

      setHasAccount(true);
      setConfirmationOpen(false);
      setRevealedPin(result.pin);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex flex-col items-start gap-1.5">
        <button
          type="button"
          onClick={() => {
            setError(null);
            setConfirmationOpen(true);
          }}
          className="whitespace-nowrap rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 active:translate-y-px focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
          aria-label={`${hasAccount ? "Reset" : "Generate"} portal PIN for ${studentName}`}
        >
          {hasAccount ? "Reset PIN" : "Generate PIN"}
        </button>
        {error && (
          <p role="alert" className="max-w-56 text-xs leading-5 text-red-700">
            {error}
          </p>
        )}
      </div>

      <ConfirmationModal
        open={confirmationOpen}
        title={
          hasAccount
            ? "Reset Student Portal PIN?"
            : "Generate Student Portal PIN?"
        }
        description={
          hasAccount ? (
            <>
              A new PIN will be generated for {studentName}. Their current PIN
              will stop working and they will be signed out of all student
              portal sessions.
            </>
          ) : (
            <>
              This will create a Class-pilot student portal account for {studentName}.
              The generated PIN will only be shown once.
            </>
          )
        }
        confirmLabel={hasAccount ? "Reset PIN" : "Generate PIN"}
        pendingLabel={hasAccount ? "Resetting..." : "Generating..."}
        pending={pending}
        variant="default"
        onConfirm={confirmPinAction}
        onCancel={() => {
          setError(null);
          setConfirmationOpen(false);
        }}
      />

      {revealedPin && (
        <OneTimePinModal
          studentName={studentName}
          pin={revealedPin}
          onClose={closePinModal}
        />
      )}
    </>
  );
}
