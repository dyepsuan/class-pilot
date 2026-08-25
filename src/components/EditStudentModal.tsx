"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import {
  updateStudent,
  type UpdateStudentState,
  type UpdateStudentValues,
} from "@/app/classes/[classId]/students/actions";

type EditStudentModalProps = {
  classId: number;
  studentId: number;
  student: UpdateStudentValues;
};

type EditStudentFormProps = EditStudentModalProps & {
  onCancel: () => void;
  onPendingChange: (pending: boolean) => void;
  onSaved: (student: UpdateStudentValues) => void;
};

const initialState: UpdateStudentState = {};

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-gray-200 aria-[invalid=true]:border-red-400 aria-[invalid=true]:focus:ring-red-100";

function FieldError({
  id,
  message,
}: {
  id: string;
  message?: string;
}) {
  if (!message) {
    return null;
  }

  return (
    <p id={id} className="mt-1.5 text-xs text-red-600">
      {message}
    </p>
  );
}

function EditStudentForm({
  classId,
  studentId,
  student,
  onCancel,
  onPendingChange,
  onSaved,
}: EditStudentFormProps) {
  const updateAction = updateStudent.bind(
    null,
    classId,
    studentId
  );

  async function updateAndClose(
    previousState: UpdateStudentState,
    formData: FormData
  ): Promise<UpdateStudentState> {
    onPendingChange(true);

    try {
      const result = await updateAction(
        previousState,
        formData
      );

      if (result.success && result.student) {
        onSaved(result.student);
      }

      return result;
    } finally {
      onPendingChange(false);
    }
  }

  const [state, formAction, pending] = useActionState(
    updateAndClose,
    initialState
  );

  return (
    <form action={formAction} className="flex min-h-0 flex-1 flex-col">
      <div className="overflow-y-auto px-5 py-5 sm:px-6">
        {state.error && (
          <div
            role="alert"
            className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {state.error}
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label
              htmlFor="edit_student_number"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Student Number
            </label>
            <input
              id="edit_student_number"
              name="student_number"
              type="text"
              required
              autoFocus
              defaultValue={student.student_number}
              aria-invalid={Boolean(state.fieldErrors?.student_number)}
              aria-describedby={
                state.fieldErrors?.student_number
                  ? "edit_student_number_error"
                  : undefined
              }
              className={inputClass}
            />
            <FieldError
              id="edit_student_number_error"
              message={state.fieldErrors?.student_number}
            />
          </div>

          <div>
            <label
              htmlFor="edit_student_email"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Email
            </label>
            <input
              id="edit_student_email"
              name="email"
              type="email"
              defaultValue={student.email ?? ""}
              placeholder="Optional"
              aria-invalid={Boolean(state.fieldErrors?.email)}
              aria-describedby={
                state.fieldErrors?.email
                  ? "edit_student_email_error"
                  : undefined
              }
              className={inputClass}
            />
            <FieldError
              id="edit_student_email_error"
              message={state.fieldErrors?.email}
            />
          </div>

          <div>
            <label
              htmlFor="edit_student_first_name"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              First Name
            </label>
            <input
              id="edit_student_first_name"
              name="first_name"
              type="text"
              required
              defaultValue={student.first_name}
              aria-invalid={Boolean(state.fieldErrors?.first_name)}
              aria-describedby={
                state.fieldErrors?.first_name
                  ? "edit_student_first_name_error"
                  : undefined
              }
              className={inputClass}
            />
            <FieldError
              id="edit_student_first_name_error"
              message={state.fieldErrors?.first_name}
            />
          </div>

          <div>
            <label
              htmlFor="edit_student_last_name"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Last Name
            </label>
            <input
              id="edit_student_last_name"
              name="last_name"
              type="text"
              required
              defaultValue={student.last_name}
              aria-invalid={Boolean(state.fieldErrors?.last_name)}
              aria-describedby={
                state.fieldErrors?.last_name
                  ? "edit_student_last_name_error"
                  : undefined
              }
              className={inputClass}
            />
            <FieldError
              id="edit_student_last_name_error"
              message={state.fieldErrors?.last_name}
            />
          </div>

          <div>
            <label
              htmlFor="edit_student_middle_name"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Middle Name
            </label>
            <input
              id="edit_student_middle_name"
              name="middle_name"
              type="text"
              defaultValue={student.middle_name ?? ""}
              placeholder="Optional"
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="edit_student_suffix"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Suffix
            </label>
            <input
              id="edit_student_suffix"
              name="suffix"
              type="text"
              defaultValue={student.suffix ?? ""}
              placeholder="e.g. Jr."
              className={inputClass}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-gray-200 bg-gray-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
        <button
          type="button"
          disabled={pending}
          onClick={onCancel}
          className="w-full rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-blue-600 shadow-sm px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {pending ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </form>
  );
}

export default function EditStudentModal({
  classId,
  studentId,
  student,
}: EditStudentModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [latestStudent, setLatestStudent] =
    useState(student);

  const closeModal = useCallback(() => {
    if (!pending) {
      setOpen(false);
    }
  }, [pending]);

  const handleSaved = useCallback(
    (updatedStudent: UpdateStudentValues) => {
      setLatestStudent(updatedStudent);
      setPending(false);
      setOpen(false);
      router.refresh();
    },
    [router]
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeModal();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, closeModal]);

  function openModal() {
    setPending(false);
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 sm:w-auto"
      >
        Edit Student
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close edit student modal"
            disabled={pending}
            onClick={closeModal}
            className="absolute inset-0 bg-black/40 disabled:cursor-wait"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-student-title"
            aria-describedby="edit-student-description"
            className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4 sm:px-6 sm:py-5">
              <div>
                <h2
                  id="edit-student-title"
                  className="text-lg font-semibold text-gray-900"
                >
                  Edit Student
                </h2>
                <p
                  id="edit-student-description"
                  className="mt-1 text-sm text-gray-500"
                >
                  Update this student&apos;s information.
                </p>
              </div>

              <button
                type="button"
                aria-label="Close"
                disabled={pending}
                onClick={closeModal}
                className="shrink-0 rounded-lg px-2 py-1 text-xl leading-none text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span aria-hidden="true">&times;</span>
              </button>
            </div>

            <EditStudentForm
              classId={classId}
              studentId={studentId}
              student={latestStudent}
              onCancel={closeModal}
              onPendingChange={setPending}
              onSaved={handleSaved}
            />
          </div>
        </div>
      )}
    </>
  );
}
