import "server-only";

import {
  getInstructorManagedClass,
  type InstructorManagedClass,
} from "@/lib/auth/instructor-class";
import type { AuthUser } from "@/lib/auth/session";
import { getOrIssueActiveStudentQrPayload } from "@/lib/db/student-qr";
import { getStudentsByClassId } from "@/lib/db/students";

export type InstructorStudentQrItem = {
  studentId: number;
  studentName: string;
  studentNumber: string;
  section: string;
  subject: string;
  payload: string | null;
  error: string | null;
};

export type InstructorStudentQrRoster = {
  classItem: InstructorManagedClass;
  students: InstructorStudentQrItem[];
};

function formatStudentName(student: {
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
}): string {
  return [student.first_name, student.middle_name, student.last_name, student.suffix]
    .filter(Boolean)
    .join(" ");
}

export async function getInstructorStudentQrRoster(
  classId: number,
  user: AuthUser
): Promise<InstructorStudentQrRoster | null> {
  const classItem = await getInstructorManagedClass(classId, user);

  if (!classItem) {
    return null;
  }

  const activeStudents = await getStudentsByClassId(classId, "active");
  const subject = classItem.subject_code
    ? `${classItem.subject_code} - ${classItem.subject_name}`
    : classItem.subject_name;

  const students = await Promise.all(
    activeStudents.map(async (student): Promise<InstructorStudentQrItem> => {
      const baseItem = {
        studentId: student.student_id,
        studentName: formatStudentName(student),
        studentNumber: student.student_number,
        section: classItem.section,
        subject,
      };

      try {
        const qr = await getOrIssueActiveStudentQrPayload(student.student_id);

        return {
          ...baseItem,
          payload: qr.payload,
          error: null,
        };
      } catch (error) {
        console.error(
          `Could not prepare QR credential for student ${student.student_id}.`,
          error
        );

        return {
          ...baseItem,
          payload: null,
          error: "QR generation failed for this student.",
        };
      }
    })
  );

  return { classItem, students };
}
