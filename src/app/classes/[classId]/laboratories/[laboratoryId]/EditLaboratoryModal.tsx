"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import ConfirmationModal from "@/components/ConfirmationModal";

import {
  deleteLaboratory,
  updateLaboratory,
  type DeleteLaboratoryState,
  type UpdateLaboratoryState,
} from "./actions";

type Props = {
  classId: string;
  laboratoryId: string;
  laboratory: {
    labNo: number;
    title: string;
    description: string | null;
    labType: "individual" | "group";
    totalPoints: number;
    groupPoints: number;
    individualPoints: number;
    startDate: string | null;
    dueDate: string | null;
  };
  scoringLocked: boolean;
};

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-slate-500 read-only:cursor-not-allowed read-only:bg-slate-50 read-only:text-slate-500";

const initialUpdateState: UpdateLaboratoryState = {};
const initialDeleteState: DeleteLaboratoryState = {};

export default function EditLaboratoryModal({
  classId,
  laboratoryId,
  laboratory,
  scoringLocked,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] =
    useState(false);
  const [
    deleteConfirmationOpen,
    setDeleteConfirmationOpen,
  ] = useState(false);
  const deleteSubmitRef =
    useRef<HTMLButtonElement>(null);
  const deleteRequested = useRef(false);

  const [totalPoints, setTotalPoints] = useState(
    String(laboratory.totalPoints)
  );
  const [groupPoints, setGroupPoints] = useState(
    String(laboratory.groupPoints)
  );
  const [individualPoints, setIndividualPoints] =
    useState(String(laboratory.individualPoints));

  const updateAction = updateLaboratory.bind(
    null,
    classId,
    laboratoryId
  );
  const deleteAction = deleteLaboratory.bind(
    null,
    classId,
    laboratoryId
  );

  async function updateAndClose(
    previousState: UpdateLaboratoryState,
    formData: FormData
  ): Promise<UpdateLaboratoryState> {
    const result = await updateAction(
      previousState,
      formData
    );

    if (result.success) {
      setOpen(false);
      setConfirmingDelete(false);
      setDeleteConfirmationOpen(false);
      router.refresh();
    }

    return result;
  }

  const [
    updateState,
    updateFormAction,
    updatePending,
  ] = useActionState(
    updateAndClose,
    initialUpdateState
  );
  const [
    deleteState,
    deleteFormAction,
    deletePending,
  ] = useActionState(
    deleteAction,
    initialDeleteState
  );

  useEffect(() => {
    if (!deletePending) {
      deleteRequested.current = false;
    }
  }, [deletePending]);

  function resetScoringFromLaboratory() {
    setTotalPoints(String(laboratory.totalPoints));
    setGroupPoints(String(laboratory.groupPoints));
    setIndividualPoints(
      String(laboratory.individualPoints)
    );
  }

  function openModal() {
    resetScoringFromLaboratory();
    setConfirmingDelete(false);
    setDeleteConfirmationOpen(false);
    setOpen(true);
  }

  function closeModal() {
    if (updatePending || deletePending) {
      return;
    }

    resetScoringFromLaboratory();
    setConfirmingDelete(false);
    setDeleteConfirmationOpen(false);
    setOpen(false);
  }

  function confirmDeletion() {
    if (deleteRequested.current) {
      return;
    }

    deleteRequested.current = true;
    deleteSubmitRef.current?.click();
  }

  const total = Number(totalPoints) || 0;
  const group = Number(groupPoints) || 0;
  const individual = Number(individualPoints) || 0;
  const allocated = group + individual;
  const allocationMatches =
    Math.abs(allocated - total) < 0.0001;

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:w-auto"
      >
        Edit Laboratory
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close edit laboratory modal"
            onClick={closeModal}
            className="absolute inset-0 bg-black/40"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-laboratory-title"
            className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
          >
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4 sm:px-6 sm:py-5">
              <div>
                <h2
                  id="edit-laboratory-title"
                  className="text-lg font-semibold text-slate-900"
                >
                  Edit Laboratory
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Update laboratory details and scoring settings.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                aria-label="Close"
                className="rounded-lg px-2 py-1 text-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                ×
              </button>
            </div>

            <form
              action={updateFormAction}
              className="flex min-h-0 flex-1 flex-col"
            >
              <button
                ref={deleteSubmitRef}
                type="submit"
                formAction={deleteFormAction}
                formNoValidate
                tabIndex={-1}
                aria-hidden="true"
                className="hidden"
              />

              <div className="overflow-y-auto px-5 py-5 sm:px-6">
                {updateState.error && (
                  <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {updateState.error}
                  </div>
                )}

                <div className="grid gap-5 sm:grid-cols-3">
                  <div>
                    <label
                      htmlFor="edit_lab_no"
                      className="mb-2 block text-sm font-medium text-slate-700"
                    >
                      Laboratory No.
                    </label>

                    <input
                      id="edit_lab_no"
                      name="lab_no"
                      type="number"
                      min="1"
                      step="1"
                      required
                      defaultValue={laboratory.labNo}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="edit_start_date"
                      className="mb-2 block text-sm font-medium text-slate-700"
                    >
                      Start Date
                    </label>

                    <input
                      id="edit_start_date"
                      name="start_date"
                      type="date"
                      defaultValue={laboratory.startDate ?? ""}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="edit_due_date"
                      className="mb-2 block text-sm font-medium text-slate-700"
                    >
                      Due Date
                    </label>

                    <input
                      id="edit_due_date"
                      name="due_date"
                      type="date"
                      defaultValue={laboratory.dueDate ?? ""}
                      className={inputClass}
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label
                      htmlFor="edit_title"
                      className="mb-2 block text-sm font-medium text-slate-700"
                    >
                      Title
                    </label>

                    <input
                      id="edit_title"
                      name="title"
                      type="text"
                      required
                      defaultValue={laboratory.title}
                      className={inputClass}
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label
                      htmlFor="edit_description"
                      className="mb-2 block text-sm font-medium text-slate-700"
                    >
                      Description
                    </label>

                    <textarea
                      id="edit_description"
                      name="description"
                      rows={3}
                      defaultValue={laboratory.description ?? ""}
                      placeholder="Optional instructions or notes..."
                      className={`${inputClass} resize-none`}
                    />
                  </div>
                </div>

                <div className="mt-6 border-t border-slate-200 pt-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-medium text-slate-900">
                        Scoring
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        Laboratory type cannot be changed.
                      </p>
                    </div>

                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-600">
                      {laboratory.labType}
                    </span>
                  </div>

                  {scoringLocked && (
                    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      Scoring settings are locked because grading
                      has already started.
                    </div>
                  )}

                  <div className="mt-5">
                    <label
                      htmlFor="edit_total_points"
                      className="mb-2 block text-sm font-medium text-slate-700"
                    >
                      Total Points
                    </label>

                    <input
                      id="edit_total_points"
                      name="total_points"
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      readOnly={scoringLocked}
                      value={totalPoints}
                      onChange={(event) =>
                        setTotalPoints(event.target.value)
                      }
                      className={inputClass}
                    />
                  </div>

                  {laboratory.labType === "group" && (
                    <div className="mt-5 rounded-xl bg-slate-50 p-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label
                            htmlFor="edit_group_points"
                            className="mb-2 block text-sm font-medium text-slate-700"
                          >
                            Group Output
                          </label>

                          <input
                            id="edit_group_points"
                            name="group_points"
                            type="number"
                            min="0"
                            step="0.01"
                            required
                            readOnly={scoringLocked}
                            value={groupPoints}
                            onChange={(event) =>
                              setGroupPoints(event.target.value)
                            }
                            className={inputClass}
                          />
                        </div>

                        <div>
                          <label
                            htmlFor="edit_individual_points"
                            className="mb-2 block text-sm font-medium text-slate-700"
                          >
                            Individual Contribution
                          </label>

                          <input
                            id="edit_individual_points"
                            name="individual_points"
                            type="number"
                            min="0"
                            step="0.01"
                            required
                            readOnly={scoringLocked}
                            value={individualPoints}
                            onChange={(event) =>
                              setIndividualPoints(
                                event.target.value
                              )
                            }
                            className={inputClass}
                          />
                        </div>
                      </div>

                      {!scoringLocked && (
                        <div
                          className={`mt-4 flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${
                            allocationMatches
                              ? "border-green-200 bg-green-50 text-green-700"
                              : "border-amber-200 bg-amber-50 text-amber-700"
                          }`}
                        >
                          <span>
                            Allocated:{" "}
                            <strong>
                              {allocated} / {total}
                            </strong>
                          </span>

                          <span>
                            {allocationMatches
                              ? "Complete"
                              : "Adjust allocation"}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-6 rounded-xl border border-red-200 bg-red-50/50 p-4">
                  <h3 className="font-medium text-red-800">
                    Danger Zone
                  </h3>

                  <p className="mt-1 text-sm text-red-700">
                    Delete this laboratory and all of its associated
                    groups, assignments, and recorded scores.
                  </p>

                  {deleteState.error && (
                    <div className="mt-3 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-red-700">
                      {deleteState.error}
                    </div>
                  )}

                  {!confirmingDelete ? (
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(true)}
                      className="mt-4 rounded-lg border border-red-300 bg-white px-4 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-50"
                    >
                      Delete Laboratory
                    </button>
                  ) : (
                    <div className="mt-4 rounded-lg border border-red-200 bg-white p-4">
                      <p className="font-medium text-red-900">
                        Delete Laboratory {laboratory.labNo}?
                      </p>

                      <p className="mt-1 text-sm text-red-700">
                        This will permanently delete the laboratory,
                        its groups, assignments, and recorded scores.
                      </p>

                      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <button
                          type="button"
                          disabled={deletePending}
                          onClick={() =>
                            setConfirmingDelete(false)
                          }
                          className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                        >
                          Cancel
                        </button>

                        <button
                          type="button"
                          disabled={deletePending}
                          onClick={() =>
                            setDeleteConfirmationOpen(true)
                          }
                          className="rounded-lg border border-red-300 bg-white px-4 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                        >
                          Continue
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                <button
                  type="button"
                  disabled={updatePending || deletePending}
                  onClick={closeModal}
                  className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={updatePending || deletePending}
                  className="rounded-lg bg-blue-600 shadow-sm px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {updatePending
                    ? "Saving..."
                    : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmationModal
        open={deleteConfirmationOpen}
        title="Confirm Permanent Deletion"
        description={
          <div className="space-y-2">
            <p>
              Permanently delete Laboratory {laboratory.labNo}?
            </p>

            <p>
              This action cannot be undone.
            </p>

            {deleteState.error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">
                {deleteState.error}
              </p>
            )}
          </div>
        }
        confirmLabel="Delete Laboratory"
        pendingLabel="Deleting..."
        variant="danger"
        pending={deletePending}
        onConfirm={confirmDeletion}
        onCancel={() =>
          setDeleteConfirmationOpen(false)
        }
      />
    </>
  );
}
