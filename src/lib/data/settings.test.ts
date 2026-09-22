import { describe, expect, it } from "vitest";

import {
  RULE_SETTING_KEYS,
  SETTINGS_ROWS,
  parseSheetBoolean,
  settingKeyFor,
} from "@/lib/data/sheet-schema";

describe("settings tab", () => {
  it("covers every report setting an administrator can change", () => {
    expect(SETTINGS_ROWS.map((row) => row.key)).toEqual(
      expect.arrayContaining([
        "hrRecipient",
        "reportCc",
        "managerReportsEnabled",
        "skipEmptyManagerReports",
      ]),
    );
  });

  it("gives every contract rule a row people can edit", () => {
    const keys = SETTINGS_ROWS.map((row) => row.key);
    for (const key of RULE_SETTING_KEYS) expect(keys).toContain(key);
  });

  it("explains every setting and offers a starting value", () => {
    for (const row of SETTINGS_ROWS) {
      expect(row.label.length).toBeGreaterThan(3);
      expect(row.note.length).toBeGreaterThan(10);
      expect(settingKeyFor(row.label)).toBe(row.key);
    }
  });

  it("matches labels however they are typed in the sheet", () => {
    expect(settingKeyFor("HR Report Email")).toBe("hrRecipient");
    expect(settingKeyFor("hr report email")).toBe("hrRecipient");
    expect(settingKeyFor(" HR  Report-Email ")).toBe("hrRecipient");
    expect(settingKeyFor("Something else")).toBeNull();
  });

  it("reads the yes/no answers people actually write", () => {
    for (const yes of ["Yes", "yes", "Y", "TRUE", "1", "on"]) {
      expect(parseSheetBoolean(yes, false)).toBe(true);
    }
    for (const no of ["No", "n", "false", "0", "OFF"]) {
      expect(parseSheetBoolean(no, true)).toBe(false);
    }
  });

  it("keeps the configured value when the cell is blank or unclear", () => {
    expect(parseSheetBoolean("", true)).toBe(true);
    expect(parseSheetBoolean("   ", false)).toBe(false);
    expect(parseSheetBoolean("maybe", true)).toBe(true);
  });
});
