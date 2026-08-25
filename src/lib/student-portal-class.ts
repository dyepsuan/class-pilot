import { cache } from "react";
import { cookies } from "next/headers";

import {
  getActiveStudentPortalClasses,
  type StudentPortalClass,
} from "@/lib/db/student-portal";

export const STUDENT_CLASS_COOKIE_NAME = "class_pilot_student_class";

export type StudentPortalContext = {
  classes: StudentPortalClass[];
  selectedClass: StudentPortalClass | null;
};

export const getStudentPortalContext = cache(
  async (authenticatedStudentId: number): Promise<StudentPortalContext> => {
    const classes = await getActiveStudentPortalClasses(authenticatedStudentId);

    if (classes.length === 0) {
      return {
        classes,
        selectedClass: null,
      };
    }

    const cookieStore = await cookies();
    const preferredClassId = Number(
      cookieStore.get(STUDENT_CLASS_COOKIE_NAME)?.value
    );
    const preferredClass = Number.isInteger(preferredClassId)
      ? classes.find((classItem) => classItem.id === preferredClassId)
      : undefined;

    return {
      classes,
      selectedClass: preferredClass ?? classes[0],
    };
  }
);
