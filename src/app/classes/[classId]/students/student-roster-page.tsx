import Link from "next/link";
import { notFound } from "next/navigation";

import PendingSubmitButton from "@/components/pending-submit-button";
import StudentPortalPinAction from "@/components/student-portal-pin-action";
import { getStudentRosterByClassId } from "@/lib/db/student-roster";

import { addStudentToClass } from "./actions";

type StudentsPageProps = {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{
    imported?: string;
    view?: string;
    restored?: string;
  }>;
};

function getStudentName(student: {
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
}): string {
  const middleInitial = student.middle_name
    ? `${student.middle_name.charAt(0)}.`
    : "";

  return [
    student.last_name + ",",
    student.first_name,
    middleInitial,
    student.suffix,
  ]
    .filter(Boolean)
    .join(" ");
}

function formatRemovedDate(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
      ? `${value.replace(" ", "T")}Z`
      : value
  );

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(date);
}

function PortalStatus({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
        active
          ? "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-100"
          : "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200"
      }`}
    >
      Portal: {active ? "Active" : "Not activated"}
    </span>
  );
}

export default async function StudentRosterPage({
  params,
  searchParams,
}: StudentsPageProps) {
  const { classId } = await params;
  const { imported, view, restored } = await searchParams;
  const id = Number(classId);

  if (!Number.isInteger(id) || id <= 0) {
    notFound();
  }

  const isArchivedView = view === "archived";
  const students = await getStudentRosterByClassId(
    id,
    isArchivedView ? "archived" : "active"
  );
  const addStudentAction = addStudentToClass.bind(null, id);

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Students</h2>
          <p className="mt-1 text-sm text-gray-500">
            {isArchivedView
              ? `${students.length} archived ${students.length === 1 ? "student" : "students"}.`
              : `${students.length} active ${students.length === 1 ? "student" : "students"} enrolled.`}
          </p>
        </div>

        {!isArchivedView && (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Link
              href={`/classes/${id}/students/qr-codes`}
              className="inline-flex w-full items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 transition hover:bg-blue-100 sm:w-auto"
            >
              QR Codes
            </Link>
            <Link
              href={`/classes/${id}/students/setup-links`}
              className="inline-flex w-full items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 transition hover:bg-blue-100 sm:w-auto"
            >
              Setup Links
            </Link>
            <Link
              href={`/classes/${id}/students/import`}
              className="inline-flex w-full items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 sm:w-auto"
            >
              Import CSV
            </Link>
          </div>
        )}
      </div>

      {imported && !isArchivedView && (
        <div className="mt-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Processed {imported} {Number(imported) === 1 ? "student" : "students"}.
          Previously archived enrollments were restored automatically.
        </div>
      )}
      {restored && !isArchivedView && (
        <div className="mt-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Student restored to this class. Existing historical records were kept.
        </div>
      )}

      <nav
        aria-label="Student enrollment status"
        className="mt-6 inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1"
      >
        <Link
          href={`/classes/${id}/students`}
          aria-current={!isArchivedView ? "page" : undefined}
          className={`rounded-md px-4 py-2 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-gray-400 ${
            !isArchivedView
              ? "bg-white text-gray-950 shadow-sm"
              : "text-gray-500 hover:text-gray-900"
          }`}
        >
          Active
        </Link>
        <Link
          href={`/classes/${id}/students?view=archived`}
          aria-current={isArchivedView ? "page" : undefined}
          className={`rounded-md px-4 py-2 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-gray-400 ${
            isArchivedView
              ? "bg-white text-gray-950 shadow-sm"
              : "text-gray-500 hover:text-gray-900"
          }`}
        >
          Archived
        </Link>
      </nav>

      {!isArchivedView && (
        <details className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm">
          <summary className="cursor-pointer px-6 py-4 text-sm font-semibold text-gray-900">
            + Add Student
          </summary>
          <form action={addStudentAction} className="border-t border-gray-100 p-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="student_number" className="mb-2 block text-sm font-medium text-gray-700">
                  Student Number
                </label>
                <input id="student_number" name="student_number" type="text" required placeholder="e.g. 2026-01234" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-gray-500" />
              </div>
              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input id="email" name="email" type="email" placeholder="Optional" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-gray-500" />
              </div>
              <div>
                <label htmlFor="last_name" className="mb-2 block text-sm font-medium text-gray-700">
                  Last Name
                </label>
                <input id="last_name" name="last_name" type="text" required className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 outline-none transition focus:border-gray-500" />
              </div>
              <div>
                <label htmlFor="first_name" className="mb-2 block text-sm font-medium text-gray-700">
                  First Name
                </label>
                <input id="first_name" name="first_name" type="text" required className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 outline-none transition focus:border-gray-500" />
              </div>
              <div>
                <label htmlFor="middle_name" className="mb-2 block text-sm font-medium text-gray-700">
                  Middle Name
                </label>
                <input id="middle_name" name="middle_name" type="text" placeholder="Optional" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-gray-500" />
              </div>
              <div>
                <label htmlFor="suffix" className="mb-2 block text-sm font-medium text-gray-700">
                  Suffix
                </label>
                <input id="suffix" name="suffix" type="text" placeholder="e.g. Jr." className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-gray-500" />
              </div>
            </div>
            <div className="mt-6 flex justify-stretch sm:justify-end">
              <PendingSubmitButton pendingLabel="Adding..." className="w-full rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 sm:w-auto">
                Add Student
              </PendingSubmitButton>
            </div>
          </form>
        </details>
      )}

      <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {students.length === 0 ? (
          <div className="p-10 text-center sm:p-12">
            <h3 className="font-semibold text-gray-900">
              {isArchivedView ? "No archived students." : "No active students in this class."}
            </h3>
            {!isArchivedView && (
              <p className="mt-2 text-sm text-gray-500">
                Add a student or import your class roster.
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-100 md:hidden">
              {students.map((student) => {
                const studentName = getStudentName(student);
                const removedDate = formatRemovedDate(student.left_on);

                return (
                  <article key={student.enrollment_id} className="p-4 sm:p-5">
                    <Link
                      href={`/classes/${id}/students/${student.student_id}`}
                      className="break-words text-sm font-semibold text-gray-900 hover:text-gray-600"
                    >
                      {studentName}
                    </Link>
                    <p className="mt-1 break-words text-xs text-gray-500">
                      {student.student_number}
                      {student.email ? ` | ${student.email}` : ""}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${isArchivedView ? "bg-gray-100 text-gray-600" : "bg-green-100 text-green-700"}`}>
                        Enrollment: {isArchivedView ? "Archived" : "Active"}
                      </span>
                      <PortalStatus active={student.hasStudentPortalAccount} />
                    </div>
                    {isArchivedView && removedDate && (
                      <p className="mt-2 text-xs text-gray-500">Removed {removedDate}</p>
                    )}
                    <div className="mt-4 flex flex-wrap items-start gap-2">
                      <Link
                        href={`/classes/${id}/students/${student.student_id}/qr`}
                        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                      >
                        View QR
                      </Link>
                      {!isArchivedView && (
                        <StudentPortalPinAction
                          classId={id}
                          studentId={student.student_id}
                          studentName={studentName}
                          initialHasAccount={student.hasStudentPortalAccount}
                        />
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {['Student', 'Student Number', 'Email', 'Status', 'Actions'].map((heading) => (
                      <th key={heading} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {students.map((student) => {
                    const studentName = getStudentName(student);
                    const removedDate = formatRemovedDate(student.left_on);

                    return (
                      <tr key={student.enrollment_id} className="hover:bg-gray-50">
                        <td className="max-w-56 px-5 py-4">
                          <Link href={`/classes/${id}/students/${student.student_id}`} className="break-words text-sm font-medium text-gray-900 hover:text-gray-600">
                            {studentName}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">{student.student_number}</td>
                        <td className="max-w-48 break-words px-5 py-4 text-sm text-gray-600">{student.email ?? "Not provided"}</td>
                        <td className="px-5 py-4">
                          <div className="flex flex-col items-start gap-2">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${isArchivedView ? "bg-gray-100 text-gray-600" : "bg-green-100 text-green-700"}`}>
                              Enrollment: {isArchivedView ? "Archived" : "Active"}
                            </span>
                            <PortalStatus active={student.hasStudentPortalAccount} />
                            {isArchivedView && removedDate && <p className="text-xs text-gray-500">Removed {removedDate}</p>}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap items-start gap-2">
                            <Link href={`/classes/${id}/students/${student.student_id}/qr`} className="whitespace-nowrap rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50">
                              View QR
                            </Link>
                            {!isArchivedView && (
                              <StudentPortalPinAction
                                classId={id}
                                studentId={student.student_id}
                                studentName={studentName}
                                initialHasAccount={student.hasStudentPortalAccount}
                              />
                            )}
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
      </div>
    </div>
  );
}
