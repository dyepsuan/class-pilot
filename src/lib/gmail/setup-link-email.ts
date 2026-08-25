import "server-only";

import { STUDENT_SETUP_LINK_TTL_HOURS } from "@/lib/auth/student-setup-token";
import { isValidEmailAddress } from "@/lib/validation/email";

const encoder = new TextEncoder();

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function encodeHeader(value: string): string {
  if (/[\r\n]/u.test(value)) throw new Error("Invalid email header.");
  return `=?UTF-8?B?${bytesToBase64(encoder.encode(value))}?=`;
}

function wrapBase64(value: string): string {
  return value.match(/.{1,76}/gu)?.join("\r\n") ?? "";
}

export type SetupLinkEmailInput = {
  recipientEmail: string;
  studentFirstName: string;
  studentNumber: string;
  className: string;
  setupUrl: string;
  instructorName: string;
};

export function buildSetupLinkEmail(input: SetupLinkEmailInput): {
  subject: string;
  raw: string;
} {
  if (!isValidEmailAddress(input.recipientEmail)) {
    throw new Error("Invalid recipient email.");
  }

  const subject = `Set up your Class-pilot account — ${input.className}`;
  const body = [
    `Hello ${input.studentFirstName},`,
    "",
    `Your Class-pilot account for ${input.className} is ready to set up.`,
    "",
    "Use the secure link below to create your 6-digit student portal PIN:",
    "",
    input.setupUrl,
    "",
    `This link can be used only once and expires in ${STUDENT_SETUP_LINK_TTL_HOURS} hours.`,
    "",
    "Do not share this link with anyone.",
    "",
    `Student Number: ${input.studentNumber}`,
    "",
    "If the link expires, ask your instructor for a new one.",
    "",
    `— ${input.instructorName}`,
  ].join("\r\n");

  const mime = [
    `To: ${input.recipientEmail}`,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(bytesToBase64(encoder.encode(body))),
  ].join("\r\n");

  return { subject, raw: bytesToBase64Url(encoder.encode(mime)) };
}

export function buildSetupLinkEmailPreview({
  studentFirstName,
  studentNumber,
  className,
  instructorName,
}: Omit<SetupLinkEmailInput, "recipientEmail" | "setupUrl">): {
  subject: string;
  body: string;
} {
  return {
    subject: `Set up your Class-pilot account — ${className}`,
    body: [
      `Hello ${studentFirstName},`,
      "",
      `Your Class-pilot account for ${className} is ready to set up.`,
      "",
      "Use the secure link below to create your 6-digit student portal PIN:",
      "",
      "[Your unique setup link will appear here]",
      "",
      `This link can be used only once and expires in ${STUDENT_SETUP_LINK_TTL_HOURS} hours.`,
      "",
      "Do not share this link with anyone.",
      "",
      `Student Number: ${studentNumber}`,
      "",
      "If the link expires, ask your instructor for a new one.",
      "",
      `— ${instructorName}`,
    ].join("\n"),
  };
}
