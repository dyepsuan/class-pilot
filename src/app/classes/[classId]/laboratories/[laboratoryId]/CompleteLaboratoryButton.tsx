"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import { useFormStatus } from "react-dom";

import ConfirmationModal from "@/components/ConfirmationModal";

import {
  completeLaboratory,
  type CompleteLaboratoryState,
} from "./actions";

type Props = {
  classId: string;
  laboratoryId: string;
  canComplete: boolean;
  incompleteMessage?: string;
};

const initialState: CompleteLaboratoryState = {};

function SubmitButton({
  canComplete,
}: {
  canComplete: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || !canComplete}
      className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
    >
      {pending
        ? "Completing..."
        : "Complete Laboratory"}
    </button>
  );
}

export default function CompleteLaboratoryButton({
  classId,
  laboratoryId,
  canComplete,
  incompleteMessage,
}: Props) {
  const completeAction = completeLaboratory.bind(
    null,
    classId,
    laboratoryId
  );

  const [state, formAction, pending] =
    useActionState(
      completeAction,
      initialState
    );

  const formRef = useRef<HTMLFormElement>(null);
  const confirmedSubmission = useRef(false);
  const submissionRequested = useRef(false);
  const wasPending = useRef(false);
  const [confirmationOpen, setConfirmationOpen] =
    useState(false);

  useEffect(() => {
    if (pending) {
      wasPending.current = true;
      return;
    }

    if (wasPending.current) {
      wasPending.current = false;
      submissionRequested.current = false;
      setConfirmationOpen(false);
    }
  }, [pending]);

  function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    if (!canComplete) {
      event.preventDefault();
      return;
    }

    if (confirmedSubmission.current) {
      confirmedSubmission.current = false;
      return;
    }

    event.preventDefault();
    setConfirmationOpen(true);
  }

  function confirmCompletion() {
    if (submissionRequested.current) {
      return;
    }

    submissionRequested.current = true;
    confirmedSubmission.current = true;
    formRef.current?.requestSubmit();
  }

  return (
    <>
      <div className="flex w-full flex-col gap-2 sm:items-end">
        <form
          ref={formRef}
          action={formAction}
          onSubmit={handleSubmit}
          className="w-full sm:w-auto"
        >
          <SubmitButton
            canComplete={canComplete}
          />
        </form>

        {!canComplete && incompleteMessage && (
          <p className="w-full text-left text-xs text-slate-500 sm:max-w-sm sm:text-right">
            {incompleteMessage}
          </p>
        )}

        {state.error && (
          <p className="w-full text-left text-xs text-red-600 sm:max-w-sm sm:text-right">
            {state.error}
          </p>
        )}
      </div>

      <ConfirmationModal
        open={confirmationOpen}
        title="Complete Laboratory"
        description={
          <div className="space-y-2">
            <p>
              Are you sure you want to complete this
              laboratory?
            </p>

            <p>
              Scores will become read-only. You can reopen
              the laboratory later if corrections are
              needed.
            </p>
          </div>
        }
        confirmLabel="Complete Laboratory"
        pendingLabel="Completing..."
        variant="success"
        pending={pending}
        onConfirm={confirmCompletion}
        onCancel={() => setConfirmationOpen(false)}
      />
    </>
  );
}
