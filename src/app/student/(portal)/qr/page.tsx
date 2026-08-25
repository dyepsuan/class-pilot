import StudentQrCode from "@/components/student-qr-code";
import { requireStudent } from "@/lib/auth/student-session";
import { getStudentPortalQrData } from "@/lib/db/student-portal";
import { getStudentPortalContext } from "@/lib/student-portal-class";

function formatStudentName(student: {
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
}): string {
  return [student.firstName, student.middleName, student.lastName, student.suffix]
    .filter(Boolean)
    .join(" ");
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="mt-7 overflow-hidden rounded-xl border border-slate-200 bg-white px-5 py-12 text-center sm:px-8 sm:py-14">
      <div
        aria-hidden="true"
        className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-500"
      >
        QR
      </div>
      <h2 className="mt-4 text-base font-bold tracking-tight text-slate-950">
        {title}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        {description}
      </p>
    </section>
  );
}

export default async function StudentQrPage() {
  const authenticatedStudent = await requireStudent();
  const { selectedClass } = await getStudentPortalContext(
    authenticatedStudent.id
  );
  const qrData = selectedClass
    ? await getStudentPortalQrData(authenticatedStudent.id, selectedClass)
    : null;

  if (!qrData) {
    return (
      <div className="w-full">
        <header>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            My QR
          </h1>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Show this QR to your instructor when attendance is being recorded.
          </p>
        </header>
        <EmptyState
          title="No active class found"
          description="You are not currently enrolled in an active class."
        />
      </div>
    );
  }

  const studentName = formatStudentName(authenticatedStudent);
  const { classItem, payload } = qrData;

  return (
    <div className="w-full">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
          My QR
        </h1>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Show this QR to your instructor when attendance is being recorded.
        </p>
      </header>

      <section
        aria-labelledby="student-information-heading"
        className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white"
      >
        <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
          <h2
            id="student-information-heading"
            className="text-base font-bold tracking-tight text-slate-950"
          >
            Student information
          </h2>
        </div>
        <dl className="grid gap-x-8 gap-y-5 px-5 py-5 sm:grid-cols-2 sm:px-6">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Full name
            </dt>
            <dd className="mt-1 break-words text-sm font-semibold text-slate-900">
              {studentName}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Student number
            </dt>
            <dd className="mt-1 break-words text-sm font-semibold text-slate-900">
              {authenticatedStudent.studentNumber}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Current class
            </dt>
            <dd className="mt-1 break-words text-sm font-semibold text-slate-900">
              {classItem.subject_name}
            </dd>
          </div>
          {classItem.subject_code && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Class code
              </dt>
              <dd className="mt-1 break-words text-sm font-semibold text-slate-900">
                {classItem.subject_code}
              </dd>
            </div>
          )}
        </dl>
      </section>

      {payload ? (
        <section
          aria-labelledby="attendance-qr-heading"
          className="mt-6 overflow-hidden rounded-xl border border-blue-100 bg-white shadow-[0_12px_32px_rgba(30,64,175,0.05)]"
        >
          <div className="h-1 bg-blue-600" aria-hidden="true" />
          <div className="px-4 py-7 text-center sm:px-8 sm:py-9">
            <h2
              id="attendance-qr-heading"
              className="text-lg font-bold tracking-tight text-slate-950"
            >
              Attendance QR
            </h2>
            <div className="mt-5">
              <StudentQrCode
                payload={payload}
                studentNumber={authenticatedStudent.studentNumber}
                allowDownload={false}
                accessibleLabel={`Attendance QR code for ${studentName}`}
              />
            </div>
            <p className="mt-5 text-sm font-semibold text-slate-900">
              Show this QR to your instructor for attendance.
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Keep the QR fully visible while it is being scanned.
            </p>
          </div>
        </section>
      ) : (
        <EmptyState
          title="QR unavailable"
          description="Your attendance QR has not been generated yet. Please contact your instructor."
        />
      )}
    </div>
  );
}
