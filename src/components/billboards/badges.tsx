import { Badge } from "@/components/ui/badge";
import {
  BILLBOARD_FLAG_META,
  BILLBOARD_STATUS_META,
  CONDITION_TONES,
  LEASE_STATUS_META,
} from "@/lib/billboards/meta";
import type { BillboardFlag, BillboardStatus, LeaseStatus, SiteCondition } from "@/lib/billboards/types";

export function BillboardStatusBadge({ status }: { status: BillboardStatus }) {
  const meta = BILLBOARD_STATUS_META[status];
  return (
    <Badge tone={meta.tone} title={meta.description}>
      {status}
    </Badge>
  );
}

export function LeaseBadge({ status }: { status: LeaseStatus }) {
  const meta = LEASE_STATUS_META[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function ConditionBadge({ condition }: { condition: SiteCondition | "" }) {
  if (!condition) return <span className="text-slate-400">Not recorded</span>;
  return <Badge tone={CONDITION_TONES[condition]}>{condition}</Badge>;
}

export function BillboardFlagBadges({ flags, limit }: { flags: BillboardFlag[]; limit?: number }) {
  if (!flags.length) return <span className="text-slate-400">—</span>;
  const shown = limit ? flags.slice(0, limit) : flags;
  return (
    <span className="flex flex-wrap gap-1">
      {shown.map((flag) => {
        const meta = BILLBOARD_FLAG_META[flag.code];
        return (
          <Badge
            key={flag.code}
            tone={meta.tone}
            title={flag.detail ? `${meta.description} (${flag.detail})` : meta.description}
          >
            {meta.label}
          </Badge>
        );
      })}
      {limit && flags.length > limit ? <Badge tone="neutral">+{flags.length - limit}</Badge> : null}
    </span>
  );
}
