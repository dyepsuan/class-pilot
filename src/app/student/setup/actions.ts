"use server";

import { revalidatePath } from "next/cache";

import { hashStudentPin } from "@/lib/auth/student-pin";
import { hashStudentSetupToken } from "@/lib/auth/student-setup-token";
import {
  isStudentSetupTokenShapeValid,
  isValidStudentSetupPin,
} from "@/lib/auth/student-setup-validation";
import {
  completeInitialStudentSetup,
  resolveInitialStudentSetupToken,
} from "@/lib/db/student-account-setup";
import type { StudentSetupUnavailableState } from "@/lib/student-setup-types";

export type StudentSetupActionState =
  | { status: "idle" }
  | {
      status: "error";
      message: string;
      fieldErrors?: {
        pin?: string;
        confirmPin?: string;
      };
    }
  | { status: "link-error"; linkState: StudentSetupUnavailableState }
  | { status: "success" };


function toLinkErrorState(
  state: StudentSetupUnavailableState
): StudentSetupActionState {
  return { status: "link-error", linkState: state };
}

export async function completeStudentSetup(
  rawToken: string,
  _previousState: StudentSetupActionState,
  formData: FormData
): Promise<StudentSetupActionState> {
  if (!isStudentSetupTokenShapeValid(rawToken)) {
    return toLinkErrorState("INVALID");
  }

  const pinValue = formData.get("pin");
  const confirmPinValue = formData.get("confirm_pin");
  const pin = typeof pinValue === "string" ? pinValue : "";
  const confirmPin =
    typeof confirmPinValue === "string" ? confirmPinValue : "";
  const fieldErrors: { pin?: string; confirmPin?: string } = {};

  if (!isValidStudentSetupPin(pin)) {
    fieldErrors.pin = "Enter exactly 6 numeric digits.";
  }

  if (!isValidStudentSetupPin(confirmPin)) {
    fieldErrors.confirmPin = "Re-enter the same 6-digit PIN.";
  } else if (pin !== confirmPin) {
    fieldErrors.confirmPin = "The PINs do not match.";
  }

  if (fieldErrors.pin || fieldErrors.confirmPin) {
    return {
      status: "error",
      message: "Check the highlighted PIN fields.",
      fieldErrors,
    };
  }

  try {
    const tokenHash = await hashStudentSetupToken(rawToken);
    const resolution = await resolveInitialStudentSetupToken(tokenHash);

    if (resolution.state !== "VALID") {
      return toLinkErrorState(resolution.state);
    }

    const pinHash = await hashStudentPin(pin);
    const result = await completeInitialStudentSetup({
      tokenHash,
      pinHash,
      completedAt: new Date().toISOString(),
    });

    if (!result.success) {
      if (result.state === "ERROR") {
        return {
          status: "error",
          message: "Account setup is unavailable right now. Please try again.",
        };
      }

      return toLinkErrorState(result.state);
    }

    revalidatePath(`/classes/${resolution.classId}/students`);
    revalidatePath(`/classes/${resolution.classId}/students/setup-links`);
    return { status: "success" };
  } catch {
    return {
      status: "error",
      message: "Account setup is unavailable right now. Please try again.",
    };
  }
}
