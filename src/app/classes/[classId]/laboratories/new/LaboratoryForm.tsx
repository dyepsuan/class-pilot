"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";

import {
  createLaboratory,
  type CreateLaboratoryState,
} from "../actions";

type LaboratoryFormProps = {
  classId: string;
  nextLabNo: number;
};

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-slate-500";

const initialState: CreateLaboratoryState = {};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-blue-600 shadow-sm px-5 py-2.5 text-sm font-medium text-white transition sm:w-auto hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Creating..." : "Create Laboratory"}
    </button>
  );
}

export default function LaboratoryForm({
  classId,
  nextLabNo,
}: LaboratoryFormProps) {
  const createLaboratoryWithClass = createLaboratory.bind(null, classId);

  const [state, formAction] = useActionState(
    createLaboratoryWithClass,
    initialState
  );

  const [labType, setLabType] = useState<"individual" | "group">(
    "individual"
  );

  const [totalPoints, setTotalPoints] = useState("100");
  const [groupPoints, setGroupPoints] = useState("0");
  const [individualPoints, setIndividualPoints] = useState("100");

  const total = Number(totalPoints) || 0;
  const group = Number(groupPoints) || 0;
  const individual = Number(individualPoints) || 0;

  const allocated = group + individual;
  const remaining = total - allocated;

  function selectIndividualLaboratory() {
    setLabType("individual");
    setGroupPoints("0");
    setIndividualPoints(totalPoints);
  }

  function updateTotalPoints(value: string) {
    setTotalPoints(value);

    if (labType === "individual") {
      setGroupPoints("0");
      setIndividualPoints(value);
    }
  }

  return (
    <form action={formAction} className="space-y-6">
      {state.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      {/* Basic Information */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="mb-5">
          <h2 className="text-base font-semibold text-slate-900">
            Laboratory Information
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Enter the basic details for this laboratory activity.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <div>
            <label
              htmlFor="lab_no"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Laboratory No.
            </label>

            <input
              id="lab_no"
              name="lab_no"
              type="number"
              min="1"
              step="1"
              defaultValue={nextLabNo}
              required
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="start_date"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Start Date
            </label>

            <input
              id="start_date"
              name="start_date"
              type="date"
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="due_date"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Due Date
            </label>

            <input
              id="due_date"
              name="due_date"
              type="date"
              className={inputClass}
            />
          </div>

          <div className="md:col-span-3">
            <label
              htmlFor="title"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Title
            </label>

            <input
              id="title"
              name="title"
              type="text"
              placeholder="e.g. Database Normalization"
              required
              className={inputClass}
            />
          </div>

          <div className="md:col-span-3">
            <label
              htmlFor="description"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Description
            </label>

            <textarea
              id="description"
              name="description"
              rows={4}
              placeholder="Optional instructions or notes..."
              className={`${inputClass} resize-none`}
            />
          </div>
        </div>
      </div>

      {/* Laboratory Type */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="mb-5">
          <h2 className="text-base font-semibold text-slate-900">
            Laboratory Type
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Choose whether students will work individually or in groups.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label
            className={`cursor-pointer rounded-xl border p-4 transition ${
              labType === "individual"
                ? "border-slate-900 bg-slate-50"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="lab_type"
                value="individual"
                checked={labType === "individual"}
                onChange={selectIndividualLaboratory}
                className="mt-1"
              />

              <div>
                <div className="font-medium text-slate-900">
                  Individual
                </div>

                <div className="mt-1 text-sm text-slate-500">
                  Each student receives their own laboratory score.
                </div>
              </div>
            </div>
          </label>

          <label
            className={`cursor-pointer rounded-xl border p-4 transition ${
              labType === "group"
                ? "border-slate-900 bg-slate-50"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="lab_type"
                value="group"
                checked={labType === "group"}
                onChange={() => setLabType("group")}
                className="mt-1"
              />

              <div>
                <div className="font-medium text-slate-900">
                  Group
                </div>

                <div className="mt-1 text-sm text-slate-500">
                  Students receive a shared group output score plus an
                  individual contribution score.
                </div>
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Scoring */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="mb-5">
          <h2 className="text-base font-semibold text-slate-900">
            Scoring
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Configure how many points this laboratory is worth.
          </p>
        </div>

        <div className="max-w-xl">
          <label
            htmlFor="total_points"
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            Total Points
          </label>

          <input
            id="total_points"
            name="total_points"
            type="number"
            min="1"
            step="0.01"
            value={totalPoints}
            onChange={(event) =>
              updateTotalPoints(event.target.value)
            }
            required
            className={`${inputClass} pr-14`}
          />
        </div>

        {labType === "group" && (
          <div className="mt-6 rounded-xl bg-slate-50 p-5">
            <h3 className="font-medium text-slate-900">
              Group Laboratory Breakdown
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              The two components must equal the total laboratory points.
            </p>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="group_points"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Group Output
                </label>

                <div className="relative">
                  <input
                    id="group_points"
                    name="group_points"
                    type="number"
                    min="0"
                    step="0.01"
                    value={groupPoints}
                    onChange={(event) =>
                      setGroupPoints(event.target.value)
                    }
                    required
                    className={`${inputClass} pr-14`}
                  />

                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                    pts
                  </span>
                </div>
              </div>

              <div>
                <label
                  htmlFor="individual_points"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Individual Contribution
                </label>

                <div className="relative">
                  <input
                    id="individual_points"
                    name="individual_points"
                    type="number"
                    min="0"
                    step="0.01"
                    value={individualPoints}
                    onChange={(event) =>
                      setIndividualPoints(event.target.value)
                    }
                    required
                    className={`${inputClass} pr-14`}
                  />

                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                    pts
                  </span>
                </div>
              </div>
            </div>

            <div
              className={`mt-5 flex items-center justify-between rounded-lg border px-4 py-3 text-sm ${
                Math.abs(remaining) < 0.0001
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

              {Math.abs(remaining) < 0.0001 ? (
                <span>Complete</span>
              ) : remaining > 0 ? (
                <span>{remaining} points remaining</span>
              ) : (
                <span>{Math.abs(remaining)} points over</span>
              )}
            </div>
          </div>
        )}

        {labType === "individual" && (
          <>
            <input
              type="hidden"
              name="group_points"
              value="0"
            />

            <input
              type="hidden"
              name="individual_points"
              value={totalPoints}
            />

            <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Each student will be graded out of{" "}
              <strong>{totalPoints || 0} points</strong>.
            </div>
          </>
        )}
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Link
          href={`/classes/${classId}/laboratories`}
          className="inline-flex w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:w-auto"
        >
          Cancel
        </Link>

        <SubmitButton />
      </div>
    </form>
  );
}
