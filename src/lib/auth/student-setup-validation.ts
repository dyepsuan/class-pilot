import "server-only";

const STUDENT_SETUP_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/u;
const STUDENT_PIN_PATTERN = /^\d{6}$/u;

export function isStudentSetupTokenShapeValid(token: string): boolean {
  return STUDENT_SETUP_TOKEN_PATTERN.test(token);
}

export function isValidStudentSetupPin(pin: string): boolean {
  return STUDENT_PIN_PATTERN.test(pin);
}
