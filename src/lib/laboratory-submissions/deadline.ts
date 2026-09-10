import "server-only";

import { CLASSROOM_TIME_ZONE } from "@/lib/classroom-time";

export type LaboratorySubmissionTiming = "ON_TIME" | "LATE";

function getManilaCalendarDate(timestamp: string | Date): string | null {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: CLASSROOM_TIME_ZONE,
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  const year = value("year");
  const month = value("month");
  const day = value("day");
  return year && month && day ? `${year}-${month}-${day}` : null;
}

export function getLaboratorySubmissionTiming(
  submittedAt: string | Date,
  dueDate: string | null
): LaboratorySubmissionTiming | null {
  if (!dueDate) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(dueDate)) {
    throw new TypeError("Laboratory due date must use YYYY-MM-DD format.");
  }
  const submittedDate = getManilaCalendarDate(submittedAt);
  if (!submittedDate) throw new TypeError("Submission timestamp is invalid.");

  // Laboratory deadlines are dates, not times. Treat the due date as inclusive
  // in the existing classroom time zone instead of inventing a cutoff hour.
  return submittedDate <= dueDate ? "ON_TIME" : "LATE";
}
