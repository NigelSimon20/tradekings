import { BILLBOARD_FLAG_META } from "@/lib/billboards/meta";
import { BILLBOARD_RULES, type BillboardRules } from "@/lib/billboards/rules";
import {
  PHOTO_CATEGORIES,
  type Billboard,
  type BillboardData,
  type BillboardFlag,
  type Campaign,
  type EvaluatedBillboard,
  type LeaseStatus,
} from "@/lib/billboards/types";
import { addDays, daysBetween, isBefore, isOnOrBefore, type ISODate } from "@/lib/date/dates";

/**
 * The billboard rules engine. Like the contract one it is pure — data and a
 * date in, calculated fields out — so the tests can pin every rule to a fixed
 * day.
 */
export function evaluateBillboards(
  data: Pick<BillboardData, "billboards" | "campaigns" | "files">,
  options: { today: ISODate; rules?: BillboardRules },
): EvaluatedBillboard[] {
  const { today, rules = BILLBOARD_RULES } = options;

  const campaignsBySite = groupBy(data.campaigns, (campaign) => campaign.billboardId);
  const filesBySite = groupBy(
    data.files.filter((file) => !file.removed),
    (file) => file.billboardId,
  );

  return data.billboards.map((billboard) => {
    const campaigns = campaignsBySite.get(billboard.id) ?? [];
    const files = filesBySite.get(billboard.id) ?? [];

    const leaseDaysRemaining = billboard.leaseExpiry ? daysBetween(today, billboard.leaseExpiry) : null;
    const leaseStatus = resolveLeaseStatus(billboard, leaseDaysRemaining, rules);
    const noticeDeadline =
      billboard.leaseExpiry && billboard.noticePeriodDays
        ? addDays(billboard.leaseExpiry, -billboard.noticePeriodDays)
        : null;

    const currentCampaign = latestBy(
      campaigns.filter((campaign) => isRunning(campaign, today)),
      (campaign) => campaign.startDate ?? "",
    );
    const nextCampaign = earliestBy(
      campaigns.filter((campaign) => campaign.startDate && isBefore(today, campaign.startDate)),
      (campaign) => campaign.startDate ?? "",
    );
    const inspectionOverdue = Boolean(
      billboard.nextInspection && isBefore(billboard.nextInspection, today),
    );
    const hasLocation = billboard.latitude !== null && billboard.longitude !== null;
    const hasLeaseDocument =
      Boolean(billboard.leaseDocumentUrl.trim()) ||
      files.some((file) => file.category === "Lease agreement");

    const flags: BillboardFlag[] = [];
    if (leaseStatus === "EXPIRED") {
      flags.push({ code: "LEASE_EXPIRED", detail: `Expired ${Math.abs(leaseDaysRemaining ?? 0)} days ago` });
    }
    if (leaseStatus === "EXPIRING_30") {
      flags.push({ code: "LEASE_EXPIRING_30", detail: `${leaseDaysRemaining} days left` });
    }
    if (
      noticeDeadline &&
      leaseStatus !== "EXPIRED" &&
      daysBetween(today, noticeDeadline) <= rules.noticeAlertDays
    ) {
      flags.push({ code: "NOTICE_DUE", detail: `Notice due by ${noticeDeadline}` });
    }
    if (inspectionOverdue) {
      flags.push({ code: "INSPECTION_OVERDUE", detail: `Was due ${billboard.nextInspection}` });
    }
    if (billboard.siteCondition === "Poor" || billboard.siteCondition === "Damaged") {
      flags.push({ code: "CONDITION_POOR", detail: billboard.siteCondition });
    }
    if (billboard.maintenanceIssues.trim()) flags.push({ code: "OPEN_ISSUES" });
    if (
      !currentCampaign &&
      campaigns.some(
        (campaign) => campaign.endDate && isBefore(campaign.endDate, today) && !campaign.removedOn,
      )
    ) {
      flags.push({ code: "CAMPAIGN_NOT_REMOVED" });
    }
    if (billboard.followUp) {
      flags.push({ code: "FOLLOW_UP", detail: billboard.followUpNote.trim() || undefined });
    }
    if (!hasLocation) flags.push({ code: "MISSING_LOCATION" });
    if ((billboard.leaseStart || billboard.leaseExpiry) && !hasLeaseDocument) {
      flags.push({ code: "NO_LEASE_DOCUMENT" });
    }

    const photoCount = files.filter((file) => PHOTO_CATEGORIES.includes(file.category)).length;
    const cover = latestBy(
      files.filter(
        (file) => file.category === "Site photo" && file.storedFileId && file.mimeType.startsWith("image/"),
      ),
      (file) => file.addedAt,
    );

    return {
      ...billboard,
      computed: {
        leaseStatus,
        leaseDaysRemaining,
        noticeDeadline,
        currentCampaign,
        nextCampaign,
        inspectionOverdue,
        hasLocation,
        flags,
        needsFollowUp: flags.some((flag) => BILLBOARD_FLAG_META[flag.code].followUp),
        photoCount,
        documentCount: files.length - photoCount,
        coverPhotoId: cover?.id ?? null,
      },
    };
  });
}

function resolveLeaseStatus(
  billboard: Billboard,
  daysRemaining: number | null,
  rules: BillboardRules,
): LeaseStatus {
  if (daysRemaining === null) return billboard.leaseStart ? "ACTIVE" : "NO_LEASE";
  if (daysRemaining < 0) return "EXPIRED";
  if (daysRemaining <= rules.leaseAlertDays.second) return "EXPIRING_30";
  if (daysRemaining <= rules.leaseAlertDays.first) return "EXPIRING_90";
  return "ACTIVE";
}

/** Up today: started, not yet ended, and not taken down early. */
function isRunning(campaign: Campaign, today: ISODate): boolean {
  if (!campaign.startDate || isBefore(today, campaign.startDate)) return false;
  if (campaign.endDate && isBefore(campaign.endDate, today)) return false;
  if (campaign.removedOn && isOnOrBefore(campaign.removedOn, today)) return false;
  return true;
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const group = groups.get(key(item));
    if (group) group.push(item);
    else groups.set(key(item), [item]);
  }
  return groups;
}

function latestBy<T>(items: T[], key: (item: T) => string): T | null {
  return items.reduce<T | null>((best, item) => (!best || key(item) > key(best) ? item : best), null);
}

function earliestBy<T>(items: T[], key: (item: T) => string): T | null {
  return items.reduce<T | null>((best, item) => (!best || key(item) < key(best) ? item : best), null);
}
