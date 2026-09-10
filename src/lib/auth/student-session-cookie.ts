export const STUDENT_SESSION_COOKIE_NAME = "class_pilot_student_session";
export const STUDENT_SESSION_COOKIE_PATH = "/";
export const LEGACY_STUDENT_SESSION_COOKIE_PATH = "/student";
export const STUDENT_SESSION_SECONDS = 60 * 60 * 24 * 7;

function sharedStudentSessionCookieOptions(path: string, secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path,
    secure,
  };
}

export function createStudentSessionCookie(
  token: string,
  expiresAt: Date,
  secure: boolean
) {
  return {
    name: STUDENT_SESSION_COOKIE_NAME,
    value: token,
    ...sharedStudentSessionCookieOptions(STUDENT_SESSION_COOKIE_PATH, secure),
    maxAge: STUDENT_SESSION_SECONDS,
    expires: expiresAt,
  };
}

function expireStudentSessionCookie(path: string, secure: boolean) {
  return {
    name: STUDENT_SESSION_COOKIE_NAME,
    value: "",
    ...sharedStudentSessionCookieOptions(path, secure),
    maxAge: 0,
    expires: new Date(0),
  };
}

export function expireCanonicalStudentSessionCookie(secure: boolean) {
  return expireStudentSessionCookie(STUDENT_SESSION_COOKIE_PATH, secure);
}

export function expireLegacyStudentSessionCookie(secure: boolean) {
  return expireStudentSessionCookie(
    LEGACY_STUDENT_SESSION_COOKIE_PATH,
    secure
  );
}
