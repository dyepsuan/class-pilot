import "server-only";

const ENCRYPTION_VERSION = 1;
const AES_GCM_IV_BYTES = 12;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type EncryptedGoogleToken = {
  ciphertext: string;
  iv: string;
  encryptionVersion: typeof ENCRYPTION_VERSION;
};

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function encodedValueToBytes(value: string): Uint8Array | null {
  const trimmed = value.trim();
  const unquoted =
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
      ? trimmed.slice(1, -1)
      : trimmed;

  if (!/^[A-Za-z0-9+/_-]+={0,2}$/u.test(unquoted)) return null;
  const withoutPadding = unquoted.replace(/=+$/u, "");
  if (withoutPadding.includes("=")) return null;

  const base64 = withoutPadding.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");

  try {
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

async function importEncryptionKey(encodedKey: string): Promise<CryptoKey> {
  const keyBytes = encodedValueToBytes(encodedKey);
  if (!keyBytes || keyBytes.length !== 32) {
    throw new Error("Gmail token encryption is not configured correctly.");
  }

  return crypto.subtle.importKey(
    "raw",
    new Uint8Array(keyBytes),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

function getAdditionalData(instructorId: number): ArrayBuffer {
  const bytes = encoder.encode(
    `class-pilot:gmail-refresh-token:v${ENCRYPTION_VERSION}:instructor:${instructorId}`
  );
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

export async function encryptGoogleRefreshToken(
  refreshToken: string,
  encodedKey: string,
  instructorId: number
): Promise<EncryptedGoogleToken> {
  const key = await importEncryptionKey(encodedKey);
  const iv = crypto.getRandomValues(new Uint8Array(AES_GCM_IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: getAdditionalData(instructorId),
    },
    key,
    encoder.encode(refreshToken)
  );

  return {
    ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)),
    iv: bytesToBase64Url(iv),
    encryptionVersion: ENCRYPTION_VERSION,
  };
}

export async function decryptGoogleRefreshToken(
  encrypted: EncryptedGoogleToken,
  encodedKey: string,
  instructorId: number
): Promise<string> {
  if (encrypted.encryptionVersion !== ENCRYPTION_VERSION) {
    throw new Error("Unsupported Gmail token encryption version.");
  }

  const iv = encodedValueToBytes(encrypted.iv);
  const ciphertext = encodedValueToBytes(encrypted.ciphertext);
  if (!iv || iv.length !== AES_GCM_IV_BYTES || !ciphertext) {
    throw new Error("Stored Gmail authorization is invalid.");
  }

  const key = await importEncryptionKey(encodedKey);
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: new Uint8Array(iv),
      additionalData: getAdditionalData(instructorId),
    },
    key,
    new Uint8Array(ciphertext)
  );

  return decoder.decode(plaintext);
}
