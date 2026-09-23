import type { OutboundEmail } from "@/lib/email/mailer";

/**
 * Resend's send API, called over plain HTTPS.
 *
 * Using the endpoint directly rather than the SDK keeps the dependency out of
 * the deployment and works the same in every runtime — the request is a single
 * JSON POST.
 */
export const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface ResendPayload {
  from: string;
  to: string[];
  cc?: string[];
  subject: string;
  html: string;
  text: string;
  attachments?: { filename: string; content: string }[];
}

/** Builds the request body. Kept pure so it can be checked without sending. */
export function buildResendPayload(email: OutboundEmail, from: string): ResendPayload {
  const payload: ResendPayload = {
    from,
    to: [email.to],
    subject: email.subject,
    html: email.html,
    text: email.text,
  };

  if (email.cc?.length) payload.cc = email.cc;

  if (email.attachments?.length) {
    payload.attachments = email.attachments.map((attachment) => ({
      filename: attachment.filename,
      // Resend takes attachment contents as base64.
      content: Buffer.from(attachment.content, "utf8").toString("base64"),
    }));
  }

  return payload;
}

/** Turns Resend's error responses into something a person can act on. */
export function describeResendError(status: number, body: unknown): string {
  const message =
    typeof body === "object" && body !== null && "message" in body
      ? String((body as { message: unknown }).message)
      : "";

  // 401 is the only status that means the key itself is wrong. 403 means the
  // key is fine but this sending address is not allowed yet — usually an
  // unverified domain, which is a different problem with a different fix.
  if (status === 401) {
    return "Resend refused the API key. Check the key in the tracker's settings.";
  }
  if (status === 403 || (status === 422 && /domain|from/i.test(message))) {
    return message
      ? `Resend will not send from that address yet. ${message}`
      : "Resend will not send from that address yet. Verify your sending domain at resend.com/domains.";
  }
  if (status === 429) {
    return "Resend is rate limiting the tracker. The remaining reports will need another run.";
  }

  return message || `Resend returned an error (${status}).`;
}
