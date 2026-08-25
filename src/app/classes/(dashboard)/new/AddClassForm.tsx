"use client";

import Link from "next/link";
import { useActionState, useState, type FormEvent } from "react";

import ClassScheduleEditor, {
  type ScheduleEditorBlock,
} from "@/components/class-schedule-editor";
import PendingSubmitButton from "@/components/pending-submit-button";
import { validateMeetingBlocks } from "@/lib/class-meetings";
import { createClass, type CreateClassState } from "../../actions";

const initialActionState: CreateClassState = { error: null };
const initialMeetings: ScheduleEditorBlock[] = [
  { key: "meeting-1", weekdays: [], start_time: "", end_time: "" },
];

type AddClassFormProps = {
  schoolYears: Array<{ value: string; label: string }>;
  defaultSchoolYear: string;
};

const inputClasses =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 placeholder:text-gray-500 outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-gray-200";

export default function AddClassForm({ schoolYears, defaultSchoolYear }: AddClassFormProps) {
  const [state, formAction] = useActionState(createClass, initialActionState);
  const [meetings, setMeetings] = useState(initialMeetings);
  const [showScheduleErrors, setShowScheduleErrors] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const validation = validateMeetingBlocks(meetings);
    if (validation.valid) return;

    event.preventDefault();

    const form = event.currentTarget;

    setShowScheduleErrors(true);

    requestAnimationFrame(() => {
      form
        .querySelector<HTMLElement>("[data-schedule-error='true']")
        ?.focus();
    });
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
      {state.error && (
        <div role="alert" className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {state.error}
        </div>
      )}

      <section aria-labelledby="class-information-heading">
        <h2 id="class-information-heading" className="text-base font-semibold text-gray-950">
          Class Information
        </h2>
        <div className="mt-5 space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="subject_code" className="block text-sm font-medium text-gray-700">Course Code</label>
              <input id="subject_code" name="subject_code" required placeholder="e.g. IS 106" className={`mt-2 ${inputClasses}`} />
            </div>
            <div>
              <label htmlFor="section" className="block text-sm font-medium text-gray-700">Section</label>
              <input id="section" name="section" required placeholder="e.g. BSIS 3C" className={`mt-2 ${inputClasses}`} />
            </div>
          </div>

          <div>
            <label htmlFor="subject_name" className="block text-sm font-medium text-gray-700">Subject</label>
            <input id="subject_name" name="subject_name" required placeholder="e.g. Information Systems Project Management" className={`mt-2 ${inputClasses}`} />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="school_year" className="block text-sm font-medium text-gray-700">School Year</label>
              <select id="school_year" name="school_year" required defaultValue={defaultSchoolYear} className={`mt-2 ${inputClasses}`}>
                {schoolYears.map((schoolYear) => (
                  <option key={schoolYear.value} value={schoolYear.value}>{schoolYear.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="term" className="block text-sm font-medium text-gray-700">Semester</label>
              <select id="term" name="term" required defaultValue="1ST_SEMESTER" className={`mt-2 ${inputClasses}`}>
                <option value="1ST_SEMESTER">1st Semester</option>
                <option value="2ND_SEMESTER">2nd Semester</option>
                <option value="SUMMER">Summer</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 border-t border-gray-100 pt-7" aria-labelledby="meeting-schedule-heading">
        <h2 id="meeting-schedule-heading" className="text-base font-semibold text-gray-950">Meeting Schedule</h2>
        <p className="mt-1 text-sm text-gray-600">Group weekdays that share a time, or add another block for a different time.</p>
        <div className="mt-5">
          <ClassScheduleEditor meetings={meetings} onChange={setMeetings} showErrors={showScheduleErrors} />
        </div>
      </section>

      <div className="mt-8 flex flex-col-reverse gap-3 border-t border-gray-100 pt-6 sm:flex-row sm:items-center sm:justify-end">
        <Link href="/classes" className="inline-flex w-full items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 active:translate-y-px sm:w-auto">
          Cancel
        </Link>
        <PendingSubmitButton pendingLabel="Creating..." className="w-full rounded-lg bg-blue-600 shadow-sm px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 active:translate-y-px sm:w-auto">
          Create Class
        </PendingSubmitButton>
      </div>
    </form>
  );
}
