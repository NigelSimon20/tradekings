import { Badge } from "@/components/ui/badge";
import { LICENSE_FLAG_META, LICENSE_STATUS_META } from "@/lib/licenses/meta";
import type { LicenseFlag, LicenseStatus } from "@/lib/licenses/types";

export function LicenseStatusBadge({ status, reminderDays }: { status: LicenseStatus; reminderDays?: number | null }) {
  const meta = LICENSE_STATUS_META[status];
  return (
    <Badge tone={meta.tone}>
      {meta.label}
      {status === "EXPIRING" && reminderDays ? ` · ${reminderDays}-day` : ""}
    </Badge>
  );
}

/** Flags worth a person's attention; the quieter ones only when asked for. */
export function LicenseFlagBadges({ flags, limit }: { flags: LicenseFlag[]; limit?: number }) {
  if (!flags.length) return <span className="text-slate-400">—</span>;
  const shown = limit ? flags.slice(0, limit) : flags;
  return (
    <span className="flex flex-wrap gap-1">
      {shown.map((flag) => {
        const meta = LICENSE_FLAG_META[flag.code];
        return (
          <Badge key={flag.code} tone={meta.tone} title={flag.detail ? `${meta.description} (${flag.detail})` : meta.description}>
            {meta.label}
          </Badge>
        );
      })}
      {limit && flags.length > limit ? <Badge tone="neutral">+{flags.length - limit}</Badge> : null}
    </span>
  );
}
