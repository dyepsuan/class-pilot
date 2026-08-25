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

    if (
      !user?.auth_id ||
      !user.password_hash ||
      !(await verifyPassword(passwordValue, user.password_hash))
    ) {
      return { error: "Invalid email or password." };
    }

    await createSession(user.auth_id, rememberMe);
  } catch {
    console.error("[ClassPilot login] Authentication is currently unavailable.");
    return {
      error: "Unable to sign in right now. Please try again.",
    };
  }

  redirect("/classes");
}
