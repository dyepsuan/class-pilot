"use client";

import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";

export type ConfirmationModalProps = {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  pendingLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "success" | "danger";
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

const confirmClasses = {
  default:
    "bg-blue-600 shadow-sm text-white hover:bg-blue-700",
  success:
    "bg-green-600 text-white hover:bg-green-700",
  danger:
    "bg-red-600 text-white hover:bg-red-700",
};

export default function ConfirmationModal({
  open,
  title,
  description,
  confirmLabel,
  pendingLabel,
  cancelLabel = "Cancel",
  variant = "default",
  pending = false,
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  const id = useId();
  const titleId = `confirmation-title-${id}`;
  const descriptionId = `confirmation-description-${id}`;
  const confirmButtonRef =
    useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    confirmButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) {
        onCancel();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [open, pending, onCancel]);

  if (!open) {
    return null;
  }

  function cancel() {
    if (!pending) {
      onCancel();
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close confirmation"
        disabled={pending}
        onClick={cancel}
        className="absolute inset-0 bg-black/40 disabled:cursor-wait"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={
          description ? descriptionId : undefined
        }
        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6 sm:py-5">
          <h2
            id={titleId}
            className="text-lg font-semibold text-slate-900"
          >
            {title}
          </h2>

          <button
            type="button"
            aria-label="Close"
            disabled={pending}
            onClick={cancel}
            className="shrink-0 rounded-lg px-2 py-1 text-xl leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            ×
          </button>
        </div>

        {description && (
          <div
            id={descriptionId}
            className="px-5 py-5 text-sm leading-6 text-slate-600 sm:px-6"
          >
            {description}
          </div>
        )}

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            disabled={pending}
            onClick={cancel}
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {cancelLabel}
          </button>

          <button
            ref={confirmButtonRef}
            type="button"
            disabled={pending}
            onClick={onConfirm}
            className={`w-full rounded-lg px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${confirmClasses[variant]}`}
          >
            {pending && pendingLabel
              ? pendingLabel
              : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
