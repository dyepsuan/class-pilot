const PASSWORD_ALGORITHM = "pbkdf2_sha256";
const PASSWORD_ITERATIONS = 310_000;
const SALT_BYTES = 16;
const DERIVED_KEY_BYTES = 32;

const encoder = new TextEncoder();

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

async function derivePasswordKey(
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<Uint8Array> {
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: new Uint8Array(salt),
      iterations,
    },
    passwordKey,
    DERIVED_KEY_BYTES * 8
  );

  return new Uint8Array(bits);
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
    PASSWORD_ITERATIONS
  );

  return [
    PASSWORD_ALGORITHM,
    PASSWORD_ITERATIONS.toString(),
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

  if (
    rest.length > 0 ||
    algorithm !== PASSWORD_ALGORITHM ||
    iterationsText !== PASSWORD_ITERATIONS.toString() ||
    !saltText ||
    !derivedKeyText
  ) {
    return false;
  }

  const salt = base64UrlToBytes(saltText);
  const expectedKey = base64UrlToBytes(derivedKeyText);

  if (!salt || salt.length !== SALT_BYTES || !expectedKey) {
    return false;
  }

  const actualKey = await derivePasswordKey(
    password,
    salt,
    PASSWORD_ITERATIONS
  );

  return constantTimeEqual(actualKey, expectedKey);
}
