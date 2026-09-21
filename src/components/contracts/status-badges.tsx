import { Badge } from "@/components/ui/badge";
import {
  FLAG_META,
  LIMIT_STATUS_META,
  REHIRE_STATUS_META,
  RENEWAL_STATUS_META,
  STATUS_META,
} from "@/lib/domain/meta";
import type {
  ContractFlag,
  ContractStatus,
  LimitStatus,
  RehireStatus,
  RenewalStatus,
} from "@/lib/domain/types";

/** Colour-coded contract status — the same colours used in the weekly email. */
export function StatusBadge({ status }: { status: ContractStatus }) {
  const meta = STATUS_META[status];
  return (
    <Badge tone={meta.tone} title={meta.description}>
      {meta.label}
    </Badge>
  );
}

export function LimitBadge({ status, count, max }: { status: LimitStatus; count?: number; max?: number | null }) {
  const meta = LIMIT_STATUS_META[status];
  return (
    <Badge tone={meta.tone} title={meta.description}>
      {meta.label}
      {count !== undefined && max ? ` · ${count}/${max}` : null}
    </Badge>
  );
}

export function RehireBadge({ status }: { status: RehireStatus }) {
  if (status === "NOT_APPLICABLE") return <span className="text-slate-400">—</span>;
  const meta = REHIRE_STATUS_META[status];
  return (
    <Badge tone={meta.tone} title={meta.description}>
      {meta.label}
    </Badge>
  );
}

export function RenewalBadge({ status }: { status: RenewalStatus }) {
  return <Badge tone={RENEWAL_STATUS_META[status].tone}>{status}</Badge>;
}

/** Contract-limit, rehire and data-quality flags for a row. */
export function FlagBadges({ flags, limit }: { flags: ContractFlag[]; limit?: number }) {
  if (!flags.length) return <span className="text-slate-400">—</span>;

  const shown = limit ? flags.slice(0, limit) : flags;
  const hidden = flags.length - shown.length;

  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((flag) => (
        <Badge
          key={flag.code}
          tone={FLAG_META[flag.code].tone}
          title={flag.detail ?? FLAG_META[flag.code].description}
        >
          {FLAG_META[flag.code].label}
        </Badge>
      ))}
      {hidden > 0 ? <Badge tone="neutral">+{hidden}</Badge> : null}
    </div>
  );
}
