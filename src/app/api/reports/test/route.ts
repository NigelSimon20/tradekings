import { guardApi } from "@/lib/services/auth";
import { failure, success } from "@/lib/api/respond";
import { getConfig } from "@/lib/config/env";
import { getMailer } from "@/lib/email/mailer";
import { formatDate, todayIn } from "@/lib/date/dates";

/** Sends one short message, so email setup can be proved without a real report. */
export async function POST(request: Request): Promise<Response> {
  const denied = await guardApi("runReports");
  if (denied) return denied;

  try {
    const body = (await request.json().catch(() => ({}))) as { to?: string };
    const to = (body.to ?? "").trim();

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
      return failure("Enter the email address the test should go to.", 400);
    }

    const config = getConfig();
    const mailer = getMailer();
    const today = formatDate(todayIn(config.timezone));

    await mailer.send({
      to,
      subject: `Contract tracker test message — ${today}`,
      text: `This is a test from the Blue Collar Contract Tracker.\n\nIf you can read this, the weekly contract reports can reach ${to}.\n\nSent ${today}.`,
      html: `<div style="font-family:Arial,sans-serif;padding:24px;color:#0f1e2e;">
        <p style="font:600 12px Arial;letter-spacing:.14em;text-transform:uppercase;color:#64748b;">Trade Kings &middot; Zimkings</p>
        <h1 style="font-size:18px;margin:8px 0 12px;">Contract tracker test message</h1>
        <p style="font-size:14px;line-height:1.6;">If you can read this, the weekly contract reports can reach <strong>${to}</strong>.</p>
        <p style="font-size:12px;color:#64748b;">Sent ${today}.</p>
      </div>`,
    });

    return success(
      mailer.kind !== "outbox"
        ? `Test message sent to ${to}. Check the inbox — and the spam folder.`
        : `Email sending is not set up yet, so nothing left the system. The test message was prepared for ${to}.`,
      { transport: mailer.kind },
    );
  } catch (error) {
    return failure(error);
  }
}
