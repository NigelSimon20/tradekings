import Link from "next/link";
import { notFound } from "next/navigation";

import { ContractForm } from "@/components/contracts/contract-form";
import {
  FlagBadges,
  LimitBadge,
  RehireBadge,
  RenewalBadge,
  StatusBadge,
} from "@/components/contracts/status-badges";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DefinitionList } from "@/components/ui/definition-list";
import { ArrowLeftIcon, ContractsIcon, PlusIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { LinkRow, TBody, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";

import { getConfig } from "@/lib/config/env";
import { describeDays, formatDate, formatTimestamp } from "@/lib/date/dates";
import { getContractById, getEmployeeHistory } from "@/lib/services/contracts";
import { getRulesConfig } from "@/lib/services/settings";

export const dynamic = "force-dynamic";

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contract = await getContractById(decodeURIComponent(id));
  if (!contract) notFound();

  const config = getConfig();
  const { rules } = await getRulesConfig();
  const history = await getEmployeeHistory(contract);
  const { computed } = contract;
  const ruleSet = rules.ruleSets[computed.ruleSetId];

  return (
    <div className="space-y-6">
      <Link
        href="/contracts"
        className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeftIcon />
        All contracts
      </Link>

      <PageHeader
        eyebrow={`${contract.company} · contract ${contract.computed.contractNumber}`}
        title={contract.employeeName || contract.employeeId || contract.id}
        description={`${contract.company} · ${contract.workerType} · ${contract.jobTitle || "No job title"}`}
        actions={
          <ButtonLink href={`/contracts/new?renewFrom=${encodeURIComponent(contract.id)}`}>
            <PlusIcon />
            Create renewal
          </ButtonLink>
        }
      />

      {computed.flags.length ? (
        <Alert tone="warning" title="Flags on this contract">
          <div className="mt-2">
            <FlagBadges flags={computed.flags} />
          </div>
        </Alert>
      ) : null}

      <Card>
        <CardHeader
          icon={<ContractsIcon className="size-4" />}
          title="Calculated by the system"
          description={`Rules applied: ${ruleSet.label}`}
          action={<StatusBadge status={computed.status} />}
        />
        <CardBody>
          <DefinitionList
            columns={4}
            items={[
              { label: "Contract period", value: `${formatDate(contract.startDate)} → ${formatDate(contract.endDate)}` },
              {
                label: "Days remaining",
                value: <span className="numeric">{describeDays(computed.daysRemaining)}</span>,
              },
              { label: "Term", value: computed.termDays ? `${computed.termDays} days` : "—" },
              { label: "Renewal status", value: <RenewalBadge status={contract.renewalStatus} /> },
              {
                label: "Contract count",
                value: `${computed.contractNumber}${ruleSet.maxContracts ? ` of ${ruleSet.maxContracts}` : " (unlimited renewals)"}`,
              },
              {
                label: "Contract limit",
                value: (
                  <LimitBadge
                    status={computed.limitStatus}
                    count={computed.contractCount}
                    max={ruleSet.maxContracts}
                  />
                ),
              },
              { label: "Rehire eligibility date", value: formatDate(computed.rehireEligibleDate) },
              { label: "Rehire status", value: <RehireBadge status={computed.rehireStatus} /> },
              { label: "Contract ID", value: contract.id },
              { label: "Employee ID", value: contract.employeeId || "—" },
              { label: "Department / cost centre", value: `${contract.department || "—"} · ${contract.costCentre || "—"}` },
              { label: "Location", value: contract.location || "—" },
              {
                label: "Direct manager",
                value: contract.manager ? `${contract.manager} (${contract.managerEmail || "no email"})` : "—",
              },
              {
                label: "Responsible HR",
                value: contract.hrPerson ? `${contract.hrPerson} (${contract.hrEmail || "no email"})` : "—",
              },
              { label: "Last updated", value: formatTimestamp(contract.lastUpdated, config.timezone) },
              {
                label: "On the weekly report",
                value: computed.needsAction ? "Yes — action required" : "No",
              },
            ]}
          />
          {contract.notes ? (
            <p className="mt-5 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">{contract.notes}</p>
          ) : null}
        </CardBody>
      </Card>

      {history.length > 1 ? (
        <Card>
          <CardHeader
            title="Contract history"
            description={`All ${history.length} contracts captured for this employee.`}
          />
          <TableWrap>
            <Table>
              <THead>
                <Tr className="hover:bg-transparent">
                  <Th>#</Th>
                  <Th>Period</Th>
                  <Th>Type</Th>
                  <Th>Renewal status</Th>
                  <Th>Status</Th>
                  <Th className="sr-only">Open</Th>
                </Tr>
              </THead>
              <TBody>
                {history.map((row) => (
                  <LinkRow
                    key={row.id}
                    href={`/contracts/${encodeURIComponent(row.id)}`}
                    className={row.id === contract.id ? "bg-brand-50/70" : undefined}
                  >
                    <Td className="numeric">{row.computed.contractNumber}</Td>
                    <Td className="numeric whitespace-nowrap">
                      {formatDate(row.startDate)} → {formatDate(row.endDate)}
                    </Td>
                    <Td>{row.contractType}</Td>
                    <Td>
                      <RenewalBadge status={row.renewalStatus} />
                    </Td>
                    <Td>
                      <StatusBadge status={row.computed.status} />
                    </Td>
                    <Td className="text-right">
                      {row.id === contract.id ? (
                        <span className="text-xs text-slate-400">Viewing</span>
                      ) : (
                        <Link
                          href={`/contracts/${encodeURIComponent(row.id)}`}
                          className="text-xs font-medium text-brand-700 hover:underline"
                        >
                          Open
                        </Link>
                      )}
                    </Td>
                  </LinkRow>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        </Card>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Edit contract</h2>
        <ContractForm defaults={contract} mode="edit" rules={rules} />
      </section>
    </div>
  );
}
