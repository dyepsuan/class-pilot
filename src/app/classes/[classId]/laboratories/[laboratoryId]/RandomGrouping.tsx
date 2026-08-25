"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useFormStatus } from "react-dom";

import ConfirmationModal from "@/components/ConfirmationModal";

import {
  randomizeLaboratoryGroups,
  type RandomGroupingState,
} from "./actions";

type RandomGroupingProps = {
  classId: string;
  laboratoryId: string;
  studentCount: number;
  existingGroupCount: number;
  assignedCount: number;
};

const initialState: RandomGroupingState = {};

function RandomizeButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-blue-600 shadow-sm px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Randomizing..." : "Randomize Groups"}
    </button>
  );
}

export default function RandomGrouping({
  classId,
  laboratoryId,
  studentCount,
  existingGroupCount,
  assignedCount,
}: RandomGroupingProps) {
  const randomizeWithLaboratory =
    randomizeLaboratoryGroups.bind(
      null,
      classId,
      laboratoryId
    );

  const [state, formAction, pending] = useActionState(
    randomizeWithLaboratory,
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

  const [mode, setMode] = useState<
    "group_count" | "students_per_group"
  >("group_count");

  const [groupingValue, setGroupingValue] =
    useState("2");

  const numericValue = Number(groupingValue) || 0;

  const calculatedGroupCount = useMemo(() => {
    if (studentCount === 0 || numericValue <= 0) {
      return 0;
    }

    if (mode === "group_count") {
      return Math.min(
        numericValue,
        studentCount
      );
    }

    return Math.ceil(
      studentCount / numericValue
    );
  }, [
    mode,
    numericValue,
    studentCount,
  ]);

  const averageSize =
    calculatedGroupCount > 0
      ? studentCount / calculatedGroupCount
      : 0;

  const smallestGroup =
    calculatedGroupCount > 0
      ? Math.floor(averageSize)
      : 0;

  const largestGroup =
    calculatedGroupCount > 0
      ? Math.ceil(averageSize)
      : 0;

  const hasExistingGrouping =
    existingGroupCount > 0 ||
    assignedCount > 0;

  function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    if (!hasExistingGrouping) {
      return;
    }

    if (confirmedSubmission.current) {
      confirmedSubmission.current = false;
      return;
    }

    event.preventDefault();
    setConfirmationOpen(true);
  }

  function confirmRandomization() {
    if (submissionRequested.current) {
      return;
    }

    submissionRequested.current = true;
    confirmedSubmission.current = true;
    formRef.current?.requestSubmit();
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
            <h3 className="font-semibold text-slate-900">
            Random Grouping
            </h3>

            <p className="mt-1 text-sm text-slate-500">
            Randomly distribute the active students into balanced groups.
            </p>
        </div>

        <div className="text-sm text-slate-500">
            <span className="font-semibold text-slate-900">
            {studentCount}
            </span>{" "}
            active students
        </div>
        </div>

        {/* Messages */}
        {(state.error || state.success || hasExistingGrouping) && (
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {state.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {state.error}
            </div>
            )}

            {state.success && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {state.success}
            </div>
            )}

            {hasExistingGrouping && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Randomizing will replace the current groups and assignments.
            </div>
            )}
        </div>
        )}

        <form
        ref={formRef}
        action={formAction}
        onSubmit={handleSubmit}
        className="mt-6"
        >
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_220px_minmax(0,1fr)_auto] lg:items-end">
            {/* Method */}
            <div>
            <div className="mb-2 text-sm font-medium text-slate-700">
                Grouping Method
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
                <label
                className={`cursor-pointer rounded-lg border px-4 py-3 transition ${
                    mode === "group_count"
                    ? "border-slate-400 bg-slate-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
                >
                <div className="flex items-start gap-3">
                    <input
                    type="radio"
                    name="mode"
                    value="group_count"
                    checked={mode === "group_count"}
                    onChange={() => setMode("group_count")}
                    className="mt-1"
                    />

                    <div>
                    <div className="text-sm font-medium text-slate-900">
                        Number of groups
                    </div>

                    <div className="mt-0.5 text-xs text-slate-500">
                        Choose how many groups you want.
                    </div>
                    </div>
                </div>
                </label>

                <label
                className={`cursor-pointer rounded-lg border px-4 py-3 transition ${
                    mode === "students_per_group"
                    ? "border-slate-400 bg-slate-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
                >
                <div className="flex items-start gap-3">
                    <input
                    type="radio"
                    name="mode"
                    value="students_per_group"
                    checked={mode === "students_per_group"}
                    onChange={() => setMode("students_per_group")}
                    className="mt-1"
                    />

                    <div>
                    <div className="text-sm font-medium text-slate-900">
                        Students per group
                    </div>

                    <div className="mt-0.5 text-xs text-slate-500">
                        Set the maximum group size.
                    </div>
                    </div>
                </div>
                </label>
            </div>
            </div>

            {/* Value */}
            <div>
            <label
                htmlFor="grouping_value"
                className="mb-2 block text-sm font-medium text-slate-700"
            >
                {mode === "group_count"
                ? "Number of Groups"
                : "Students per Group"}
            </label>

            <input
                id="grouping_value"
                name="grouping_value"
                type="number"
                min="1"
                max={studentCount || 1}
                step="1"
                value={groupingValue}
                onChange={(event) =>
                setGroupingValue(event.target.value)
                }
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
            />
            </div>

            {/* Preview */}
            <div className="rounded-lg bg-slate-50 px-4 py-3">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Preview
            </div>

            {calculatedGroupCount > 0 ? (
                <div className="mt-1 text-sm text-slate-600">
                <span className="font-semibold text-slate-900">
                    {calculatedGroupCount}
                </span>{" "}
                {calculatedGroupCount === 1 ? "group" : "groups"}
                {" · "}
                <span className="font-semibold text-slate-900">
                    {smallestGroup === largestGroup
                    ? smallestGroup
                    : `${smallestGroup}–${largestGroup}`}
                </span>{" "}
                students each
                </div>
            ) : (
                <div className="mt-1 text-sm text-slate-400">
                Enter a grouping value
                </div>
            )}
            </div>

            {/* Action */}
            <RandomizeButton />
        </div>
        </form>

        <ConfirmationModal
          open={confirmationOpen}
          title="Randomize Groups"
          description={
            <p>
              Random grouping will replace the current
              groups and student assignments.
            </p>
          }
          confirmLabel="Randomize Groups"
          pendingLabel="Randomizing..."
          pending={pending}
          onConfirm={confirmRandomization}
          onCancel={() => setConfirmationOpen(false)}
        />
    </div>
    );
}
