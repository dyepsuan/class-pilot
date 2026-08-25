const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(
  value: string
): Uint8Array<ArrayBuffer> {
  const base64 = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(
      value.length + ((4 - (value.length % 4)) % 4),
      "="
    );

  const binary = atob(base64);

  const bytes =
    new Uint8Array(
      new ArrayBuffer(binary.length)
    );

  for (
    let i = 0;
    i < binary.length;
    i++
  ) {
    bytes[i] =
      binary.charCodeAt(i);
  }

  return bytes;
}

async function getHmacKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign", "verify"]
  );
}

async function createHmacSignature(
  message: string,
  secret: string
) {
  const key = await getHmacKey(secret);

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message)
  );

  return toBase64Url(
    new Uint8Array(signature)
  );
}

export async function buildStudentQrPayload(
  credentialId: number,
  studentId: number,
  secret: string
) {
  const message =
    `cp1:${credentialId}:${studentId}`;

  const signature =
    await createHmacSignature(
      message,
      secret
    );

  return `${message}:${signature}`;
}

export async function hashStudentQrPayload(
  payload: string
) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(payload)
  );

  return toBase64Url(
    new Uint8Array(digest)
  );
}

export type VerifiedStudentQr = {
  credentialId: number;
  studentId: number;
};

export async function verifyStudentQrPayload(
  payload: string,
  secret: string
): Promise<VerifiedStudentQr | null> {
  const parts = payload.split(":");

  if (parts.length !== 4) {
    return null;
  }

  const [
    version,
    credentialIdRaw,
    studentIdRaw,
    signature,
  ] = parts;

  if (version !== "cp1") {
    return null;
  }

  const credentialId =
    Number(credentialIdRaw);

  const studentId =
    Number(studentIdRaw);

  if (
    !Number.isInteger(credentialId) ||
    !Number.isInteger(studentId) ||
    credentialId <= 0 ||
    studentId <= 0
  ) {
    return null;
  }

  let signatureBytes:
    Uint8Array<ArrayBuffer>;

  try {
    signatureBytes =
      fromBase64Url(signature);
  } catch {
    return null;
  }

  const message =
    `cp1:${credentialId}:${studentId}`;

  const key =
    await getHmacKey(secret);

  const valid =
    await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      encoder.encode(message)
    );

  if (!valid) {
    return null;
  }

  return {
    credentialId,
    studentId,
  };
}