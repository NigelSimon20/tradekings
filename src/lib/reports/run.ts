import "server-only";

import { getConfig } from "@/lib/config/env";
import { getRepository } from "@/lib/data";
import { newRunLogId } from "@/lib/data/repository";
import type { EvaluatedContract, RunLogEntry } from "@/lib/domain/types";
import { getMailer, type OutboundEmail } from "@/lib/email/mailer";
import { buildReport, groupByManager, type ReportData, type ReportScope } from "@/lib/reports/build";
import { contractsToCsv, csvFilename } from "@/lib/reports/csv";
import { renderReportEmail } from "@/lib/reports/render-email";
import { loadSnapshot } from "@/lib/services/contracts";
import { getReportSettings } from "@/lib/services/settings";

export interface ReportDelivery {
  recipient: string;
  label: string;
  subject: string;
  needsAction: number;
  contracts: number;
  status: "sent" | "skipped" | "failed";
  reason?: string;
}

export interface WeeklyReportResult {
  today: string;
  generatedAt: string;
  mode: "send" | "preview";
  trigger: "cron" | "manual";
  transport: string;
  /** How the emails left the system, so callers can word the result properly. */
  transportKind: "smtp" | "outbox";
  hr: ReportDelivery | null;
  managers: ReportDelivery[];
  emailsSent: number;
  recipients: number;
  errors: string[];
}

export interface RunWeeklyReportOptions {
  mode?: "send" | "preview";
  trigger?: "cron" | "manual";
  /** Limits the run to one manager, used by "send me a test". */
  onlyRecipient?: string;
  /** Where the app is reachable, for the link in the email. */
  appUrl?: string;
}

/**
 * Builds and (optionally) sends the weekly reports: the complete database to
 * the designated HR address, and a filtered report to each manager.
 */
export async function runWeeklyReports(
  options: RunWeeklyReportOptions = {},
): Promise<WeeklyReportResult> {
  const mode = options.mode ?? "send";
  const trigger = options.trigger ?? "manual";
  const config = getConfig();
  const settings = await getReportSettings();
  const mailer = getMailer();
  const { latest, today } = await loadSnapshot();
  const generatedAt = new Date().toISOString();
  const errors: string[] = [];

  const deliver = async (
    contracts: EvaluatedContract[],
    scope: ReportScope,
    attachments?: OutboundEmail["attachments"],
  ): Promise<ReportDelivery> => {
    const data = buildReport(contracts, {
      scope,
      today,
      appName: config.appName,
      appUrl: options.appUrl || config.appUrl,
      generatedAt,
    });
    const email = renderReportEmail(data, config.timezone);
    const delivery: ReportDelivery = {
      recipient: scope.recipient,
      label: scope.label,
      subject: email.subject,
      needsAction: data.totals.needsAction,
      contracts: contracts.length,
      status: "skipped",
    };

    if (mode === "preview") {
      delivery.reason = "Preview only — no email sent.";
      return delivery;
    }

    if (!scope.recipient) {
      delivery.reason = "No email address configured.";
      return delivery;
    }

    try {
      await mailer.send({
        to: scope.recipient,
        cc: scope.kind === "hr" ? settings.reportCc : undefined,
        subject: email.subject,
        html: email.html,
        text: email.text,
        attachments,
      });
      delivery.status = "sent";
    } catch (error) {
      delivery.status = "failed";
      delivery.reason = (error as Error).message;
      errors.push(`${scope.recipient}: ${(error as Error).message}`);
    }

    return delivery;
  };

  // HR receives the complete database, with the full export attached.
  let hr: ReportDelivery | null = null;
  const wantsHr = !options.onlyRecipient || options.onlyRecipient === settings.hrRecipient;
  if (wantsHr) {
    hr = await deliver(latest, { kind: "hr", label: "All employees", recipient: settings.hrRecipient }, [
      {
        filename: csvFilename("contract-database", today),
        content: contractsToCsv(latest),
        contentType: "text/csv",
      },
    ]);
    if (!settings.hrRecipient) {
      errors.push(
        "No HR recipient is set — add one on the Settings tab of the Google Sheet.",
      );
    }
  }

  // Managers receive only their own employees.
  const managers: ReportDelivery[] = [];
  if (settings.managerReportsEnabled) {
    for (const group of groupByManager(latest)) {
      if (options.onlyRecipient && group.email !== options.onlyRecipient.toLowerCase()) continue;

      const scope: ReportScope = { kind: "manager", label: group.name, recipient: group.email };
      const needsAction = group.contracts.filter((contract) => contract.computed.needsAction).length;
      const hasFlags = group.contracts.some((contract) => contract.computed.flags.length > 0);

      if (mode === "send" && settings.skipEmptyManagerReports && needsAction === 0 && !hasFlags) {
        managers.push({
          recipient: group.email,
          label: group.name,
          subject: "",
          needsAction: 0,
          contracts: group.contracts.length,
          status: "skipped",
          reason: "Nothing requiring attention.",
        });
        continue;
      }

      managers.push(await deliver(group.contracts, scope));
    }
  }

  const deliveries = [...(hr ? [hr] : []), ...managers];
  const emailsSent = deliveries.filter((delivery) => delivery.status === "sent").length;

  const result: WeeklyReportResult = {
    today,
    generatedAt,
    mode,
    trigger,
    transport: mailer.label,
    transportKind: mailer.kind,
    hr,
    managers,
    emailsSent,
    recipients: deliveries.length,
    errors,
  };

  await logRun({
    id: newRunLogId(),
    runAt: generatedAt,
    type: "weekly-report",
    trigger,
    mode,
    recipients: result.recipients,
    emailsSent,
    rowsChecked: latest.length,
    needsAction: latest.filter((contract) => contract.computed.needsAction).length,
    errors,
    note: `${mailer.label}${options.onlyRecipient ? ` · single recipient ${options.onlyRecipient}` : ""}`,
  });

  return result;
}

/** Builds one report for on-screen preview. */
export async function previewReport(
  scopeInput: { kind: "hr" } | { kind: "manager"; email: string },
): Promise<{ data: ReportData; html: string; subject: string } | null> {
  const config = getConfig();
  const settings = await getReportSettings();
  const { latest, today } = await loadSnapshot();

  let contracts = latest;
  let scope: ReportScope;

  if (scopeInput.kind === "hr") {
    scope = { kind: "hr", label: "All employees", recipient: settings.hrRecipient };
  } else {
    const group = groupByManager(latest).find(
      (entry) => entry.email === scopeInput.email.toLowerCase(),
    );
    if (!group) return null;
    contracts = group.contracts;
    scope = { kind: "manager", label: group.name, recipient: group.email };
  }

  const data = buildReport(contracts, {
    scope,
    today,
    appName: config.appName,
    appUrl: config.appUrl,
  });
  const email = renderReportEmail(data, config.timezone);
  return { data, html: email.html, subject: email.subject };
}

/** Run logging must never break a report run. */
async function logRun(entry: RunLogEntry): Promise<void> {
  try {
    await getRepository().appendRunLog(entry);
  } catch (error) {
    console.error("Could not write the run log:", (error as Error).message);
  }
}
