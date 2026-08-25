import AuthenticatedHeader from "@/components/authenticated-header";
import ClassNavigation from "@/components/class-navigation";
import { notFound } from "next/navigation";
import { getClassById } from "@/lib/db/classes";
import { formatMeetingSchedule } from "@/lib/class-meetings";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

function formatTerm(term: string) {
  switch (term) {
    case "1ST_SEMESTER":
      return "1st Semester";

    case "2ND_SEMESTER":
      return "2nd Semester";

    case "SUMMER":
      return "Summer";

    default:
      return term;
  }
}

type ClassLayoutProps = {
  children: ReactNode;

  params: Promise<{
    classId: string;
  }>;
};

export default async function ClassLayout({
  children,
  params,
}: ClassLayoutProps) {
  const { classId } = await params;

  const id = Number(classId);

  if (!Number.isInteger(id) || id <= 0) {
    notFound();
  }

  const classItem = await getClassById(id);

  if (!classItem) {
    notFound();
  }

  const schedule =
    formatMeetingSchedule(classItem.meetings, {
      compactDays: true,
      separator: ", ",
    }) || classItem.schedule_text;

  return (
    <>
      <AuthenticatedHeader mode="class" section={classItem.section} />
      <main className="min-h-screen bg-transparent">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          <div>
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
              <div>
                <p className="text-sm font-semibold text-blue-600">
                  {classItem.subject_code}
                </p>

                <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                  {classItem.subject_name}
                </h1>
              </div>

              <div className="text-sm text-slate-500 md:text-right">
                <p className="font-medium text-slate-600">
                  SY {classItem.school_year} • {formatTerm(classItem.term)}
                </p>

                {schedule && (
                  <p className="mt-1 max-w-xl md:ml-auto">{schedule}</p>
                )}
              </div>
            </div>
          </div>

          <ClassNavigation
            classId={classItem.id}
          />

          <div className="py-6 sm:py-8">{children}</div>
        </div>
      </main>
    </>
  );
}
