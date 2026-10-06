import Link from "next/link";

import { ExpiryCell } from "@/components/expats/badges";
import { EmptyState } from "@/components/ui/empty-state";
import { CalendarIcon } from "@/components/ui/icons";
import { LinkRow, TBody, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { profileHref } from "@/lib/expats/meta";
import type { ExpiryItem } from "@/lib/expats/types";

/** Watched dates as a table; each row opens the profile at the right section. */
export function ExpiryTable({
  items,
  restricted,
  showPerson = true,
  emptyTitle = "Nothing matches",
  emptyDescription = "Try clearing a filter or widening the dates.",
}: {
  items: ExpiryItem[];
  restricted: boolean;
  showPerson?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (!items.length) {
    return <EmptyState icon={<CalendarIcon className="size-5" />} title={emptyTitle} description={emptyDescription} />;
  }
  return (
    <TableWrap>
      <Table>
        <THead>
          <Tr className="hover:bg-transparent">
            {showPerson ? <Th>Person</Th> : null}
            <Th>Document / item</Th>
            <Th>Expiry</Th>
            <Th className="hidden lg:table-cell">Responsible</Th>
          </Tr>
        </THead>
        <TBody>
          {items.map((item) => {
            const href = profileHref(item.expatId, item.section);
            return (
              <LinkRow key={item.key} href={href} className="cursor-pointer">
                {showPerson ? (
                  <Td>
                    <Link href={href} className="font-medium text-slate-900 hover:text-brand-700 hover:underline">
                      {item.personName}
                    </Link>
                    <p className="text-xs text-slate-500">{item.dependantId ? `Dependant of ${item.expatName}` : item.expatId}</p>
                  </Td>
                ) : null}
                <Td>
                  <p className={showPerson ? undefined : "font-medium text-slate-900"}>{item.kind}</p>
                  <p className="text-xs break-words text-slate-500">
                    {[!showPerson && item.dependantId ? item.personName : "", restricted && !item.reference ? "" : item.reference, item.group]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </Td>
                <Td>
                  <ExpiryCell item={item} />
                </Td>
                <Td className="hidden text-slate-600 lg:table-cell">{item.responsibleName || "—"}</Td>
              </LinkRow>
            );
          })}
        </TBody>
      </Table>
    </TableWrap>
  );
}
