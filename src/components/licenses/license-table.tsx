import Link from "next/link";

import { LicenseStatusBadge } from "@/components/licenses/badges";
import { EmptyState } from "@/components/ui/empty-state";
import { ShieldCheckIcon } from "@/components/ui/icons";
import { LinkRow, TBody, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import type { EvaluatedLicense } from "@/lib/licenses/types";
import { describeDays, formatDate } from "@/lib/date/dates";

/** Licenses as a table; every row opens the license. */
export function LicenseTable({
  licenses,
  emptyTitle = "No licenses match",
  emptyDescription = "Try clearing a filter or searching for something else.",
  showAsset = true,
}: {
  licenses: EvaluatedLicense[];
  emptyTitle?: string;
  emptyDescription?: string;
  showAsset?: boolean;
}) {
  if (!licenses.length) {
    return <EmptyState icon={<ShieldCheckIcon className="size-5" />} title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <TableWrap>
      <Table>
        <THead>
          <Tr className="hover:bg-transparent">
            <Th>License</Th>
            {showAsset ? <Th className="hidden md:table-cell">Asset / location</Th> : null}
            <Th className="hidden lg:table-cell">Type</Th>
            <Th>Expiry</Th>
            <Th>Status</Th>
            <Th className="hidden xl:table-cell">Renewal</Th>
          </Tr>
        </THead>
        <TBody>
          {licenses.map((license) => {
            const href = `/licenses/${encodeURIComponent(license.id)}`;
            const asset = license.computed.asset;
            return (
              <LinkRow key={license.id} href={href} className="cursor-pointer">
                <Td>
                  <Link href={href} className="font-medium text-slate-900 hover:text-brand-700 hover:underline">
                    {license.name}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {license.id}
                    {license.number ? ` · ${license.number}` : ""}
                  </p>
                </Td>
                {showAsset ? (
                  <Td className="hidden md:table-cell">
                    <p>{asset?.name ?? "Company-wide"}</p>
                    <p className="text-xs text-slate-500">
                      {[asset?.registration, asset?.city].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </Td>
                ) : null}
                <Td className="hidden lg:table-cell">
                  <p>{license.type}</p>
                  <p className="text-xs text-slate-500">{license.department || "—"}</p>
                </Td>
                <Td className="numeric">
                  <p>{formatDate(license.expiryDate)}</p>
                  <p className="text-xs text-slate-500">{describeDays(license.computed.daysRemaining)}</p>
                </Td>
                <Td>
                  <LicenseStatusBadge status={license.computed.status} reminderDays={license.computed.reminderDays} />
                </Td>
                <Td className="hidden text-slate-600 xl:table-cell">{license.renewalStatus}</Td>
              </LinkRow>
            );
          })}
        </TBody>
      </Table>
    </TableWrap>
  );
}
