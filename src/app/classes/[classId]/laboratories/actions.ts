"use server";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/session";

export type CreateLaboratoryState = {
  error?: string;
};

export async function createLaboratory(
  classId: string,
  _previousState: CreateLaboratoryState,
  formData: FormData
): Promise<CreateLaboratoryState> {
  await requireUser();

  const numericClassId = Number(classId);

  const labNo = Number(formData.get("lab_no"));
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  const labType = String(formData.get("lab_type") ?? "individual");

  const totalPoints = Number(formData.get("total_points"));
  const dueDateValue = String(formData.get("due_date") ?? "").trim();
  const dueDate = dueDateValue || null;
  const startDateValue = String(
  formData.get("start_date") ?? ""
  ).trim();

  const startDate = startDateValue || null;

  if (
    startDate &&
    dueDate &&
    dueDate < startDate
  ) {
    return {
      error: "Due date cannot be earlier than the start date.",
    };
  }

  if (!Number.isInteger(numericClassId) || numericClassId <= 0) {
    return {
      error: "Invalid class.",
    };
  }

  if (!Number.isInteger(labNo) || labNo <= 0) {
    return {
      error: "Laboratory number must be a positive whole number.",
    };
  }

  if (!title) {
    return {
      error: "Laboratory title is required.",
    };
  }

  if (!Number.isFinite(totalPoints) || totalPoints <= 0) {
    return {
      error: "Total points must be greater than 0.",
    };
  }

  if (labType !== "individual" && labType !== "group") {
    return {
      error: "Invalid laboratory type.",
    };
  }

  let groupPoints = 0;
  let individualPoints = totalPoints;

  if (labType === "group") {
    groupPoints = Number(formData.get("group_points"));
    individualPoints = Number(formData.get("individual_points"));

    if (!Number.isFinite(groupPoints) || groupPoints < 0) {
      return {
        error: "Group output points must be 0 or greater.",
      };
    }

    if (!Number.isFinite(individualPoints) || individualPoints < 0) {
      return {
        error: "Individual contribution points must be 0 or greater.",
      };
    }

    const allocatedPoints = groupPoints + individualPoints;

    if (Math.abs(allocatedPoints - totalPoints) > 0.0001) {
      return {
        error:
          "Group output points and individual contribution points must equal the total points.",
      };
    }
  }

  const { env } = getCloudflareContext();

  const existingLaboratory = await env.DB.prepare(
    `
      SELECT id
      FROM laboratories
      WHERE class_id = ?
        AND lab_no = ?
      LIMIT 1
    `
  )
    .bind(numericClassId, labNo)
    .first<{ id: number }>();

  if (existingLaboratory) {
    return {
      error: `Laboratory ${labNo} already exists for this class.`,
    };
  }

  try {
    await env.DB.prepare(
      `
        INSERT INTO laboratories (
          class_id,
          lab_no,
          title,
          description,
          lab_type,
          total_points,
          group_points,
          individual_points,
          start_date,
          due_date,
          status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')
      `
    )
      .bind(
        numericClassId,
        labNo,
        title,
        description || null,
        labType,
        totalPoints,
        groupPoints,
        individualPoints,
        startDate,
        dueDate
      )
      .run();
  } catch (error) {
    console.error("Failed to create laboratory:", error);

    if (
      error instanceof Error &&
      error.message.includes("UNIQUE constraint")
    ) {
      return {
        error: `Laboratory ${labNo} already exists for this class.`,
      };
    }

    return {
      error: "Could not create laboratory. Please try again.",
    };
  }

  revalidatePath(`/classes/${classId}/laboratories`);

  redirect(`/classes/${classId}/laboratories`);
}
