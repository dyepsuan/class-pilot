"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { regenerateSelectedStudentQrs } from "@/app/classes/[classId]/students/qr-codes/actions";
import ConfirmationModal from "@/components/ConfirmationModal";
import StudentQrCard, {
  type StudentQrCardData,
} from "@/components/student-qr-card";
import StudentQrPdfButton from "@/components/student-qr-pdf-button";
import StudentQrZipButton from "@/components/student-qr-zip-button";

type StudentQrManagerProps = {
  classId: number;
  initialStudents: StudentQrCardData[];
  section: string;
};

export default function StudentQrManager({
  classId,
  initialStudents,
  section,
}: StudentQrManagerProps) {
  const router = useRouter();
  const [students, setStudents] = useState(initialStudents);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(
    () => new Set()
  );
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedStudents = students.filter((student) =>
    selectedIds.has(student.studentId)
  );
  const allSelected =
    students.length > 0 && selectedIds.size === students.length;
  const downloadsReady =
    selectedStudents.length > 0 &&
    selectedStudents.every((student) => Boolean(student.payload));

  function setStudentSelected(studentId: number, selected: boolean) {
    setError(null);
    setSuccess(null);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (selected) next.add(studentId);
      else next.delete(studentId);
      return next;
    });
  }

  function selectAll() {
    setError(null);
    setSuccess(null);
    setSelectedIds(new Set(students.map((student) => student.studentId)));
  }

  function clearSelection() {
    setError(null);
    setSuccess(null);
    setSelectedIds(new Set());
  }

  function regenerateSelected() {
    if (pending || selectedIds.size === 0) {
      return;
    }

    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await regenerateSelectedStudentQrs(
        classId,
        Array.from(selectedIds)
      );

      if (!result.success) {
        setError(result.error);
        return;
      }

      const payloads = new Map(
        result.students.map((student) => [student.studentId, student.payload])
      );
      setStudents((current) =>
        current.map((student) => {
          const payload = payloads.get(student.studentId);
          return payload
            ? { ...student, payload, error: null }
            : student;
        })
      );
      setConfirmationOpen(false);
      setSelectedIds(new Set());
      setSuccess(
        `QR codes regenerated for ${result.count} ${result.count === 1 ? "student" : "students"}.`
      );
      router.refresh();
    });
  }

  return (
    <>
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <p className="text-sm font-semibold text-slate-900">
              {students.length} QR {students.length === 1 ? "Code" : "Codes"}
            </p>
            <p
              className="text-sm font-semibold text-blue-700"
              aria-live="polite"
            >
              {selectedIds.size} Selected
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAll}
                disabled={pending || allSelected}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 sm:flex-none"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={clearSelection}
                disabled={pending || selectedIds.size === 0}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 sm:flex-none"
              >
                Clear
              </button>
            </div>

            <div className="grid gap-2 sm:flex">
              <StudentQrPdfButton
                students={selectedStudents}
                section={section}
                disabled={!downloadsReady || pending}
              />
              <StudentQrZipButton
                students={selectedStudents}
                section={section}
                disabled={!downloadsReady || pending}
              />
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setSuccess(null);
                  setConfirmationOpen(true);
                }}
                disabled={pending || selectedIds.size === 0}
                className="inline-flex w-full items-center justify-center rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
              >
                Regenerate Selected
              </button>
            </div>
          </div>
        </div>

        {selectedStudents.length > 0 && !downloadsReady && (
          <p className="mt-4 text-xs leading-5 text-amber-700">
            Deselect unavailable QR cards or regenerate them before downloading.
          </p>
        )}
      </section>

      {error && (
        <div
          role="alert"
          className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          aria-live="polite"
          className="mt-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
        >
          {success}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {students.map((student) => (
          <StudentQrCard
            key={student.studentId}
            student={student}
            selected={selectedIds.has(student.studentId)}
            selectionDisabled={pending}
            onSelectionChange={setStudentSelected}
          />
        ))}
      </div>

      <ConfirmationModal
        open={confirmationOpen}
        title="Regenerate selected QR codes?"
        description={
          <div className="space-y-3">
            <p>
              You are about to regenerate QR codes for{" "}
              <strong>
                {selectedIds.size}{" "}
                {selectedIds.size === 1 ? "student" : "students"}.
              </strong>
            </p>
            <p>
              The existing QR codes for the selected students will stop working
              immediately. Any previously printed or saved copies must be
              replaced.
            </p>
          </div>
        }
        confirmLabel="Regenerate QR Codes"
        pendingLabel="Regenerating..."
        pending={pending}
        variant="danger"
        onCancel={() => {
          if (!pending) setConfirmationOpen(false);
        }}
        onConfirm={regenerateSelected}
      />
    </>
  );
}
