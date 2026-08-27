import Link from "next/link";
import { notFound } from "next/navigation";

import StudentQrManager from "@/components/student-qr-manager";
import { requireUser } from "@/lib/auth/session";
import { getInstructorStudentQrRoster } from "@/lib/student-qr-roster";

type StudentQrCodesPageProps = {
  params: Promise<{ classId: string }>;
};

export default async function StudentQrCodesPage({
  params,
}: StudentQrCodesPageProps) {
  const { classId } = await params;
  const id = Number(classId);

  if (!Number.isInteger(id) || id <= 0) {
    notFound();
  }

  const user = await requireUser();
  const roster = await getInstructorStudentQrRoster(id, user);

  if (!roster) {
    notFound();
  }

  const readyCount = roster.students.filter((student) => student.payload).length;
  const failedCount = roster.students.length - readyCount;

  return (
    <div>
      <Link
        href={`/classes/${id}/students`}
        className="inline-flex items-center text-sm font-medium text-slate-500 transition hover:text-slate-900"
      >
        <span aria-hidden="true">&larr;</span>
        <span className="ml-2">Back to Students</span>
      </Link>

      <div className="mt-5">
        <header>
          <p className="text-sm font-semibold text-blue-700">
            {roster.classItem.subject_code} &middot; {roster.classItem.section}
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            Student QR Codes
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            View and print attendance QR codes for active students in this class.
          </p>
        </header>

      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Active Students
          </p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">
            {roster.students.length}
          </p>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            QR Codes Ready
          </p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">
            {readyCount}
          </p>
        </section>
      </div>

      {failedCount > 0 && (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
        >
          {failedCount}{" "}
          {failedCount === 1
            ? "student's QR code is"
            : "student QR codes are"}{" "}
          unavailable. Unavailable cards cannot be downloaded until they are
          regenerated.
        </div>
      )}

      {roster.students.length === 0 ? (
        <section className="mt-6 rounded-xl border border-slate-200 bg-white px-5 py-12 text-center shadow-sm sm:px-8 sm:py-14">
          <div
            aria-hidden="true"
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-500"
          >
            QR
          </div>
          <h3 className="mt-4 text-base font-bold tracking-tight text-slate-950">
            No active students are available for QR generation.
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
            Add or restore students from the roster before generating QR cards.
          </p>
        </section>
      ) : (
        <StudentQrManager
          classId={id}
          initialStudents={roster.students}
          section={roster.classItem.section}
        />
      )}
    </div>
  );
}
