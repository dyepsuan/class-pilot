import Link from "next/link";
import { notFound } from "next/navigation";

import {
  createAttendanceSession,
} from "../actions";
import PendingSubmitButton from "@/components/pending-submit-button";

type NewAttendancePageProps = {
  params: Promise<{
    classId: string;
  }>;
};

export default async function NewAttendancePage({
  params,
}: NewAttendancePageProps) {
  const { classId } =
    await params;

  const id =
    Number(classId);

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    notFound();
  }

  const createAction =
    createAttendanceSession.bind(
      null,
      id
    );

  const today =
    new Date()
      .toISOString()
      .slice(0, 10);

  return (
    <div>
      <Link
        href={
          `/classes/${id}/attendance`
        }
        className="text-sm font-medium text-gray-500 hover:text-gray-900"
      >
        ← Back to Attendance
      </Link>

      <div className="mt-6">
        <h2 className="text-xl font-semibold text-gray-900">
          Start Attendance
        </h2>

        <p className="mt-2 text-sm text-gray-500">
          Create an attendance session
          before scanning student QR codes.
        </p>
      </div>

      <form
        action={createAction}
        className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <div className="space-y-6">
          <div>
            <label
              htmlFor="session_date"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Date
            </label>

            <input
              id="session_date"
              name="session_date"
              type="date"
              required
              defaultValue={today}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-gray-500"
            />
          </div>

          <div>
            <label
              htmlFor="meeting_no"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Meeting Number
            </label>

            <input
              id="meeting_no"
              name="meeting_no"
              type="number"
              min="1"
              required
              defaultValue="1"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-gray-500"
            />
          </div>

          <div>
            <label
              htmlFor="topic"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Topic
            </label>

            <input
              id="topic"
              name="topic"
              type="text"
              placeholder="Optional"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-gray-500"
            />
          </div>
        </div>

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link
            href={
              `/classes/${id}/attendance`
            }
            className="inline-flex w-full items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 sm:w-auto"
          >
            Cancel
          </Link>

          <PendingSubmitButton
            pendingLabel="Starting..."
            className="w-full rounded-lg bg-blue-600 shadow-sm px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 sm:w-auto"
          >
            Start Scanner
          </PendingSubmitButton>
        </div>
      </form>
    </div>
  );
}
