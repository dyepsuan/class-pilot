"use server";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { redirect } from "next/navigation";

import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";

export type LoginState = {
  error: string | null;
};

type LoginUserRow = {
  auth_id: string | null;
  password_hash: string | null;
};
type LoginStage =
  | "database-lookup"
  | "password-verification"
  | "session-creation";


export async function login(
  _previousState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const emailValue = formData.get("email");
  const passwordValue = formData.get("password");

  if (
    typeof emailValue !== "string" ||
    typeof passwordValue !== "string" ||
    emailValue.trim() === "" ||
    passwordValue === ""
  ) {
    return { error: "Enter your email and password." };
  }

  const email = emailValue.trim().toLowerCase();
  const rememberMe = formData.get("remember") === "on";
  let user: LoginUserRow | null;

  let stage: LoginStage = "database-lookup";
  try {
    const { env } = getCloudflareContext();
    user = await env.DB.prepare(
      `
        SELECT auth_id, password_hash
        FROM users
        WHERE email = ?1 COLLATE NOCASE
        LIMIT 1
      `
    )
      .bind(email)
      .first<LoginUserRow>();

    stage = "password-verification";

    if (
      !user?.auth_id ||
      !user.password_hash ||
      !(await verifyPassword(passwordValue, user.password_hash))
    ) {
      return { error: "Invalid email or password." };
    }

    stage = "session-creation";

    await createSession(user.auth_id, rememberMe);
  } catch (error) {
    console.error("[ClassPilot login failure]", {
      stage,
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return {
      error: "Unable to sign in right now. Please try again.",
    };
  }

  redirect("/classes");
}
