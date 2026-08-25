import { NextRequest, NextResponse } from "next/server";

import {
  constantTimeStringEqual,
  exchangeGoogleAuthorizationCode,
  getGmailConfiguration,
  GoogleOAuthError,
  getGoogleUserInfo,
  GOOGLE_GMAIL_SEND_SCOPE,
} from "@/lib/auth/google-oauth";
import { takeGoogleOAuthFlowCookie } from "@/lib/auth/google-oauth-flow";
import { getCurrentUser } from "@/lib/auth/session";
import { encryptGoogleRefreshToken } from "@/lib/auth/token-encryption";
import {
  getInstructorGoogleConnection,
  saveInstructorGoogleConnection,
} from "@/lib/db/instructor-google-connections";

function callbackRedirect(request: NextRequest, path: string, status: string) {
  const target = new URL(path, request.url);
  target.searchParams.set("gmail", status);
  return NextResponse.redirect(target);
}
type GmailOAuthCallbackStatus =
  | "oauth-state-error"
  | "pkce-error"
  | "token-exchange-error"
  | "missing-refresh-token"
  | "identity-error"
  | "encryption-error"
  | "database-error"
  | "authorization-error"
  | "scope-error";

function callbackFailure(
  request: NextRequest,
  path: string,
  status: GmailOAuthCallbackStatus,
  stage: string,
  error?: unknown
) {
  console.error("Gmail OAuth callback failed", {
    stage,
    errorName: error instanceof Error ? error.name : "UnknownError",
    providerError:
      error instanceof GoogleOAuthError ? error.providerError : undefined,
  });
  return callbackRedirect(request, path, status);
}

function isValidPkceVerifier(value: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/u.test(value);
}


export async function GET(request: NextRequest) {
  const flow = await takeGoogleOAuthFlowCookie();
  const fallback = flow?.returnTo ?? "/classes";
  const user = await getCurrentUser();
  const state = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");

  if (!flow || !isValidPkceVerifier(flow.verifier) || flow.expiresAt <= Date.now()) {
    return callbackFailure(request, fallback, "pkce-error", "pkce-validation");
  }

  if (
    !user ||
    user.role !== "INSTRUCTOR" ||
    user.id !== flow.userId ||
    !state ||
    !constantTimeStringEqual(state, flow.state)
  ) {
    return callbackFailure(request, fallback, "oauth-state-error", "state-validation");
  }

  if (!code || request.nextUrl.searchParams.has("error")) {
    return callbackFailure(
      request,
      fallback,
      "authorization-error",
      "provider-authorization"
    );
  }

  let config: ReturnType<typeof getGmailConfiguration>;
  try {
    config = getGmailConfiguration();
  } catch (error) {
    return callbackFailure(
      request,
      fallback,
      "token-exchange-error",
      "configuration",
      error
    );
  }

  let tokens: Awaited<ReturnType<typeof exchangeGoogleAuthorizationCode>>;
  try {
    tokens = await exchangeGoogleAuthorizationCode(
      code,
      flow.verifier,
      config
    );
  } catch (error) {
    return callbackFailure(
      request,
      fallback,
      "token-exchange-error",
      "token-exchange",
      error
    );
  }

  const grantedScopes = new Set(tokens.scope?.split(/\s+/u) ?? []);
  if (!grantedScopes.has(GOOGLE_GMAIL_SEND_SCOPE)) {
    return callbackFailure(request, fallback, "scope-error", "scope-validation");
  }

  let identity: Awaited<ReturnType<typeof getGoogleUserInfo>>;
  try {
    identity = await getGoogleUserInfo(tokens.access_token as string);
  } catch (error) {
    return callbackFailure(
      request,
      fallback,
      "identity-error",
      "identity-lookup",
      error
    );
  }

  let existing: Awaited<ReturnType<typeof getInstructorGoogleConnection>>;
  try {
    existing = await getInstructorGoogleConnection(user.id, true);
  } catch (error) {
    return callbackFailure(
      request,
      fallback,
      "database-error",
      "connection-read",
      error
    );
  }

  let encryptedRefreshToken: string;
  let refreshTokenIv: string;
  let encryptionVersion: 1;

  if (tokens.refresh_token) {
    try {
      const encrypted = await encryptGoogleRefreshToken(
        tokens.refresh_token,
        config.encryptionKey,
        user.id
      );
      encryptedRefreshToken = encrypted.ciphertext;
      refreshTokenIv = encrypted.iv;
      encryptionVersion = encrypted.encryptionVersion;
    } catch (error) {
      return callbackFailure(
        request,
        fallback,
        "encryption-error",
        "refresh-token-encryption",
        error
      );
    }
  } else if (
    existing &&
    existing.revokedAt === null &&
    existing.refreshTokenCiphertext &&
    existing.refreshTokenIv
  ) {
    encryptedRefreshToken = existing.refreshTokenCiphertext;
    refreshTokenIv = existing.refreshTokenIv;
    encryptionVersion = existing.encryptionVersion;
  } else {
    return callbackFailure(
      request,
      fallback,
      "missing-refresh-token",
      "refresh-token-validation"
    );
  }

  try {
    await saveInstructorGoogleConnection({
      instructorId: user.id,
      googleEmail: identity.email,
      googleSubject: identity.subject,
      refreshTokenCiphertext: encryptedRefreshToken,
      refreshTokenIv,
      encryptionVersion,
      scope: tokens.scope ?? GOOGLE_GMAIL_SEND_SCOPE,
    });
  } catch (error) {
    return callbackFailure(
      request,
      fallback,
      "database-error",
      "connection-write",
      error
    );
  }

  console.info("Gmail OAuth callback completed", {
    tokenExchange: "succeeded",
    refreshTokenReceived: Boolean(tokens.refresh_token),
    identityLookup: "succeeded",
    credentialSecurity: tokens.refresh_token ? "encrypted" : "preserved-existing",
    persistence: "succeeded",
  });
  return callbackRedirect(request, fallback, "connected");
}
