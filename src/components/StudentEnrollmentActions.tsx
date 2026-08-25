"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import ConfirmationModal from "@/components/ConfirmationModal";
import {
  archiveStudentEnrollment,
  restoreStudentEnrollment,
} from "@/app/classes/[classId]/students/actions";

type StudentEnrollmentActionsProps = {
  classId: number;
  studentId: number;
  studentName: string;
  archived: boolean;
};

export default function StudentEnrollmentActions({
  classId,
  studentId,
  studentName,
  archived,
}: StudentEnrollmentActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError(null);

    startTransition(async () => {
      const result = archived
        ? await restoreStudentEnrollment(classId, studentId)
        : await archiveStudentEnrollment(classId, studentId);

      if (result.error) {
        setError(result.error);
        return;
      }

      setOpen(false);
      router.push(
        `/classes/${classId}/students?view=${archived ? "active" : "archived"}`
      );
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className={
          archived
            ? "inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
            : "inline-flex items-center justify-center rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
        }
      >
        {archived ? "Restore to Class" : "Remove from Class"}
      </button>

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <ConfirmationModal
        open={open}
        title={
          archived
            ? "Restore student to class?"
            : "Remove student from class?"
        }
        description={
          archived
            ? "This student will become active in the class again. Their existing historical records will remain unchanged."
            : `${studentName} will be removed from this class. Their attendance, quiz scores, laboratory scores, and other historical records will be kept.`
        }
        confirmLabel={archived ? "Restore Student" : "Remove from Class"}
        pendingLabel={archived ? "Restoring..." : "Removing..."}
        variant={archived ? "default" : "danger"}
        pending={pending}
        onConfirm={confirm}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
