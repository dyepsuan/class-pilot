"use client";

import { useEffect, useRef, useState } from "react";
import type { ClassFileStudentViewDetail } from "@/lib/db/class-files";
import { formatPhilippineDateTime } from "@/lib/datetime";

export default function ClassFileViewDetails({ classId, fileId, title, viewedCount, activeStudentCount }: {
  classId: number; fileId: string; title: string; viewedCount: number; activeStudentCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [students, setStudents] = useState<ClassFileStudentViewDetail[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      if (dialogRef.current?.open) dialogRef.current.close();
      return;
    }
    if (!dialogRef.current?.open) dialogRef.current?.showModal();
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/classes/${classId}/class-files/${encodeURIComponent(fileId)}/views`, {
          cache: "no-store", signal: controller.signal,
        });
        const result = await response.json() as { students?: ClassFileStudentViewDetail[]; message?: string };
        if (!response.ok || !result.students) throw new Error(result.message || "Could not load view details.");
        if (!controller.signal.aborted) setStudents(result.students);
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Could not load view details.");
      }
    }
    void load();
    return () => controller.abort();
  }, [open, classId, fileId]);

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <>
      <button ref={triggerRef} type="button" onClick={() => { setStudents(null); setError(null); setOpen(true); }}
        aria-label={`View details for ${title}: ${viewedCount} of ${activeStudentCount} active students viewed`}
        className="mt-3 inline-flex rounded-lg px-1 py-2 text-xs font-semibold text-blue-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
        {viewedCount} / {activeStudentCount} viewed <span className="ml-2 font-normal">View details</span>
      </button>
      <dialog ref={dialogRef} aria-labelledby={`view-details-${fileId}`}
        onCancel={(event) => { event.preventDefault(); close(); }}
        onClose={() => { setOpen(false); triggerRef.current?.focus(); }}
        className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 shadow-xl backdrop:bg-black/40">
        {open && <>
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
            <div className="min-w-0">
              <h2 id={`view-details-${fileId}`} className="text-lg font-semibold text-slate-900">Class File view details</h2>
              <p className="mt-1 break-words text-sm text-slate-500">{title}</p>
              <p className="mt-2 text-xs text-slate-500">Current file · Active students only · Philippine time</p>
            </div>
            <button type="button" aria-label="Close view details" onClick={close}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">Close</button>
          </div>
          <div className="px-5 py-4">
            {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : students === null ? (
              <p role="status" className="text-sm text-slate-500">Loading view details…</p>
            ) : students.length === 0 ? <p className="text-sm text-slate-500">No active students in this class.</p> : (
              <ul className="divide-y divide-slate-100">
                {students.map((student) => (
                  <li key={student.studentId} className="grid min-w-0 gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_7rem_12rem] sm:items-start sm:gap-4">
                    <p className="break-words text-sm font-semibold text-slate-900">
                      {[`${student.lastName},`, student.firstName, student.middleName ? `${student.middleName.charAt(0)}.` : null, student.suffix].filter(Boolean).join(" ")}
                    </p>
                    <span className={`w-fit rounded-full px-2 py-1 text-xs font-semibold ${student.isViewed ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                      {student.isViewed ? "Viewed" : "Not viewed"}
                    </span>
                    <p className="text-xs leading-5 text-slate-500">
                      <span className="block font-medium text-slate-600">Last viewed</span>
                      {student.lastViewedAt ? formatPhilippineDateTime(student.lastViewedAt) : "—"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>}
      </dialog>
    </>
  );
}
