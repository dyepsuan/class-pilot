import Link from "next/link";
import { notFound } from "next/navigation";

import StudentQrCode from "@/components/student-qr-code";
import PendingSubmitButton from "@/components/pending-submit-button";

import {
  getActiveStudentQrPayload,
} from "@/lib/db/student-qr";

import {
  getStudentEnrollmentByStudentId,
} from "@/lib/db/students";

import {
  generateStudentQr,
} from "./actions";

type StudentQrPageProps = {
  params: Promise<{
    classId: string;
    studentId: string;
  }>;
};

export default async function StudentQrPage({
  params,
}: StudentQrPageProps) {
  const {
    classId,
    studentId,
  } = await params;

  const classIdNumber =
    Number(classId);

  const studentIdNumber =
    Number(studentId);

  if (
    !Number.isInteger(classIdNumber) ||
    !Number.isInteger(
      studentIdNumber
    )
  ) {
    notFound();
  }

  const student =
    await getStudentEnrollmentByStudentId(
      classIdNumber,
      studentIdNumber
    );

  if (!student) {
    notFound();
  }

  const qr =
    await getActiveStudentQrPayload(
      student.student_id
    );

  const fullName = [
    student.first_name,
    student.middle_name,
    student.last_name,
    student.suffix,
  ]
    .filter(Boolean)
    .join(" ");

  const generateAction =
    generateStudentQr.bind(
      null,
      classIdNumber,
      studentIdNumber
    );

  return (
    <div>
      <Link
        href={
          `/classes/${classIdNumber}/students`
        }
        className="text-sm font-medium text-gray-500 hover:text-gray-900"
      >
        ← Back to Students
      </Link>

      <div className="mt-6">
        <h2 className="text-xl font-semibold text-gray-900">
          Student QR
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          Attendance QR credential for
          this student.
        </p>
      </div>

      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="text-center">
          <h3 className="text-xl font-semibold text-gray-900">
            {fullName}
          </h3>

          <p className="mt-1 text-sm text-gray-500">
            {student.student_number}
          </p>
        </div>

        {qr ? (
          <div className="mt-8">
            <StudentQrCode
              payload={qr.payload}
              studentNumber={
                student.student_number
              }
            />

            <p className="mt-5 text-center text-xs text-gray-500">
              Present this QR code to the
              instructor during attendance.
            </p>
          </div>
        ) : (
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500">
              This student does not have a
              ClassPilot QR credential yet.
            </p>

            <form
              action={generateAction}
              className="mt-5"
            >
              <PendingSubmitButton
                pendingLabel="Generating..."
                className="w-full rounded-lg bg-blue-600 shadow-sm px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 sm:w-auto"
              >
                Generate QR
              </PendingSubmitButton>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
