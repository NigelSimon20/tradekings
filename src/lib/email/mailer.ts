import "server-only";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { getConfig, isServerless } from "@/lib/config/env";

export interface EmailAttachment {
  filename: string;
  content: string;
  contentType: string;
}

export interface OutboundEmail {
  to: string;
  cc?: string[];
  subject: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
}

export interface Mailer {
  kind: "smtp" | "outbox";
  label: string;
  send(email: OutboundEmail): Promise<void>;
}

/** Sends through the configured SMTP server (Google Workspace, Microsoft 365, …). */
class SmtpMailer implements Mailer {
  readonly kind = "smtp" as const;
  readonly label: string;

  constructor(private readonly from: string) {
    this.label = `Sending from ${from}`;
  }

  async send(email: OutboundEmail): Promise<void> {
    const { smtp } = getConfig();
    if (!smtp) throw new Error("SMTP is not configured.");

    // Imported lazily so the dependency is only loaded when mail is sent.
    const nodemailer = await import("nodemailer");
    const transport = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.user ? { user: smtp.user, pass: smtp.password } : undefined,
    });

    await transport.sendMail({
      from: this.from,
      to: email.to,
      cc: email.cc?.length ? email.cc : undefined,
      subject: email.subject,
      html: email.html,
      text: email.text,
      attachments: email.attachments,
    });
  }
}

/**
 * Development fallback: writes each email to disk instead of sending it, so the
 * whole weekly run can be tested without an SMTP server.
 */
class OutboxMailer implements Mailer {
  readonly kind = "outbox" as const;
  readonly label: string;

  constructor(private readonly directory: string) {
    this.label = isServerless()
      ? "Email sending is not set up — nothing is being sent"
      : "Email sending is not set up — reports are saved for review";
  }

  async send(email: OutboundEmail): Promise<void> {
    // Hosted runtimes have no writable folder, so there is nowhere to put a
    // copy — the run still succeeds and reports what it would have sent.
    if (isServerless()) {
      console.info(`[outbox] would send "${email.subject}" to ${email.to}`);
      return;
    }

    // turbopackIgnore: the outbox path is configuration, not a module to trace.
    const dir = path.isAbsolute(this.directory)
      ? this.directory
      : path.join(/* turbopackIgnore: true */ process.cwd(), this.directory);
    await mkdir(dir, { recursive: true });

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const slug = email.to.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    await writeFile(path.join(dir, `${stamp}-${slug}.html`), email.html, "utf8");
    await writeFile(
      path.join(dir, `${stamp}-${slug}.txt`),
      `To: ${email.to}\nCc: ${(email.cc ?? []).join(", ")}\nSubject: ${email.subject}\nAttachments: ${(email.attachments ?? []).map((file) => file.filename).join(", ")}\n\n${email.text}`,
      "utf8",
    );
  }
}

export function getMailer(): Mailer {
  const config = getConfig();
  return config.smtp ? new SmtpMailer(config.mailFrom) : new OutboxMailer(config.outboxDir);
}
