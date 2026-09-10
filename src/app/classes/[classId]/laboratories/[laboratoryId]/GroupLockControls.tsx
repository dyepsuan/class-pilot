"use client";

import { useActionState, useRef, useState } from "react";

import ConfirmationModal from "@/components/ConfirmationModal";
import {
  lockLaboratoryGroups,
  unlockLaboratoryGroups,
  type GroupLockState,
} from "./actions";

type Props = {
  classId: string;
  laboratoryId: string;
  locked: boolean;
  hasScores: boolean;
  hasSubmissions: boolean;
  hasGroups: boolean;
};

const initialState: GroupLockState = {};

export default function GroupLockControls({
  classId,
  laboratoryId,
  locked,
  hasScores,
  hasSubmissions,
  hasGroups,
}: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const action = (locked ? unlockLaboratoryGroups : lockLaboratoryGroups).bind(
    null,
    classId,
    laboratoryId
  );
  const [state, formAction, pending] = useActionState(action, initialState);

  const unlockDisabled = locked && (hasScores || hasSubmissions);
  const actionDisabled = pending || unlockDisabled || (!locked && !hasGroups);
  const unlockDisabledMessage = hasSubmissions
    ? "Groups cannot be unlocked because a group submission has already been recorded."
    : "Groups cannot be unlocked because scoring has already started.";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
              locked
                ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                : "bg-amber-50 text-amber-700 ring-amber-100"
            }`}>
              Grouping: {locked ? "Locked" : "Draft"}
            </span>
            {locked && hasScores && (
              <span className="text-xs font-semibold text-slate-600">
                Scores already recorded
              </span>
            )}
            {locked && hasSubmissions && (
              <span className="text-xs font-semibold text-slate-600">
                Submission already recorded
              </span>
            )}
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {locked
              ? "Students can see their official group and group members."
              : "Draft groups remain hidden from students until you lock them in."}
          </p>
          {unlockDisabled && (
            <p className="mt-1 text-sm font-medium text-amber-700">
              {unlockDisabledMessage}
            </p>
          )}
          {!locked && !hasGroups && (
            <p className="mt-1 text-sm font-medium text-amber-700">
              Create at least one group before locking the grouping.
            </p>
          )}
          {state.error && (
            <p className="mt-2 text-sm font-medium text-red-700">{state.error}</p>
          )}
        </div>

        <form ref={formRef} action={formAction} className="shrink-0">
          <button
            type="button"
            disabled={actionDisabled}
            onClick={() => setConfirmationOpen(true)}
            className={`w-full rounded-lg px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${
              locked
                ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                : "bg-blue-600 text-white shadow-sm hover:bg-blue-700"
            }`}
          >
            {locked ? "Unlock Groups" : "Lock In Groups"}
          </button>
        </form>
      </div>

      <ConfirmationModal
        open={confirmationOpen}
        title={locked ? "Unlock laboratory groups?" : "Lock in laboratory groups?"}
        description={locked ? (
          <p>
            Students will temporarily stop seeing this laboratory&apos;s official grouping,
            and you will be able to edit or regenerate the groups again. Lock the groups
            again when you are finished.
          </p>
        ) : (
          <div className="space-y-3">
            <p>
              These groups will become the official grouping for this laboratory and will
              be visible to students.
            </p>
            <p>
              You may unlock the groups before scoring begins, but once any score has been
              recorded or a group submission has been uploaded, the grouping can no longer
              be unlocked.
            </p>
          </div>
        )}
        confirmLabel={locked ? "Unlock Groups" : "Lock In Groups"}
        pendingLabel={locked ? "Unlocking..." : "Locking..."}
        pending={pending}
        onConfirm={() => {
          setConfirmationOpen(false);
          formRef.current?.requestSubmit();
        }}
        onCancel={() => setConfirmationOpen(false)}
      />
    </div>
  );
}
