"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  generateStudentQrForSheet,
  getStudentQrForSheet,
} from "@/app/classes/student-qr-sheet-actions";
import StudentQrCode from "@/components/student-qr-code";

export type StudentQrSheetStudent = {
  studentId: number;
  studentName: string;
  studentNumber: string;
};

type StudentQrSheetProps = {
  classId: number;
  open: boolean;
  student: StudentQrSheetStudent | null;
  opener: HTMLElement | null;
  onRequestClose: () => void;
  onExited: () => void;
};

type SheetState =
  | { status: "loading" }
  | { status: "ready"; payload: string }
  | { status: "missing" }
  | { status: "error"; message: string };

const defaultError = "Unable to load QR code. Please try again.";

export default function StudentQrSheet({
  classId,
  open,
  student,
  opener,
  onRequestClose,
  onExited,
}: StudentQrSheetProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(false);
  const [state, setState] = useState<SheetState>({ status: "loading" });
  const [generating, setGenerating] = useState(false);
  const titleId = useId();
  const descriptionId = useId();
  const isBusy = state.status === "loading" || generating;
  const isBusyRef = useRef(isBusy);

  useEffect(() => {
    isBusyRef.current = isBusy;
  }, [isBusy]);

  useEffect(() => {
    if (!open) {
      if (!mounted) {
        return;
      }

      let exitTimer: number | undefined;
      const exitFrame = window.requestAnimationFrame(() => {
        setEntered(false);
        const exitDuration = window.matchMedia("(prefers-reduced-motion: reduce)")
          .matches
          ? 0
          : 180;
        exitTimer = window.setTimeout(() => {
          setMounted(false);
          onExited();
        }, exitDuration);
      });

      return () => {
        window.cancelAnimationFrame(exitFrame);
        if (exitTimer !== undefined) {
          window.clearTimeout(exitTimer);
        }
      };
    }

    if (!mounted) {
      const mountFrame = window.requestAnimationFrame(() => setMounted(true));

      return () => window.cancelAnimationFrame(mountFrame);
    }

    const enterFrame = window.requestAnimationFrame(() => setEntered(true));

    return () => window.cancelAnimationFrame(enterFrame);
  }, [mounted, onExited, open]);

  useEffect(() => {
    if (!open || !student) {
      return;
    }

    let cancelled = false;
    const loadTimer = window.setTimeout(() => {
      setGenerating(false);
      setState({ status: "loading" });

      getStudentQrForSheet(classId, student.studentId)
        .then((result) => {
          if (cancelled) {
            return;
          }

          if (result.error) {
            setState({ status: "error", message: result.error });
          } else if (result.payload) {
            setState({ status: "ready", payload: result.payload });
          } else {
            setState({ status: "missing" });
          }
        })
        .catch(() => {
          if (!cancelled) {
            setState({ status: "error", message: defaultError });
          }
        });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(loadTimer);
    };
  }, [classId, open, student]);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (!isBusyRef.current) {
          event.preventDefault();
          onRequestClose();
        }
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        ) ?? []
      );

      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      opener?.focus();
    };
  }, [mounted, onRequestClose, opener]);

  async function loadQrAgain() {
    if (!student) {
      return;
    }

    setState({ status: "loading" });

    try {
      const result = await getStudentQrForSheet(classId, student.studentId);

      if (result.error) {
        setState({ status: "error", message: result.error });
      } else if (result.payload) {
        setState({ status: "ready", payload: result.payload });
      } else {
        setState({ status: "missing" });
      }
    } catch {
      setState({ status: "error", message: defaultError });
    }
  }

  async function generateQr() {
    if (!student) {
      return;
    }

    setGenerating(true);

    try {
      const result = await generateStudentQrForSheet(classId, student.studentId);

      if (result.error || !result.payload) {
        setState({
          status: "error",
          message: result.error ?? defaultError,
        });
      } else {
        setState({ status: "ready", payload: result.payload });
      }
    } catch {
      setState({ status: "error", message: defaultError });
    } finally {
      setGenerating(false);
    }
  }

  if (!mounted || !student || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className={`fixed inset-0 z-50 md:flex md:items-center md:justify-center md:p-6 ${entered ? "" : "pointer-events-none"}`}
      aria-hidden={!entered}
    >
      <button
        type="button"
        aria-label="Close QR code"
        disabled={isBusy}
        onClick={onRequestClose}
        className={`absolute inset-0 bg-slate-950/45 backdrop-blur-[1px] transition-opacity duration-180 motion-reduce:duration-0 disabled:cursor-wait ${
          entered ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={`absolute bottom-0 left-0 right-0 max-h-[min(42rem,calc(100dvh-1rem))] overflow-y-auto rounded-t-2xl border-x border-t border-slate-200 bg-white shadow-[0_-18px_55px_rgba(15,23,42,0.18)] transition-[transform,opacity] duration-180 ease-out motion-reduce:duration-0 md:relative md:bottom-auto md:left-auto md:right-auto md:max-h-[calc(100dvh-3rem)] md:w-full md:max-w-xl md:rounded-2xl md:border md:shadow-[0_24px_70px_rgba(15,23,42,0.22)] ${
          entered
            ? "translate-y-0 md:scale-100 md:opacity-100"
            : "translate-y-full md:translate-y-0 md:scale-95 md:opacity-0"
        }`}
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-slate-300 md:hidden" aria-hidden="true" />

        <div className="mx-auto w-full max-w-3xl px-5 pb-7 pt-4 sm:px-8 sm:pb-9">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 id={titleId} className="text-lg font-semibold tracking-tight text-slate-950">
                View Student QR
              </h2>
              <p id={descriptionId} className="mt-1 text-sm text-slate-500">
                {student.studentName}
              </p>
              <p className="mt-0.5 text-sm text-slate-500 [font-variant-numeric:tabular-nums]">
                {student.studentNumber}
              </p>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              aria-label="Close QR code"
              disabled={isBusy}
              onClick={onRequestClose}
              className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xl leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-wait disabled:opacity-50 active:translate-y-px"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>

          <div className="mt-6 flex min-h-72 items-center justify-center">
            {state.status === "loading" && (
              <div className="w-full max-w-[22rem]" aria-live="polite" aria-label="Loading QR code">
                <div className="mx-auto h-56 w-56 animate-pulse rounded-xl border border-slate-200 bg-slate-100 motion-reduce:animate-none" />
                <div className="mx-auto mt-5 h-3 w-44 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
              </div>
            )}

            {state.status === "ready" && (
              <div className="w-full">
                <StudentQrCode
                  payload={state.payload}
                  studentNumber={student.studentNumber}
                  allowDownload={false}
                  size={320}
                  accessibleLabel={`Attendance QR code for ${student.studentName}`}
                />
                <p className="mt-5 text-center text-xs text-slate-500">
                  Present this QR code to the instructor during attendance.
                </p>
              </div>
            )}

            {state.status === "missing" && (
              <div className="max-w-sm text-center">
                <p className="text-sm text-slate-600">
                  This student does not have a ClassPilot QR credential yet.
                </p>
                <button
                  type="button"
                  disabled={generating}
                  onClick={generateQr}
                  className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 active:translate-y-px"
                >
                  {generating ? "Generating..." : "Generate QR"}
                </button>
              </div>
            )}

            {state.status === "error" && (
              <div className="max-w-sm text-center" role="alert">
                <p className="text-sm font-medium text-slate-700">{state.message}</p>
                <button
                  type="button"
                  onClick={loadQrAgain}
                  className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:translate-y-px"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
