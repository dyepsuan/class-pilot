import Link from "next/link";
import { notFound } from "next/navigation";
import { importStudentsFromCsv } from "../actions";
import PendingSubmitButton from "@/components/pending-submit-button";

type ImportStudentsPageProps = {
  params: Promise<{
    classId: string;
  }>;
};

export default async function ImportStudentsPage({
  params,
}: ImportStudentsPageProps) {
  const { classId } = await params;

  const id = Number(classId);

  if (!Number.isInteger(id) || id <= 0) {
    notFound();
  }

  const importAction =
    importStudentsFromCsv.bind(null, id);

  return (
    <div>
      <Link
        href={`/classes/${id}/students`}
        className="text-sm font-medium text-gray-500 hover:text-gray-900"
      >
        ← Back to Students
      </Link>

      <div className="mt-6">
        <h2 className="text-xl font-semibold text-gray-900">
          Import Students
        </h2>

        <p className="mt-2 text-sm text-gray-500">
          Upload a CSV roster to add multiple
          students to this class.
        </p>
      </div>

      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="font-semibold text-gray-900">
          CSV Format
        </h3>

        <p className="mt-2 text-sm text-gray-500">
          The first row must contain the column
          names shown below.
        </p>

        <div className="mt-4 overflow-x-auto rounded-lg bg-gray-50 p-4">
          <pre className="text-sm text-gray-700">
{`student_number,last_name,first_name,middle_name,email,suffix
2026-0004,Cruz,Ana,Maria,ana@example.com,
2026-0005,Ramos,Carlo,,carlo@example.com,
2026-0006,Santos,John,Reyes,john@example.com,Jr.`}
          </pre>
        </div>

        <div className="mt-4 text-sm text-gray-500">
          Required columns:
          <span className="ml-1 font-medium text-gray-700">
            student_number, last_name,
            first_name
          </span>
        </div>

        <div className="mt-1 text-sm text-gray-500">
          Optional columns:
          <span className="ml-1 font-medium text-gray-700">
            middle_name, email, suffix
          </span>
        </div>
      </div>

      <form
        action={importAction}
        className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <label
          htmlFor="file"
          className="block text-sm font-medium text-gray-700"
        >
          CSV File
        </label>

        <input
          id="file"
          name="file"
          type="file"
          accept=".csv,text/csv"
          required
          className="mt-3 block w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
        />

        <p className="mt-2 text-xs text-gray-500">
          Export your Excel roster as CSV before
          uploading.
        </p>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link
            href={`/classes/${id}/students`}
            className="inline-flex w-full items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 sm:w-auto"
          >
            Cancel
          </Link>

          <PendingSubmitButton
            pendingLabel="Importing..."
            className="w-full rounded-lg bg-blue-600 shadow-sm px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 sm:w-auto"
          >
            Import Students
          </PendingSubmitButton>
        </div>
      </form>
    </div>
  );
}
