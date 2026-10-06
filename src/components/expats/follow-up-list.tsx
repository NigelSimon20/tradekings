import Link from "next/link";

import { FollowUpStatusButtons } from "@/components/expats/controls";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ClipboardIcon } from "@/components/ui/icons";
import { describeDays, daysBetween, formatDate } from "@/lib/date/dates";
import { ACTION_STATUS_TONE, profileHref } from "@/lib/expats/meta";
import { OPEN_ACTION, type FollowUp } from "@/lib/expats/types";
import { cn } from "@/lib/ui/cn";
import { TONE_CLASSES } from "@/lib/ui/tones";

/** Follow-up actions with who has them and when they are due; the buttons move them along. */
export function FollowUpList({
  actions,
  today,
  nameOf,
  mayManage,
  returnTo,
  emptyDescription = "Nothing is waiting on anyone.",
}: {
  actions: FollowUp[];
  today: string;
  /** Shows whose follow-up it is; leave out on a profile. */
  nameOf?: (expatId: string) => string;
  mayManage: boolean;
  returnTo?: string;
  emptyDescription?: string;
}) {
  if (!actions.length) {
    return <EmptyState icon={<ClipboardIcon className="size-5" />} title="No follow-ups" description={emptyDescription} />;
  }
  return (
    <ul className="divide-y divide-slate-100">
      {actions.map((action) => {
        const open = OPEN_ACTION.includes(action.status);
        const overdue = open && action.dueDate !== null && action.dueDate < today;
        const editHref = `/expats/${encodeURIComponent(action.expatId)}/edit/action/${encodeURIComponent(action.id)}${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`;
        return (
          <li key={action.id} className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 px-5 py-3">
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm font-medium", open ? "text-slate-900" : "text-slate-500 line-through decoration-slate-300")}>
                {action.title}
              </p>
              <p className="text-xs text-slate-500">
                {nameOf ? (
                  <>
                    <Link href={profileHref(action.expatId, "actions")} className="font-medium text-brand-700 hover:underline">
                      {nameOf(action.expatId)}
                    </Link>
                    {" · "}
                  </>
                ) : null}
                {action.responsibleName || action.responsibleEmail || "Nobody assigned"}
                {action.dueDate ? (
                  <>
                    {" · due "}
                    <span className={overdue ? cn("font-semibold", TONE_CLASSES.danger.text) : undefined}>
                      {formatDate(action.dueDate)} ({describeDays(daysBetween(today, action.dueDate))})
                    </span>
                  </>
                ) : null}
              </p>
              {action.notes ? <p className="mt-1 text-xs whitespace-pre-line text-slate-600">{action.notes}</p> : null}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone={overdue ? "danger" : ACTION_STATUS_TONE[action.status]}>{overdue ? "Overdue" : action.status}</Badge>
              {mayManage ? (
                <>
                  <FollowUpStatusButtons actionId={action.id} status={action.status} />
                  <Link href={editHref} className="text-xs font-medium text-slate-500 hover:text-slate-900 hover:underline">
                    Edit
                  </Link>
                </>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
