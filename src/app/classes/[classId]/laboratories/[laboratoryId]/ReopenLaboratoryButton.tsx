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
  reopenLaboratory,
  type ReopenLaboratoryState,
} from "./actions";

type Props = {
  classId: string;
  laboratoryId: string;
};

const initialState: ReopenLaboratoryState = {};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
    >
      {pending
        ? "Reopening..."
        : "Reopen Laboratory"}
    </button>
  );
}

export default function ReopenLaboratoryButton({
  classId,
  laboratoryId,
}: Props) {
  const reopenAction = reopenLaboratory.bind(
    null,
    classId,
    laboratoryId
  );

  const [state, formAction, pending] =
    useActionState(
      reopenAction,
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
    if (confirmedSubmission.current) {
      confirmedSubmission.current = false;
      return;
    }

    event.preventDefault();
    setConfirmationOpen(true);
  }

  function confirmReopen() {
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
          <SubmitButton />
        </form>

        {state.error && (
          <p className="w-full text-left text-xs text-red-600 sm:max-w-sm sm:text-right">
            {state.error}
          </p>
        )}
      </div>

      <ConfirmationModal
        open={confirmationOpen}
        title="Reopen Laboratory"
        description={
          <div className="space-y-2">
            <p>Reopen this laboratory?</p>

            <p>
              Scores will become editable again. Existing
              scores and group assignments will be
              preserved.
            </p>
          </div>
        }
        confirmLabel="Reopen Laboratory"
        pendingLabel="Reopening..."
        pending={pending}
        onConfirm={confirmReopen}
        onCancel={() => setConfirmationOpen(false)}
      />
    </>
  );
}
