import StudentQrCode from "@/components/student-qr-code";

export type StudentQrCardData = {
  studentId: number;
  studentName: string;
  studentNumber: string;
  section: string;
  subject: string;
  payload: string | null;
  error: string | null;
};

type StudentQrCardProps = {
  student: StudentQrCardData;
  selected?: boolean;
  selectionDisabled?: boolean;
  onSelectionChange?: (studentId: number, selected: boolean) => void;
};

export default function StudentQrCard({
  student,
  selected = false,
  selectionDisabled = false,
  onSelectionChange,
}: StudentQrCardProps) {
  return (
    <article
      className={`flex h-full flex-col overflow-hidden rounded-2xl border bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition ${selected ? "border-blue-300 ring-2 ring-blue-100" : "border-slate-200"}`}
    >
      <div
        className={`h-1 ${selected ? "bg-blue-700" : "bg-blue-600"}`}
        aria-hidden="true"
      />
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        {onSelectionChange && (
          <label className="mb-4 flex min-h-10 cursor-pointer items-center gap-3 self-start rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
            <input
              type="checkbox"
              checked={selected}
              disabled={selectionDisabled}
              onChange={(event) =>
                onSelectionChange(student.studentId, event.target.checked)
              }
              aria-label={`Select QR for ${student.studentName}`}
              className="h-5 w-5 rounded border-slate-300 accent-blue-600 disabled:cursor-not-allowed"
            />
            <span>{selected ? "Selected" : "Select student"}</span>
          </label>
        )}
        <div className="flex min-h-64 items-center justify-center rounded-xl bg-slate-50 p-3">
          {student.payload ? (
            <StudentQrCode
              payload={student.payload}
              studentNumber={student.studentNumber}
              allowDownload={false}
              accessibleLabel={`Attendance QR code for ${student.studentName}`}
              size={248}
            />
          ) : (
            <div className="px-4 text-center">
              <div
                aria-hidden="true"
                className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-sm font-bold text-red-600"
              >
                !
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-900">
                QR unavailable
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {student.error}
              </p>
            </div>
          )}
        </div>

        <div className="mt-5 text-center">
          <h2 className="break-words text-base font-bold tracking-tight text-slate-950">
            {student.studentName}
          </h2>
          <p className="mt-1 break-words text-sm font-medium text-slate-500">
            {student.studentNumber}
          </p>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-left">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Section
            </dt>
            <dd className="mt-1 break-words text-xs font-semibold text-slate-700">
              {student.section}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Subject
            </dt>
            <dd className="mt-1 break-words text-xs font-semibold text-slate-700">
              {student.subject}
            </dd>
          </div>
        </dl>

        <p className="mt-5 text-center text-[11px] font-bold uppercase tracking-[0.16em] text-blue-700">
          Attendance QR
        </p>
      </div>
    </article>
  );
}
