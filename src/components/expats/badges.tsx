import { Badge } from "@/components/ui/badge";
import { describeDays, formatDate } from "@/lib/date/dates";
import type { Tone } from "@/lib/domain/meta";
import { APPLICATION_STATUS_TONE, EXPIRY_STATUS_META, PROFILE_STATUS_META } from "@/lib/expats/meta";
import type { ApplicationStatus, ExpiryItem, ExpiryStatus, ProfileStatus } from "@/lib/expats/types";

export function ProfileStatusBadge({ status }: { status: ProfileStatus }) {
  const meta = PROFILE_STATUS_META[status];
  return (
    <Badge tone={meta.tone} title={meta.description}>
      {meta.label}
    </Badge>
  );
}

export function ExpiryBadge({ status, reminderDays }: { status: ExpiryStatus; reminderDays?: number | null }) {
  const meta = EXPIRY_STATUS_META[status];
  return (
    <Badge tone={meta.tone}>
      {meta.label}
      {status === "EXPIRING" && reminderDays ? ` · ${reminderDays}-day` : ""}
    </Badge>
  );
}

export function ApplicationBadge({ status }: { status: ApplicationStatus }) {
  return <Badge tone={APPLICATION_STATUS_TONE[status]}>{status}</Badge>;
}

export function ToneBadge({ tone, children }: { tone: Tone; children: string }) {
  return <Badge tone={tone}>{children}</Badge>;
}

/** "12 Mar 2027 · in 157 days", with the status badge, for any watched date. */
export function ExpiryCell({ item }: { item: ExpiryItem | null }) {
  if (!item) return <span className="text-slate-400">—</span>;
  return (
    <span className="flex flex-col items-start gap-1">
      <span className="numeric">
        {formatDate(item.expiryDate)} <span className="text-xs text-slate-500">· {describeDays(item.daysRemaining)}</span>
      </span>
      <span className="flex flex-wrap gap-1">
        <ExpiryBadge status={item.status} reminderDays={item.reminderDays} />
        {item.renewalInProgress && item.status !== "VALID" ? <Badge tone="info">Being handled</Badge> : null}
      </span>
    </span>
  );
}

/** A value hidden from someone without "See sensitive details". */
export function Hidden() {
  return (
    <span className="text-xs text-slate-400 italic" title="Your role cannot see sensitive details">
      Hidden
    </span>
  );
}
