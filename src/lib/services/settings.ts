import "server-only";

import { cache } from "react";

import { getConfig } from "@/lib/config/env";
import { getRepository } from "@/lib/data";
import { parseSheetBoolean } from "@/lib/data/sheet-schema";
import type { ReportSettings } from "@/lib/domain/types";

/**
 * Who receives the weekly reports.
 *
 * The specification makes managing report recipients a system administrator
 * task, so the Settings tab in the Google Sheet wins over the environment
 * variables: recipients can be changed without a redeploy. Anything left blank
 * in the sheet falls back to the environment.
 */
export const getReportSettings = cache(async (): Promise<ReportSettings> => {
  const config = getConfig();
  const fromSheet: string[] = [];

  let sheet: Record<string, string> = {};
  try {
    sheet = await getRepository().readSettings();
  } catch {
    // An unreachable sheet must not stop a report going out.
  }

  const take = (key: string): string | null => {
    const value = sheet[key]?.trim();
    if (!value) return null;
    fromSheet.push(key);
    return value;
  };

  const hrRecipient = take("hrRecipient") ?? config.hrRecipient;
  const reportCcRaw = take("reportCc");
  const managerReportsRaw = take("managerReportsEnabled");
  const skipEmptyRaw = take("skipEmptyManagerReports");

  return {
    hrRecipient,
    reportCc: reportCcRaw
      ? reportCcRaw
          .split(/[,;]/)
          .map((entry) => entry.trim())
          .filter(Boolean)
      : config.reportCc,
    managerReportsEnabled: managerReportsRaw
      ? parseSheetBoolean(managerReportsRaw, config.managerReportsEnabled)
      : config.managerReportsEnabled,
    skipEmptyManagerReports: skipEmptyRaw
      ? parseSheetBoolean(skipEmptyRaw, config.skipEmptyManagerReports)
      : config.skipEmptyManagerReports,
    fromSheet,
  };
});
