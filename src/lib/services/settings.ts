import "server-only";

import { cache } from "react";

import { applyRuleOverrides, type RulesConfig } from "@/lib/config/rules";
import { getConfig } from "@/lib/config/env";
import { getRepository } from "@/lib/data";
import { RULE_SETTING_KEYS, parseSheetBoolean } from "@/lib/data/sheet-schema";
import type { ReportSettings } from "@/lib/domain/types";

/** The Settings tab, read once per request. */
const readSettings = cache(async (): Promise<Record<string, string>> => {
  try {
    return await getRepository().readSettings();
  } catch {
    // An unreachable settings tab must never stop the tracker working.
    return {};
  }
});

/**
 * The contract rules in force: the shipped defaults, with any numbers an
 * administrator has typed on the Settings tab applied over them.
 */
export const getRulesConfig = cache(
  async (): Promise<{ rules: RulesConfig; fromSheet: string[] }> => {
    const settings = await readSettings();
    const fromSheet = RULE_SETTING_KEYS.filter((key) => settings[key]?.trim());
    return { rules: applyRuleOverrides(settings), fromSheet };
  },
);

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

  const sheet = await readSettings();

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
