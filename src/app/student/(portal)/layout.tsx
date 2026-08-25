import type { ReactNode } from "react";

import StudentClassSwitcher from "@/components/student-class-switcher";
import StudentHeader from "@/components/student-header";
import { requireStudent } from "@/lib/auth/student-session";
import { getStudentPortalContext } from "@/lib/student-portal-class";

export const dynamic = "force-dynamic";

export default async function StudentPortalLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const student = await requireStudent();
  const { classes, selectedClass } = await getStudentPortalContext(student.id);

  return (
    <>
      <StudentHeader student={student} />
      <main className="min-h-[calc(100dvh-7rem)]">
        <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-9">
          {selectedClass && (
            <StudentClassSwitcher
              classes={classes}
              selectedClass={selectedClass}
            />
          )}
          <div className={selectedClass ? "mt-6" : ""}>{children}</div>
        </div>
      </main>
    </>
  );
}
