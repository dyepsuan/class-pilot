"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useActionState,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";

import StudentPortalPinAction from "@/components/student-portal-pin-action";
import type { StudentRosterItem } from "@/lib/db/student-roster";
import {
  addStudentFromModal,
  importStudentsFromModal,
  type AddStudentState,
  type ImportStudentsState,
} from "@/app/classes/[classId]/students/actions";

type SortOption =
  | "last-asc"
  | "last-desc"
  | "first-asc"
  | "first-desc"
  | "number-asc"
  | "number-desc";

type ModalView = "add" | "import";

type StudentRosterManagerProps = {
  classId: number;
  section: string;
  students: StudentRosterItem[];
};

const sortOptions: Array<{ value: SortOption; label: string }> = [
  { value: "last-asc", label: "Last Name — A to Z" },
  { value: "last-desc", label: "Last Name — Z to A" },
  { value: "first-asc", label: "First Name — A to Z" },
  { value: "first-desc", label: "First Name — Z to A" },
  { value: "number-asc", label: "Student Number — Ascending" },
  { value: "number-desc", label: "Student Number — Descending" },
];

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 aria-[invalid=true]:border-red-400 aria-[invalid=true]:focus:ring-red-100";

function normalizeSearchValue(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-PH");
}

function getStudentName(student: StudentRosterItem) {
  const middleInitial = student.middle_name
    ? `${student.middle_name.charAt(0)}.`
    : "";

  return [
    `${student.last_name},`,
    student.first_name,
    middleInitial,
    student.suffix,
  ]
    .filter(Boolean)
    .join(" ");
}

function getStudentSearchValue(student: StudentRosterItem) {
  return normalizeSearchValue(
    [
      student.student_number,
      student.first_name,
      student.middle_name,
      student.last_name,
      student.suffix,
      student.email,
      `${student.first_name} ${student.last_name}`,
      `${student.first_name} ${student.middle_name ?? ""} ${student.last_name}`,
      `${student.last_name} ${student.first_name}`,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function PortalStatus({
  active,
  className = "",
}: {
  active: boolean;
  className?: string;
}) {
  return (
    <span
      className={`mt-1.5 inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
        active
          ? "bg-blue-50 text-blue-700 ring-blue-100"
          : "bg-slate-50 text-slate-500 ring-slate-200"
      } ${className}`}
    >
      Portal: {active ? "Active" : "Not activated"}
    </span>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-4 w-4">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function SortIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
      <path d="M8 5v14m0 0-3-3m3 3 3-3M16 19V5m0 0-3 3m3-3 3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={`h-5 w-5 transition-transform duration-200 ${
        expanded ? "rotate-180" : ""
      }`}
    >
      <path
        d="m6.5 9 5.5 5.5L17.5 9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="mt-1.5 text-xs text-red-600">
      {message}
    </p>
  ) : null;
}

function AddStudentForm({
  classId,
  onCancel,
  onImport,
  onPendingChange,
  onSuccess,
}: {
  classId: number;
  onCancel: () => void;
  onImport: () => void;
  onPendingChange: (pending: boolean) => void;
  onSuccess: (state: AddStudentState) => void;
}) {
  const action = addStudentFromModal.bind(null, classId);
  const [state, formAction, pending] = useActionState(action, {});

  useEffect(() => onPendingChange(pending), [onPendingChange, pending]);

  useEffect(() => {
    if (state.success) {
      onSuccess(state);
    }
  }, [onSuccess, state]);

  return (
    <form action={formAction} className="flex min-h-0 flex-1 flex-col">
      <div className="overflow-y-auto px-5 py-5 sm:px-6">
        {state.error && (
          <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {state.error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="add_student_number" className="mb-1.5 block text-sm font-medium text-slate-700">
              Student Number
            </label>
            <input
              id="add_student_number"
              name="student_number"
              type="text"
              required
              data-dialog-initial-focus
              placeholder="e.g. 2026-01234"
              aria-invalid={Boolean(state.fieldErrors?.student_number)}
              aria-describedby={state.fieldErrors?.student_number ? "add_student_number_error" : undefined}
              className={inputClass}
            />
            <FieldError id="add_student_number_error" message={state.fieldErrors?.student_number} />
          </div>

          <div>
            <label htmlFor="add_student_email" className="mb-1.5 block text-sm font-medium text-slate-700">
              Email
            </label>
            <input id="add_student_email" name="email" type="email" placeholder="Optional" className={inputClass} />
          </div>

          <div>
            <label htmlFor="add_student_last_name" className="mb-1.5 block text-sm font-medium text-slate-700">
              Last Name
            </label>
            <input
              id="add_student_last_name"
              name="last_name"
              type="text"
              required
              aria-invalid={Boolean(state.fieldErrors?.last_name)}
              aria-describedby={state.fieldErrors?.last_name ? "add_student_last_name_error" : undefined}
              className={inputClass}
            />
            <FieldError id="add_student_last_name_error" message={state.fieldErrors?.last_name} />
          </div>

          <div>
            <label htmlFor="add_student_first_name" className="mb-1.5 block text-sm font-medium text-slate-700">
              First Name
            </label>
            <input
              id="add_student_first_name"
              name="first_name"
              type="text"
              required
              aria-invalid={Boolean(state.fieldErrors?.first_name)}
              aria-describedby={state.fieldErrors?.first_name ? "add_student_first_name_error" : undefined}
              className={inputClass}
            />
            <FieldError id="add_student_first_name_error" message={state.fieldErrors?.first_name} />
          </div>

          <div>
            <label htmlFor="add_student_middle_name" className="mb-1.5 block text-sm font-medium text-slate-700">
              Middle Name
            </label>
            <input id="add_student_middle_name" name="middle_name" type="text" placeholder="Optional" className={inputClass} />
          </div>

          <div>
            <label htmlFor="add_student_suffix" className="mb-1.5 block text-sm font-medium text-slate-700">
              Suffix
            </label>
            <input id="add_student_suffix" name="suffix" type="text" placeholder="e.g. Jr." className={inputClass} />
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-4 border-t border-slate-100 pt-5">
          <div>
            <p className="text-sm font-medium text-slate-800">Have multiple students?</p>
            <p className="mt-0.5 hidden text-xs text-slate-500 sm:block">Add a complete roster from a CSV file.</p>
          </div>
          <button
            type="button"
            onClick={onImport}
            className="shrink-0 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            Import CSV
          </button>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
        <button type="button" disabled={pending} onClick={onCancel} className="w-full rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
          Cancel
        </button>
        <button type="submit" disabled={pending} className="w-full rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
          {pending ? "Adding..." : "Add Student"}
        </button>
      </div>
    </form>
  );
}

function ImportStudentsForm({
  classId,
  onBack,
  onCancel,
  onPendingChange,
  onSuccess,
}: {
  classId: number;
  onBack: () => void;
  onCancel: () => void;
  onPendingChange: (pending: boolean) => void;
  onSuccess: (state: ImportStudentsState) => void;
}) {
  const action = importStudentsFromModal.bind(null, classId);
  const [state, formAction, pending] = useActionState(action, {});

  useEffect(() => onPendingChange(pending), [onPendingChange, pending]);

  useEffect(() => {
    if (state.success) {
      onSuccess(state);
    }
  }, [onSuccess, state]);

  return (
    <form action={formAction} className="flex min-h-0 flex-1 flex-col">
      <div className="overflow-y-auto px-5 py-5 sm:px-6">
        {state.error && (
          <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {state.error}
          </div>
        )}

        <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-inset ring-slate-200">
          <p className="text-sm font-semibold text-slate-900">CSV format</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Required: <span className="font-medium text-slate-800">student_number, last_name, first_name</span>
          </p>
          <p className="text-sm leading-6 text-slate-600">
            Optional: <span className="font-medium text-slate-800">middle_name, email, suffix</span>
          </p>
          <div className="mt-3 overflow-x-auto rounded-lg bg-white p-3 ring-1 ring-inset ring-slate-200">
            <code className="whitespace-nowrap text-xs text-slate-600">
              student_number,last_name,first_name,middle_name,email,suffix
            </code>
          </div>
        </div>

        <div className="mt-5">
          <label htmlFor="student_csv_file" className="block text-sm font-medium text-slate-700">
            CSV File
          </label>
          <input
            id="student_csv_file"
            name="file"
            type="file"
            accept=".csv,text/csv"
            required
            data-dialog-initial-focus
            className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          />
          <p className="mt-2 text-xs text-slate-500">Maximum 200 students and 1 MB per CSV file.</p>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-between sm:px-6">
        <button type="button" disabled={pending} onClick={onBack} className="w-full rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-200/70 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
          ← Back to Add Student
        </button>
        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          <button type="button" disabled={pending} onClick={onCancel} className="w-full rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
            Cancel
          </button>
          <button type="submit" disabled={pending} className="w-full rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
            {pending ? "Importing..." : "Import Students"}
          </button>
        </div>
      </div>
    </form>
  );
}

function StudentModal({
  classId,
  section,
  open,
  view,
  openerRef,
  onViewChange,
  onClose,
  onCompleted,
}: {
  classId: number;
  section: string;
  open: boolean;
  view: ModalView;
  openerRef: RefObject<HTMLButtonElement | null>;
  onViewChange: (view: ModalView) => void;
  onClose: () => void;
  onCompleted: (message: string) => void;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const titleId = useId();
  const descriptionId = useId();

  const closeSafely = useCallback(() => {
    if (!pending) {
      onClose();
    }
  }, [onClose, pending]);

  const handleAddSuccess = useCallback(
    (state: AddStudentState) => {
      onCompleted(
        state.restored
          ? "Student restored to this class. Existing historical records were kept."
          : "Student added to this class."
      );
      onClose();
      router.refresh();
    },
    [onClose, onCompleted, router]
  );

  const handleImportSuccess = useCallback(
    (state: ImportStudentsState) => {
      const count = state.importedCount ?? 0;
      onCompleted(`Processed ${count} ${count === 1 ? "student" : "students"}. Previously archived enrollments were restored automatically.`);
      onClose();
      router.refresh();
    },
    [onClose, onCompleted, router]
  );

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const focusTimer = window.setTimeout(() => {
      dialogRef.current
        ?.querySelector<HTMLElement>("[data-dialog-initial-focus]")
        ?.focus();
    }, 0);

    return () => window.clearTimeout(focusTimer);
  }, [open, view]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const opener = openerRef.current;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !pendingRef.current) {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        ) ?? []
      );

      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      opener?.focus();
    };
  }, [open, onClose, openerRef]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <button type="button" aria-label="Close student dialog" disabled={pending} onClick={closeSafely} className="absolute inset-0 bg-slate-950/45 backdrop-blur-[1px] disabled:cursor-wait" />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative z-10 flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.22)] sm:max-h-[90dvh]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6 sm:py-5">
          <div>
            <h2 id={titleId} className="text-lg font-semibold tracking-tight text-slate-950">
              {view === "add" ? "Add Student" : "Import Students"}
            </h2>
            <p id={descriptionId} className="mt-1 text-sm text-slate-500">
              {view === "add" ? `Add a student to ${section}` : `Import a CSV roster into ${section}`}
            </p>
          </div>
          <button type="button" aria-label="Close" disabled={pending} onClick={closeSafely} className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xl leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50">
            <span aria-hidden="true">×</span>
          </button>
        </div>

        {view === "add" ? (
          <AddStudentForm classId={classId} onCancel={closeSafely} onImport={() => onViewChange("import")} onPendingChange={setPending} onSuccess={handleAddSuccess} />
        ) : (
          <ImportStudentsForm classId={classId} onBack={() => onViewChange("add")} onCancel={closeSafely} onPendingChange={setPending} onSuccess={handleImportSuccess} />
        )}
      </div>
    </div>
  );
}

export default function StudentRosterManager({
  classId,
  section,
  students,
}: StudentRosterManagerProps) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortOption>("last-asc");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalView, setModalView] = useState<ModalView>("add");
  const [notice, setNotice] = useState<string | null>(null);
  const [expandedStudentId, setExpandedStudentId] = useState<number | null>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const closeModal = useCallback(() => setModalOpen(false), []);

  const visibleStudents = useMemo(() => {
    const normalizedQuery = normalizeSearchValue(query);
    const filtered = normalizedQuery
      ? students.filter((student) =>
          getStudentSearchValue(student).includes(normalizedQuery)
        )
      : [...students];
    const collator = new Intl.Collator("en-PH", {
      numeric: true,
      sensitivity: "base",
    });
    const direction = sort.endsWith("desc") ? -1 : 1;

    return [...filtered].sort((left, right) => {
      let comparison = 0;

      if (sort.startsWith("last")) {
        comparison = collator.compare(left.last_name, right.last_name);
      } else if (sort.startsWith("first")) {
        comparison = collator.compare(left.first_name, right.first_name);
      } else {
        comparison = collator.compare(left.student_number, right.student_number);
      }

      if (comparison !== 0) {
        return comparison * direction;
      }

      return (
        collator.compare(left.last_name, right.last_name) ||
        collator.compare(left.first_name, right.first_name) ||
        collator.compare(left.student_number, right.student_number)
      );
    });
  }, [query, sort, students]);

  function openModal() {
    setModalView("add");
    setModalOpen(true);
  }

  return (
    <>
      {notice && (
        <div role="status" className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      )}

      <section aria-label="Active student roster" className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex min-w-0 items-center gap-2 border-b border-slate-200 p-3 sm:gap-3 sm:p-4">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search students</span>
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
              <SearchIcon />
            </span>
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setExpandedStudentId(null);
              }}
              placeholder="Search students..."
              className="h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label title="Sort students" className="relative flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 sm:w-auto sm:min-w-24 sm:gap-2 sm:px-3.5">
            <SortIcon />
            <span className="hidden text-sm font-medium sm:inline">Sort</span>
            <select
              aria-label="Sort students"
              title="Sort students"
              value={sort}
              onChange={(event) => setSort(event.target.value as SortOption)}
              className="absolute inset-0 cursor-pointer opacity-0"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <button
            ref={addButtonRef}
            type="button"
            aria-label="Add student"
            title="Add student"
            onClick={openModal}
            className="flex h-11 w-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:translate-y-px sm:w-auto sm:px-4"
          >
            <PlusIcon />
            <span className="hidden text-sm font-semibold sm:inline">Add Student</span>
          </button>
        </div>

        {students.length === 0 ? (
          <div className="px-5 py-12 text-center sm:px-8 sm:py-14">
            <h3 className="font-semibold text-slate-900">No active students in this class.</h3>
            <p className="mt-2 text-sm text-slate-500">Add a student or import your class roster.</p>
          </div>
        ) : visibleStudents.length === 0 ? (
          <div className="px-5 py-12 text-center sm:px-8 sm:py-14">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
              <SearchIcon />
            </div>
            <h3 className="mt-4 font-semibold text-slate-900">No students found</h3>
            <p className="mt-1.5 text-sm text-slate-500">Try another name, student number, or email.</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-100 md:hidden">
              {visibleStudents.map((student) => {
                const studentName = getStudentName(student);
                const expanded = expandedStudentId === student.student_id;
                const detailsId = `mobile-student-details-${student.student_id}`;

                return (
                  <article key={student.enrollment_id}>
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-controls={detailsId}
                      aria-label={`${expanded ? "Collapse" : "Expand"} details for ${studentName}`}
                      onClick={() =>
                        setExpandedStudentId((current) =>
                          current === student.student_id ? null : student.student_id
                        )
                      }
                      className="w-full px-4 py-3.5 text-left transition hover:bg-slate-50 active:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 sm:px-5 sm:py-4"
                    >
                      <span className="flex min-w-0 items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate text-sm font-semibold text-slate-900">
                          {studentName}
                        </span>
                        <span className="shrink-0 text-xs font-medium text-slate-500 [font-variant-numeric:tabular-nums]">
                          {student.student_number}
                        </span>
                      </span>
                      <span className="mt-2 flex items-center justify-between gap-3">
                        <PortalStatus
                          active={student.hasStudentPortalAccount}
                          className="mt-0"
                        />
                        <span className="shrink-0 text-slate-400">
                          <ChevronIcon expanded={expanded} />
                        </span>
                      </span>
                    </button>

                    {expanded && (
                      <div
                        id={detailsId}
                        className="border-t border-slate-100 bg-slate-50/70 px-4 py-4 sm:px-5"
                      >
                        <p className="text-sm leading-6 text-slate-600 [overflow-wrap:anywhere]">
                          <span className="font-semibold text-slate-700">Email:</span>{" "}
                          {student.email ? (
                            <a
                              href={`mailto:${student.email}`}
                              className="text-slate-700 underline decoration-slate-300 underline-offset-2 transition hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            >
                              {student.email}
                            </a>
                          ) : (
                            <span className="text-slate-500">Not provided</span>
                          )}
                        </p>

                        <div className="mt-3 grid grid-cols-3 gap-2 [&>*]:min-w-0 [&>*]:w-full [&>div]:h-full [&>div>button]:h-full [&>div>button]:min-h-11 [&>div>button]:w-full [&>div>button]:whitespace-normal [&>div>button]:px-2 [&>div>button]:leading-tight">
                            <Link
                              href={`/classes/${classId}/students/${student.student_id}`}
                              className="flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-2 py-2 text-center text-xs font-semibold leading-tight text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            >
                              View Profile
                            </Link>
                            <Link
                              href={`/classes/${classId}/students/${student.student_id}/qr`}
                              className="flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-2 py-2 text-center text-xs font-semibold leading-tight text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            >
                              View QR
                            </Link>
                            <StudentPortalPinAction
                              classId={classId}
                              studentId={student.student_id}
                              studentName={studentName}
                              initialHasAccount={student.hasStudentPortalAccount}
                            />
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50/80">
                  <tr>
                    {["Student", "Student Number", "Email", "Actions"].map((heading) => (
                      <th key={heading} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleStudents.map((student) => {
                    const studentName = getStudentName(student);

                    return (
                      <tr key={student.enrollment_id} className="transition hover:bg-slate-50/80">
                        <td className="max-w-60 px-5 py-4">
                          <Link href={`/classes/${classId}/students/${student.student_id}`} className="break-words text-sm font-medium text-slate-900 transition hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                            {studentName}
                          </Link>
                          <div><PortalStatus active={student.hasStudentPortalAccount} /></div>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600 [font-variant-numeric:tabular-nums]">{student.student_number}</td>
                        <td className="max-w-52 break-words px-5 py-4 text-sm text-slate-600">{student.email ?? "Not provided"}</td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap items-start gap-2">
                            <Link href={`/classes/${classId}/students/${student.student_id}/qr`} className="whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                              View QR
                            </Link>
                            <StudentPortalPinAction classId={classId} studentId={student.student_id} studentName={studentName} initialHasAccount={student.hasStudentPortalAccount} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <StudentModal
        classId={classId}
        section={section}
        open={modalOpen}
        view={modalView}
        openerRef={addButtonRef}
        onViewChange={setModalView}
        onClose={closeModal}
        onCompleted={setNotice}
      />
    </>
  );
}
