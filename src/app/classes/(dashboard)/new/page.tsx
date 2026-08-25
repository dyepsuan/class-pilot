import Link from "next/link";
import { getSchoolYearOptions } from "@/lib/classroom-time";
import AddClassForm from "./AddClassForm";

export default function NewClassPage() {
  const { schoolYears, defaultSchoolYear } = getSchoolYearOptions();

  return (
    <main className="min-h-screen bg-transparent">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8">
          <Link
            href="/classes"
            className="text-sm font-medium text-gray-500 hover:text-gray-900"
          >
            ← Back to Classes
          </Link>

          <h1 className="mt-4 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            Add Class
          </h1>

          <p className="mt-2 text-gray-600">
            Create a class for the current school term.
          </p>
        </div>

        <AddClassForm
          schoolYears={schoolYears}
          defaultSchoolYear={defaultSchoolYear}
        />
      </div>
    </main>
  );
}
