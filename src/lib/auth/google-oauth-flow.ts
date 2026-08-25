import "server-only";

import { cookies } from "next/headers";

export const GOOGLE_OAUTH_FLOW_COOKIE = "class_pilot_google_oauth";
export const GOOGLE_OAUTH_FLOW_SECONDS = 10 * 60;

export type GoogleOAuthFlow = {
  state: string;
  verifier: string;
  userId: number;
  returnTo: string;
  expiresAt: number;
};

function encode(value: GoogleOAuthFlow): string {
  return btoa(JSON.stringify(value))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function decode(value: string): GoogleOAuthFlow | null {
  try {
    const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const parsed = JSON.parse(atob(padded)) as Partial<GoogleOAuthFlow>;
    if (
      typeof parsed.state !== "string" ||
      typeof parsed.verifier !== "string" ||
      typeof parsed.userId !== "number" ||
      typeof parsed.returnTo !== "string" ||
      typeof parsed.expiresAt !== "number"
    ) {
      return null;
    }
    return parsed as GoogleOAuthFlow;
  } catch {
    return null;
  }
}

export async function setGoogleOAuthFlowCookie(
  flow: GoogleOAuthFlow
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(GOOGLE_OAUTH_FLOW_COOKIE, encode(flow), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/integrations/gmail",
    maxAge: GOOGLE_OAUTH_FLOW_SECONDS,
    expires: new Date(flow.expiresAt),
  });
}

export async function takeGoogleOAuthFlowCookie(): Promise<GoogleOAuthFlow | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(GOOGLE_OAUTH_FLOW_COOKIE)?.value;
  cookieStore.set(GOOGLE_OAUTH_FLOW_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/integrations/gmail",
    maxAge: 0,
    expires: new Date(0),
  });
  return value && value.length <= 2048 ? decode(value) : null;
}

export function sanitizeGmailReturnTo(value: string | null): string {
  if (value && /^\/classes\/\d+\/students\/setup-links$/u.test(value)) {
    return value;
  }
  return "/classes";
}
