import { NextRequest, NextResponse } from "next/server";

import {
  buildGoogleAuthorizationUrl,
  createPkceChallenge,
  generateOAuthSecret,
  getGmailConfiguration,
} from "@/lib/auth/google-oauth";
import {
  GOOGLE_OAUTH_FLOW_SECONDS,
  sanitizeGmailReturnTo,
  setGoogleOAuthFlowCookie,
} from "@/lib/auth/google-oauth-flow";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  const returnTo = sanitizeGmailReturnTo(request.nextUrl.searchParams.get("returnTo"));

  if (!user) {
    const login = new URL("/login", request.url);
    login.searchParams.set("returnTo", returnTo);
    return NextResponse.redirect(login);
  }

  if (user.role !== "INSTRUCTOR") {
    return NextResponse.redirect(new URL("/classes", request.url));
  }

  try {
    const config = getGmailConfiguration();
    const state = generateOAuthSecret();
    const verifier = generateOAuthSecret();
    const codeChallenge = await createPkceChallenge(verifier);

    await setGoogleOAuthFlowCookie({
      state,
      verifier,
      userId: user.id,
      returnTo,
      expiresAt: Date.now() + GOOGLE_OAUTH_FLOW_SECONDS * 1000,
    });

    return NextResponse.redirect(
      buildGoogleAuthorizationUrl({
        config,
        state,
        codeChallenge,
        loginHint: user.email,
      })
    );
  } catch {
    const target = new URL(returnTo, request.url);
    target.searchParams.set("gmail", "configuration-error");
    return NextResponse.redirect(target);
  }
}
