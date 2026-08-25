import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

export const GOOGLE_GMAIL_SEND_SCOPE =
  "https://www.googleapis.com/auth/gmail.send";
export const GOOGLE_OAUTH_SCOPES = [
  "openid",
  "email",
  GOOGLE_GMAIL_SEND_SCOPE,
] as const;

const GOOGLE_AUTHORIZATION_ENDPOINT =
  "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_ENDPOINT =
  "https://openidconnect.googleapis.com/v1/userinfo";
const GOOGLE_REVOCATION_ENDPOINT = "https://oauth2.googleapis.com/revoke";
const RANDOM_BYTES = 32;

type GmailEnvironment = {
  GOOGLE_OAUTH_CLIENT_ID?: string;
  GOOGLE_OAUTH_CLIENT_SECRET?: string;
  GMAIL_TOKEN_ENCRYPTION_KEY?: string;
  APP_BASE_URL?: string;
};

export type GmailConfiguration = {
  clientId: string;
  clientSecret: string;
  encryptionKey: string;
  appBaseUrl: string;
  redirectUri: string;
};

export class GoogleOAuthError extends Error {
  constructor(
    message: string,
    readonly code: "AUTH_REQUIRED" | "PROVIDER_ERROR",
    readonly providerError?: string
  ) {
    super(message);
  }
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

export function generateOAuthSecret(): string {
  return bytesToBase64Url(
    crypto.getRandomValues(new Uint8Array(RANDOM_BYTES))
  );
}

export async function createPkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier)
  );
  return bytesToBase64Url(new Uint8Array(digest));
}

export function constantTimeStringEqual(left: string, right: string): boolean {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |=
      (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

export function getGmailConfiguration(): GmailConfiguration {
  const { env } = getCloudflareContext();
  const gmailEnv = env as unknown as GmailEnvironment;
  const clientId = gmailEnv.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = gmailEnv.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const encryptionKey = gmailEnv.GMAIL_TOKEN_ENCRYPTION_KEY?.trim();
  const baseUrlValue = gmailEnv.APP_BASE_URL?.trim();

  if (!clientId || !clientSecret || !encryptionKey || !baseUrlValue) {
    throw new Error("Gmail integration is not configured.");
  }

  let appBaseUrl: string;
  try {
    const parsed = new URL(baseUrlValue);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Invalid protocol");
    }
    parsed.pathname = parsed.pathname.replace(/\/+$/u, "");
    parsed.search = "";
    parsed.hash = "";
    appBaseUrl = parsed.toString().replace(/\/$/u, "");
  } catch {
    throw new Error("APP_BASE_URL is not a valid absolute URL.");
  }

  return {
    clientId,
    clientSecret,
    encryptionKey,
    appBaseUrl,
    redirectUri: `${appBaseUrl}/api/integrations/gmail/callback`,
  };
}

export function isGmailConfigured(): boolean {
  try {
    getGmailConfiguration();
    return true;
  } catch {
    return false;
  }
}

export function buildGoogleAuthorizationUrl({
  config,
  state,
  codeChallenge,
  loginHint,
}: {
  config: GmailConfiguration;
  state: string;
  codeChallenge: string;
  loginHint?: string;
}): string {
  const url = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_OAUTH_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  if (loginHint) url.searchParams.set("login_hint", loginHint);
  return url.toString();
}

export type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
};

async function requestGoogleToken(body: URLSearchParams): Promise<GoogleTokenResponse> {
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => ({}))) as GoogleTokenResponse;
  if (!response.ok || !payload.access_token) {
    const providerError =
      typeof payload.error === "string" &&
      /^[a-z][a-z0-9_]{0,63}$/u.test(payload.error)
        ? payload.error
        : undefined;

    throw new GoogleOAuthError(
      "Google authorization is unavailable.",
      providerError === "invalid_grant" ? "AUTH_REQUIRED" : "PROVIDER_ERROR",
      providerError
    );
  }
  return payload;
}

export function exchangeGoogleAuthorizationCode(
  code: string,
  verifier: string,
  config: GmailConfiguration
): Promise<GoogleTokenResponse> {
  return requestGoogleToken(
    new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
      code_verifier: verifier,
    })
  );
}

export async function refreshGoogleAccessToken(
  refreshToken: string,
  config: GmailConfiguration
): Promise<string> {
  const result = await requestGoogleToken(
    new URLSearchParams({
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
    })
  );
  return result.access_token as string;
}

export async function getGoogleUserInfo(accessToken: string): Promise<{
  subject: string;
  email: string;
}> {
  const response = await fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => ({}))) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
  };
  if (
    !response.ok ||
    !payload.sub ||
    !payload.email ||
    payload.email_verified !== true
  ) {
    throw new GoogleOAuthError("Google identity is unavailable.", "PROVIDER_ERROR");
  }
  return { subject: payload.sub, email: payload.email };
}

export async function revokeGoogleToken(token: string): Promise<void> {
  try {
    await fetch(GOOGLE_REVOCATION_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
      cache: "no-store",
    });
  } catch {
    // Local disconnection remains authoritative if Google is unavailable.
  }
}
