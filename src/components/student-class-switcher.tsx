"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { selectStudentPortalClass } from "@/app/student/(portal)/class-actions";
import type { StudentPortalClass } from "@/lib/db/student-portal";

function ClassSelect({
  classes,
  selectedClassId,
}: {
  classes: StudentPortalClass[];
  selectedClassId: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedValue, setSelectedValue] = useState(
    String(selectedClassId)
  );

  function switchClass(nextValue: string) {
    const authoritativeValue = String(selectedClassId);
    setSelectedValue(nextValue);

    startTransition(async () => {
      const formData = new FormData();
      formData.set("classId", nextValue);

      try {
        const switched = await selectStudentPortalClass(formData);

        if (!switched) {
          setSelectedValue(authoritativeValue);
          return;
        }

        router.refresh();
      } catch {
        setSelectedValue(authoritativeValue);
      }
    });
  }

  return (
    <div className="w-full sm:w-auto">
      <label
        htmlFor="student-class-select"
        className="block text-xs font-semibold text-slate-500 sm:text-right"
      >
        Switch class
      </label>
      <select
        id="student-class-select"
        name="classId"
        value={selectedValue}
        disabled={pending}
        onChange={(event) => switchClass(event.currentTarget.value)}
        className="mt-1 w-full max-w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:cursor-wait disabled:opacity-60 sm:w-72"
      >
        {classes.map((classItem) => (
          <option key={classItem.enrollment_id} value={classItem.id}>
            {classItem.subject_code}: {classItem.subject_name} ({classItem.section})
          </option>
        ))}
      </select>
      {pending && (
        <p className="mt-1 text-xs text-blue-700 sm:text-right" role="status">
          Switching class...
        </p>
      )}
    </div>
  );
}

export default function StudentClassSwitcher({
  classes,
  selectedClass,
}: {
  classes: StudentPortalClass[];
  selectedClass: StudentPortalClass;
}) {
  return (
    <section
      aria-label="Current student portal class"
      className="flex flex-col gap-3 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
    >
      <div className="min-w-0">
        <p className="text-xs font-semibold text-blue-700">Current class</p>
        <p className="mt-0.5 break-words text-sm font-bold text-slate-950">
          {selectedClass.subject_code}: {selectedClass.subject_name}
        </p>
        <p className="mt-0.5 break-words text-xs text-slate-600">
          {selectedClass.section} | SY {selectedClass.school_year}
        </p>
      </div>

      {classes.length > 1 && (
        <div className="w-full sm:w-auto">
          <ClassSelect
            key={selectedClass.id}
            classes={classes}
            selectedClassId={selectedClass.id}
          />
        </div>
      )}
    </section>
  );
}
