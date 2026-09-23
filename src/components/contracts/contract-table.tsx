import Link from "next/link";

import { FlagBadges, StatusBadge } from "@/components/contracts/status-badges";
import { EmptyState } from "@/components/ui/empty-state";
import { ChevronRightIcon } from "@/components/ui/icons";
import { LinkRow, TBody, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { describeDays, formatDate } from "@/lib/date/dates";
import { STATUS_META } from "@/lib/domain/meta";
import { TONE_CLASSES } from "@/lib/ui/tones";
import { cn } from "@/lib/ui/cn";
import type { EvaluatedContract } from "@/lib/domain/types";

/** First letters of the employee's name, for the row avatar. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "—";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function ContractTable({
  contracts,
  emptyTitle = "No contracts match these filters",
  emptyDescription,
  showFlags = true,
}: {
  contracts: EvaluatedContract[];
  emptyTitle?: string;
  emptyDescription?: string;
  showFlags?: boolean;
}) {
  if (!contracts.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <>
      {/* Phones get one card per contract: eight columns cannot be read at
          360px, and a sideways-scrolling table hides the urgent columns. */}
      <ul className="divide-y divide-slate-100 md:hidden">
        {contracts.map((contract) => {
          const { computed } = contract;
          const tone = STATUS_META[computed.status].tone;

          return (
            <li key={contract.id}>
              <Link
                href={`/contracts/${encodeURIComponent(contract.id)}`}
                className="flex gap-3 px-4 py-3.5 transition active:bg-brand-50/60"
              >
                <span
                  className={cn(
                    "inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-xs font-semibold text-white",
                    contract.company === "Zimkings" ? "bg-accent-600" : "bg-brand-700",
                  )}
                  aria-hidden
                >
                  {initials(contract.employeeName)}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-slate-900">
                        {contract.employeeName || "(no name)"}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {contract.company} · {contract.workerType}
                        {contract.department ? ` · ${contract.department}` : ""}
                      </span>
                    </span>
                    <StatusBadge status={computed.status} />
                  </span>

                  <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span className="numeric">
                      {formatDate(contract.startDate)} → {formatDate(contract.endDate)}
                    </span>
                    <span className={cn("numeric font-semibold", TONE_CLASSES[tone].text)}>
                      {describeDays(computed.daysRemaining)}
                    </span>
                  </span>

                  {computed.flags.length ? (
                    <span className="mt-2 block">
                      <FlagBadges flags={computed.flags} limit={2} />
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <TableWrap className="hidden md:block">
      <Table>
        <THead>
          <Tr className="hover:bg-transparent">
            <Th>Employee</Th>
            <Th>Company / Type</Th>
            <Th>Department</Th>
            <Th>Contract</Th>
            <Th className="text-right">Days</Th>
            <Th>Status</Th>
            {showFlags ? <Th>Flags</Th> : null}
            <Th className="sr-only">Open</Th>
          </Tr>
        </THead>
        <TBody>
          {contracts.map((contract) => {
            const { computed } = contract;
            const tone = STATUS_META[computed.status].tone;
            const href = `/contracts/${encodeURIComponent(contract.id)}`;

            return (
              <LinkRow key={contract.id} href={href} className="group">
                <Td>
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-xs font-semibold text-white",
                        contract.company === "Zimkings" ? "bg-accent-600" : "bg-brand-700",
                      )}
                      aria-hidden
                    >
                      {initials(contract.employeeName)}
                    </span>
                    <span className="min-w-0">
                      <Link
                        href={href}
                        className="block truncate font-medium text-slate-900 hover:text-brand-700 hover:underline"
                      >
                        {contract.employeeName || "(no name)"}
                      </Link>
                      <span className="block truncate text-xs text-slate-500">
                        {contract.employeeId || contract.id}
                        {contract.jobTitle ? ` · ${contract.jobTitle}` : ""}
                      </span>
                    </span>
                  </div>
                </Td>
                <Td>
                  <p className="text-slate-800">{contract.company}</p>
                  <p className="text-xs text-slate-500">{contract.workerType}</p>
                </Td>
                <Td>
                  <p className="text-slate-800">{contract.department || "—"}</p>
                  <p className="text-xs text-slate-500">{contract.costCentre}</p>
                </Td>
                <Td className="whitespace-nowrap">
                  <p className="numeric text-slate-800">
                    {formatDate(contract.startDate)} → {formatDate(contract.endDate)}
                  </p>
                  <p className="text-xs text-slate-500">
                    Contract {computed.contractNumber}
                    {computed.contractsRemaining !== null
                      ? ` of ${computed.contractNumber + computed.contractsRemaining}`
                      : ""}
                    {contract.manager ? ` · ${contract.manager}` : ""}
                  </p>
                </Td>
                <Td
                  className={cn(
                    "numeric text-right font-semibold whitespace-nowrap",
                    TONE_CLASSES[tone].text,
                  )}
                >
                  {describeDays(computed.daysRemaining)}
                </Td>
                <Td>
                  <StatusBadge status={computed.status} />
                </Td>
                {showFlags ? (
                  <Td>
                    <FlagBadges flags={computed.flags} limit={2} />
                  </Td>
                ) : null}
                <Td className="text-right">
                  <span
                    aria-hidden
                    className="inline-flex size-8 items-center justify-center rounded-lg text-slate-300 transition group-hover:bg-white group-hover:text-brand-700 group-hover:shadow-xs"
                  >
                    <ChevronRightIcon className="size-4" />
                  </span>
                </Td>
              </LinkRow>
            );
          })}
        </TBody>
      </Table>
      </TableWrap>
    </>
  );
}
