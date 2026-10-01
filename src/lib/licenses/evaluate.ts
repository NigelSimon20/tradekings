import { LICENSE_STATUS_META } from "@/lib/licenses/meta";
import { DEFAULT_LICENSE_RULES, type LicenseRules } from "@/lib/licenses/rules";
import {
  FREQUENCY_MONTHS,
  PENDING_RENEWAL,
  type Asset,
  type AssetSummary,
  type EvaluatedLicense,
  type LicenseData,
  type LicenseFlag,
  type LicenseStatus,
} from "@/lib/licenses/types";
import { addMonths, daysBetween, type ISODate } from "@/lib/date/dates";

/**
 * The License Tracker's rules engine. Pure — data and a date in, calculated
 * fields out — so every rule can be pinned to a fixed day in the tests.
 */
export function evaluateLicenses(
  data: Pick<LicenseData, "assets" | "licenses" | "documents">,
  options: { today: ISODate; rules?: LicenseRules },
): EvaluatedLicense[] {
  const { today, rules = DEFAULT_LICENSE_RULES } = options;
  const reminders = [...rules.reminderDays].sort((a, b) => a - b);
  const furthestReminder = reminders.at(-1) ?? 0;
  const assets = new Map(data.assets.map((asset) => [asset.id, asset]));

  return data.licenses.map((license) => {
    const asset = license.assetId ? (assets.get(license.assetId) ?? null) : null;
    const documents = data.documents.filter((document) => document.licenseId === license.id && !document.removed);
    const months = FREQUENCY_MONTHS[license.renewalFrequency] ?? null;
    const oneOff = license.renewalFrequency === "One-off (no expiry)";
    const notRenewing = license.renewalStatus === "Not renewing";
    const pendingRenewal = PENDING_RENEWAL.includes(license.renewalStatus);

    const daysRemaining = license.expiryDate ? daysBetween(today, license.expiryDate) : null;
    const nextRenewalDate =
      license.expiryDate ?? (license.lastRenewalDate && months ? addMonths(license.lastRenewalDate, months) : null);

    let status: LicenseStatus;
    if (!license.expiryDate) status = oneOff ? "NO_EXPIRY" : "NO_DATE";
    else if (daysRemaining! < 0) status = "EXPIRED";
    else if (daysRemaining! <= furthestReminder) status = "EXPIRING";
    else status = "ACTIVE";

    // The tightest reminder window it has entered: 25 days left is the 30-day window.
    const reminderDays =
      status === "EXPIRING" ? (reminders.find((threshold) => daysRemaining! <= threshold) ?? null) : null;

    const flags: LicenseFlag[] = [];
    if (status === "EXPIRED" && !pendingRenewal && !notRenewing) {
      flags.push({ code: "RENEWAL_OVERDUE", detail: `Expired ${Math.abs(daysRemaining!)} days ago` });
    }
    if (pendingRenewal) flags.push({ code: "RENEWAL_PENDING", detail: license.renewalStatus });
    if (status === "EXPIRING" && !pendingRenewal && !notRenewing) {
      flags.push({ code: "REMINDER_DUE", detail: `${daysRemaining} days left — ${reminderDays}-day reminder` });
    }
    if (status === "NO_DATE" && !notRenewing) flags.push({ code: "NO_EXPIRY_DATE" });
    if (license.assetId && !asset) flags.push({ code: "ASSET_MISSING", detail: license.assetId });
    if (!documents.some((document) => document.category === "License / certificate")) {
      flags.push({ code: "NO_DOCUMENT" });
    }
    if (!license.responsibleName.trim() && !license.responsibleEmail.trim()) {
      flags.push({ code: "NO_RESPONSIBLE_PERSON" });
    }

    const needsAction = flags.some((flag) =>
      ["RENEWAL_OVERDUE", "REMINDER_DUE", "NO_EXPIRY_DATE", "ASSET_MISSING"].includes(flag.code),
    );

    return {
      ...license,
      computed: {
        status,
        daysRemaining,
        nextRenewalDate,
        reminderDays,
        pendingRenewal,
        needsAction,
        flags,
        asset,
        documentCount: documents.length,
      },
    };
  });
}

/** Each asset with its licenses and its most urgent status, for the map and asset list. */
export function summariseAssets(assets: Asset[], licenses: EvaluatedLicense[]): AssetSummary[] {
  return assets.map((asset) => {
    const own = licenses.filter((license) => license.assetId === asset.id && !license.archived);
    const worst = own.reduce<LicenseStatus | null>((current, license) => {
      if (!current) return license.computed.status;
      return LICENSE_STATUS_META[license.computed.status].priority < LICENSE_STATUS_META[current].priority
        ? license.computed.status
        : current;
    }, null);
    return {
      asset,
      licenses: own,
      worstStatus: worst,
      needsAction: own.filter((license) => license.computed.needsAction).length,
      hasLocation: asset.latitude !== null && asset.longitude !== null,
    };
  });
}
