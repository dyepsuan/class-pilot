import "server-only";

import { pbkdf2 } from "node:crypto";

const PASSWORD_ALGORITHM = "pbkdf2_sha256";
const CURRENT_PASSWORD_ITERATIONS = 100_000;
const LEGACY_PASSWORD_ITERATIONS = 310_000;
const ACCEPTED_PASSWORD_ITERATIONS = new Set([100_000, 310_000]);
const SALT_BYTES = 16;
const DERIVED_KEY_BYTES = 32;

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function base64UrlToBytes(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) {
    return null;
  }

  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");

  try {
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function derivePasswordKey(
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    pbkdf2(
      password,
      salt,
      iterations,
      DERIVED_KEY_BYTES,
      "sha256",
      (error, key) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(Uint8Array.from(key));
      }
    );
  });
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;

  for (let index = 0; index < length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }

  return difference === 0;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const derivedKey = await derivePasswordKey(
    password,
    salt,
    CURRENT_PASSWORD_ITERATIONS
  );

  return [
    PASSWORD_ALGORITHM,
    CURRENT_PASSWORD_ITERATIONS.toString(),
    bytesToBase64Url(salt),
    bytesToBase64Url(derivedKey),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  const [algorithm, iterationsText, saltText, derivedKeyText, ...rest] =
    storedHash.split("$");

  const iterations = Number(iterationsText);
  if (
    rest.length > 0 ||
    algorithm !== PASSWORD_ALGORITHM ||
    !Number.isInteger(iterations) ||
    iterationsText !== iterations.toString() ||
    !ACCEPTED_PASSWORD_ITERATIONS.has(iterations) ||
    !saltText ||
    !derivedKeyText
  ) {
    return false;
  }

  const salt = base64UrlToBytes(saltText);
  const expectedKey = base64UrlToBytes(derivedKeyText);

  if (!salt || salt.length !== SALT_BYTES || !expectedKey || expectedKey.length !== DERIVED_KEY_BYTES) {
    return false;
  }

  let actualKey: Uint8Array;
  try {
    actualKey = await derivePasswordKey(password, salt, iterations);
  } catch (error) {
    if (
      iterations === LEGACY_PASSWORD_ITERATIONS &&
      error instanceof Error &&
      error.name === "NotSupportedError"
    ) {
      return false;
    }

    throw error;
  }

  return constantTimeEqual(actualKey, expectedKey);
}
