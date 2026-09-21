import Link from "next/link";

import { ReportActions } from "@/components/reports/report-actions";
import { RunLogTable } from "@/components/reports/run-log-table";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { AlertIcon, ReportsIcon, SendIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { getConfig } from "@/lib/config/env";
import { formatUtcHourInZone } from "@/lib/date/dates";
import { groupByManager } from "@/lib/reports/build";
import { getMailer } from "@/lib/email/mailer";
import { previewReport } from "@/lib/reports/run";
import { listRunLog, loadSnapshot } from "@/lib/services/contracts";
import { cn } from "@/lib/ui/cn";

export const dynamic = "force-dynamic";

/**
 * Preview of exactly what goes out each week: the HR report covering the whole
 * database, and one filtered report per manager email in the sheet.
 */
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const config = getConfig();
  const { latest } = await loadSnapshot();
  const managers = groupByManager(latest);

  const requestedEmail = typeof params.email === "string" ? params.email.toLowerCase() : "";
  const scope =
    params.scope === "manager" && requestedEmail
      ? ({ kind: "manager", email: requestedEmail } as const)
      : ({ kind: "hr" } as const);

  const preview = await previewReport(scope);
  const runs = await listRunLog(10);
  const mailer = getMailer();
  const withoutManager = latest.filter((contract) => !contract.managerEmail.trim()).length;

  const recipients = [
    {
      key: "hr",
      href: "/reports",
      title: "HR — complete database",
      subtitle: config.hrRecipient || "No HR address set yet",
      count: latest.length,
      active: scope.kind === "hr",
    },
    ...managers.map((manager) => ({
      key: manager.email,
      href: `/reports?scope=manager&email=${encodeURIComponent(manager.email)}`,
      title: manager.name,
      subtitle: manager.email,
      count: manager.contracts.length,
      active: scope.kind === "manager" && scope.email === manager.email,
    })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Automated reporting"
        title="Weekly reports"
        description="HR receives the full database; each manager receives only their own employees."
        actions={
          preview ? (
            <ReportActions
              recipient={preview.data.scope.recipient}
              recipientLabel={scope.kind === "hr" ? "HR" : preview.data.scope.label.split(" ")[0]}
              canSend={Boolean(config.hrRecipient)}
            />
          ) : null
        }
      />

      {mailer.kind === "outbox" ? (
        <Alert tone="caution" title="Email sending is not set up yet">
          You can preview every report here, but running one saves it for review instead of sending
          it. Ask your system administrator to finish the email setup.
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader
              icon={<SendIcon className="size-4" />}
              title="Recipients"
              description={`${recipients.length} weekly emails.`}
            />
            <CardBody className="p-0">
              <ul className="divide-y divide-slate-100">
                {recipients.map((recipient) => (
                  <li key={recipient.key}>
                    <Link
                      href={recipient.href}
                      className={cn(
                        "flex items-center justify-between gap-3 px-5 py-3 text-sm transition",
                        recipient.active ? "bg-brand-50" : "hover:bg-slate-50",
                      )}
                    >
                      <span className="min-w-0">
                        <span
                          className={cn(
                            "block truncate font-medium",
                            recipient.active ? "text-brand-900" : "text-slate-900",
                          )}
                        >
                          {recipient.title}
                        </span>
                        <span className="block truncate text-xs text-slate-500">{recipient.subtitle}</span>
                      </span>
                      <Badge tone={recipient.active ? "info" : "neutral"}>{recipient.count}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          {withoutManager > 0 ? (
            <Alert tone="warning" title={`${withoutManager} employees have no manager email`}>
              They appear in the HR report only.{" "}
              <Link href="/contracts?flag=MISSING_MANAGER_EMAIL" className="font-medium underline">
                Review them
              </Link>
              .
            </Alert>
          ) : null}

          <Card>
            <CardHeader
              icon={<ReportsIcon className="size-4" />}
              title="Schedule"
              description="Runs automatically each week."
            />
            <CardBody className="space-y-2 text-sm text-slate-600">
              <p>Weekly report: Mondays at {formatUtcHourInZone(6, config.timezone)}.</p>
              <p>Daily contract check: every day at {formatUtcHourInZone(3, config.timezone)}.</p>
              <p className="text-xs text-slate-500">
                You can also send a report now using the buttons above. Your system administrator can
                change these times.
              </p>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader
            title={preview ? preview.subject : "Report preview"}
            description={
              preview
                ? `${preview.data.scope.label} · ${preview.data.totals.needsAction} requiring attention · sending via ${mailer.label}`
                : "This manager has no contracts."
            }
          />
          {preview ? (
            <iframe
              title="Weekly report preview"
              srcDoc={preview.html}
              className="h-[760px] w-full border-0 bg-slate-100"
            />
          ) : (
            <CardBody>
              <p className="text-sm text-slate-500">Choose a recipient to preview their report.</p>
            </CardBody>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader
          icon={<AlertIcon className="size-4" />}
          title="Run history"
          description="Every system check and report send is logged."
        />
        <RunLogTable runs={runs} timezone={config.timezone} />
      </Card>
    </div>
  );
}
