import "server-only";

export type GmailDeliveryErrorCode =
  | "AUTH_REQUIRED"
  | "INVALID_RECIPIENT"
  | "RATE_LIMITED"
  | "PROVIDER_ERROR";

export type GmailSendResult =
  | { success: true; messageId: string }
  | { success: false; errorCode: GmailDeliveryErrorCode };

export async function sendGmailMessage(
  accessToken: string,
  rawMessage: string
): Promise<GmailSendResult> {
  try {
    const response = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw: rawMessage }),
        cache: "no-store",
      }
    );

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return { success: false, errorCode: "AUTH_REQUIRED" };
      }
      if (response.status === 429) {
        return { success: false, errorCode: "RATE_LIMITED" };
      }
      if (response.status === 400) {
        return { success: false, errorCode: "INVALID_RECIPIENT" };
      }
      return { success: false, errorCode: "PROVIDER_ERROR" };
    }

    const payload = (await response.json().catch(() => ({}))) as { id?: string };
    return payload.id
      ? { success: true, messageId: payload.id }
      : { success: false, errorCode: "PROVIDER_ERROR" };
  } catch {
    return { success: false, errorCode: "PROVIDER_ERROR" };
  }
}
