import { hashPassword, verifyPassword } from "./password";

export function hashStudentPin(pin: string): Promise<string> {
  return hashPassword(pin);
}

export function verifyStudentPin(
  pin: string,
  storedHash: string
): Promise<boolean> {
  return verifyPassword(pin, storedHash);
}
