"use server";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import {
  formatMeetingSchedule,
  parseMeetingBlocks,
  validateMeetingBlocks,
} from "@/lib/class-meetings";

export type CreateClassState = { error: string | null };

function getRequiredString(formData: FormData, name: string) {
  const value = formData.get(name);

  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${name} is required.`);
  }

  return value.trim();
}

export async function createClass(
  _previousState: CreateClassState,
  formData: FormData
): Promise<CreateClassState> {
  await requireUser();

  let subjectCode: string;
  let subjectName: string;
  let section: string;
  let schoolYear: string;
  let term: string;

  try {
    subjectCode = getRequiredString(formData, "subject_code");
    subjectName = getRequiredString(formData, "subject_name");
    section = getRequiredString(formData, "section");
    schoolYear = getRequiredString(formData, "school_year");
    term = getRequiredString(formData, "term");
  } catch {
    return { error: "Complete all class information fields." };
  }

  const allowedTerms = [
    "1ST_SEMESTER",
    "2ND_SEMESTER",
    "SUMMER",
  ];

  if (!allowedTerms.includes(term)) {
    return { error: "Select a valid semester." };
  }

  const schoolYearMatch = /^(\d{4})-(\d{4})$/.exec(schoolYear);
  if (
    !schoolYearMatch ||
    Number(schoolYearMatch[2]) !== Number(schoolYearMatch[1]) + 1
  ) {
    return { error: "Select a valid school year." };
  }

  const blocks = parseMeetingBlocks(formData.get("meetings"));
  if (!blocks) {
    return { error: "Add a valid meeting schedule." };
  }

  const scheduleValidation = validateMeetingBlocks(blocks);
  if (!scheduleValidation.valid) {
    const firstError = scheduleValidation.blockErrors
      .flatMap((errors) => Object.values(errors))
      .find(Boolean);
    return { error: firstError ?? "Review the meeting schedule and try again." };
  }

  const scheduleText = formatMeetingSchedule(scheduleValidation.meetings);

  const { env } = getCloudflareContext();

  // V1 only has one instructor.
  // Later, this will come from the authenticated user's account.
  const instructor = await env.DB.prepare(
    `
      SELECT id
      FROM users
      ORDER BY id ASC
      LIMIT 1
    `
  ).first<{ id: number }>();

  if (!instructor) {
    return {
      error:
        "No instructor account exists. Create an instructor before adding a class.",
    };
  }

  const insertClass = env.DB.prepare(
    `
      INSERT INTO classes (
        instructor_id,
        subject_code,
        subject_name,
        section,
        school_year,
        term,
        schedule_text
      )
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
    `
  )
    .bind(
      instructor.id,
      subjectCode,
      subjectName,
      section,
      schoolYear,
      term,
      scheduleText
    );

  const insertMeetings = scheduleValidation.meetings.map(
    (meeting, position) =>
      env.DB.prepare(
        `
          INSERT INTO class_meetings (
            class_id, weekday, start_time, end_time, position
          )
          SELECT id, ?1, ?2, ?3, ?4
          FROM classes
          WHERE instructor_id = ?5
            AND subject_code = ?6
            AND section = ?7
            AND school_year = ?8
            AND term = ?9
          LIMIT 1
        `
      ).bind(
        meeting.weekday,
        meeting.start_time,
        meeting.end_time,
        position,
        instructor.id,
        subjectCode,
        section,
        schoolYear,
        term
      )
  );

  try {
    // D1 batches are transactional, so class and meeting writes roll back together.
    await env.DB.batch([insertClass, ...insertMeetings]);
  } catch {
    return {
      error:
        "The class could not be created. Check for an existing matching class and try again.",
    };
  }

  revalidatePath("/classes");

  redirect("/classes");
}
