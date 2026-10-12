import Link from "next/link";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getConfig } from "@/lib/config/env";
import { formatTimestamp } from "@/lib/date/dates";

export interface ActivityItem {
  id: string;
  at: string;
  by: string;
  action: string;
  details: string;
  /** Shown after the action, e.g. the record it was about. */
  link?: { href: string; label: string } | null;
  /** A word after the action, e.g. "(lease)". */
  note?: string;
}

/**
 * "Who changed what, and when" — a record's history or an app's recent
 * changes, the same everywhere.
 */
export function ActivityCard({
  title = "Activity",
  description,
  items,
  empty,
  icon,
}: {
  title?: string;
  description: string;
  items: ActivityItem[];
  empty: string;
  icon?: React.ReactNode;
}) {
  const { timezone } = getConfig();
  return (
    <Card>
      <CardHeader icon={icon} title={title} description={description} />
      <CardBody className="p-0">
        {items.length ? (
          <ul className="divide-y divide-slate-100">
            {items.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm text-slate-900">
                    <span className="font-medium">{entry.action}</span>
                    {entry.note ? <span className="text-slate-500"> {entry.note}</span> : null}
                    {entry.link ? (
                      <>
                        {" "}
                        <Link href={entry.link.href} className="text-brand-700 hover:underline">
                          {entry.link.label}
                        </Link>
                      </>
                    ) : null}
                  </p>
                  {entry.details ? <p className="line-clamp-3 text-xs break-words text-slate-500">{entry.details}</p> : null}
                </div>
                <p className="shrink-0 text-xs text-slate-500">
                  {formatTimestamp(entry.at, timezone)} · {entry.by || "—"}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-6 text-sm text-slate-500">{empty}</p>
        )}
      </CardBody>
    </Card>
  );
}
