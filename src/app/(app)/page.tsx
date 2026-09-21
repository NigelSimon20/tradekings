import { ContractTable } from "@/components/contracts/contract-table";
import { RunActions } from "@/components/dashboard/run-actions";
import { SummaryBanner } from "@/components/dashboard/summary-banner";
import { ViewGrid } from "@/components/dashboard/view-grid";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { AlertIcon, ContractsIcon, ReportsIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { getConfig } from "@/lib/config/env";
import { formatDate, formatTimestamp, nextWeekday } from "@/lib/date/dates";
import { TRIGGER_LABELS } from "@/lib/domain/meta";
import { breakdownByCompany, listRunLog, loadSnapshot, topPriority } from "@/lib/services/contracts";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const config = getConfig();
  const { contracts, latest, today, source } = await loadSnapshot();
  const attention = topPriority(latest, 8);
  const breakdown = breakdownByCompany(latest);
  const runs = await listRunLog(5);

  const needsAction = latest.filter((contract) => contract.computed.needsAction).length;
  const active = latest.filter((contract) => contract.computed.isInForce).length;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Trade Kings · Zimkings"
        title="Contract dashboard"
        description={`Blue collar and casual contracts as at ${formatDate(today)}.`}
        actions={<RunActions canSend={Boolean(config.hrRecipient)} />}
      />

      {source.kind === "local" ? (
        <Alert tone="caution" title="You are looking at practice data" icon={<AlertIcon className="size-4" />}>
          The live Google Sheet is not connected yet, so the tracker is showing a sample database.
          Nothing here affects real contracts. Ask your system administrator to finish the setup.
        </Alert>
      ) : null}

      <SummaryBanner
        employees={latest.length}
        active={active}
        needsAction={needsAction}
        nextReport={formatDate(nextWeekday(today, 1))}
      />

      <ViewGrid latest={latest} all={contracts} groups={["contracts", "limits", "rehire", "data"]} />

      <Card>
        <CardHeader
          icon={<AlertIcon className="size-4" />}
          title="Requiring attention now"
          description="Contracts stay here until the contract information or renewal status is updated."
          action={
            <ButtonLink href="/contracts?view=renewals-due" variant="secondary" size="sm">
              View all {needsAction}
            </ButtonLink>
          }
        />
        <ContractTable
          contracts={attention}
          emptyTitle="Nothing needs attention"
          emptyDescription="Every contract in the database is active and up to date."
        />
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            icon={<ContractsIcon className="size-4" />}
            title="By company"
            description="Current contracts per company and worker type."
          />
          <TableWrap>
            <Table>
              <THead>
                <Tr className="hover:bg-transparent">
                  <Th>Company</Th>
                  <Th>Worker type</Th>
                  <Th className="text-right">Employees</Th>
                  <Th className="text-right">Active</Th>
                  <Th className="text-right">Need action</Th>
                </Tr>
              </THead>
              <TBody>
                {breakdown.map((row) => (
                  <Tr key={`${row.company}-${row.workerType}`}>
                    <Td className="font-medium text-slate-900">{row.company}</Td>
                    <Td>{row.workerType}</Td>
                    <Td className="numeric text-right">{row.total}</Td>
                    <Td className="numeric text-right">{row.active}</Td>
                    <Td className="text-right">
                      {row.needsAction > 0 ? (
                        <Badge tone="warning">{row.needsAction}</Badge>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        </Card>

        <Card>
          <CardHeader
            icon={<ReportsIcon className="size-4" />}
            title="Recent automated runs"
            description="System checks and weekly report sends."
            action={
              <ButtonLink href="/reports" variant="secondary" size="sm">
                Reports
              </ButtonLink>
            }
          />
          <CardBody className="p-0">
            {runs.length ? (
              <ul className="divide-y divide-slate-100">
                {runs.map((run) => (
                  <li key={run.id} className="flex items-start justify-between gap-4 px-5 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">
                        {run.type === "weekly-report" ? "Weekly report" : "System check"}
                        <span className="ml-2 text-xs font-normal text-slate-500">
                          {TRIGGER_LABELS[run.trigger] ?? run.trigger}
                        </span>
                      </p>
                      <p className="truncate text-xs text-slate-500">{run.note || "—"}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs text-slate-500">
                        {formatTimestamp(run.runAt, config.timezone)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {run.type === "weekly-report"
                          ? `${run.emailsSent}/${run.recipients} emails`
                          : `${run.rowsChecked} rows`}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-sm text-slate-500">
                No runs recorded yet. Use “Run system check” above to make the first one.
              </p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
