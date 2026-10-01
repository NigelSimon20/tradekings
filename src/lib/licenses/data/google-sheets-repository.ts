import type { BillboardSheetConfig } from "@/lib/config/env";
import type { RepositoryHealth } from "@/lib/data/repository";
import { SheetBook } from "@/lib/data/sheet-book";
import type { LicenseRepository } from "@/lib/licenses/data/repository";
import {
  ASSETS_TABLE,
  DOCUMENTS_TABLE,
  LICENSE_ACTIVITY_TABLE,
  LICENSE_TABLES,
  LICENSES_TABLE,
  RENEWALS_TABLE,
} from "@/lib/licenses/data/sheet-tables";
import type {
  Asset,
  License,
  LicenseActivity,
  LicenseData,
  LicenseDocument,
  Renewal,
} from "@/lib/licenses/types";

/** The license spreadsheet: its own Google Sheet, one tab per record type. */
export class GoogleSheetsLicenseRepository implements LicenseRepository {
  readonly kind = "google-sheets" as const;
  readonly label = "License Google Sheet";
  private readonly book: SheetBook;

  constructor(config: BillboardSheetConfig) {
    this.book = new SheetBook(config, LICENSE_TABLES);
  }

  async readAll(fresh = false): Promise<LicenseData> {
    if (fresh) await this.book.refresh();
    const [assets, licenses, renewals, documents, activity] = await Promise.all([
      this.book.records(ASSETS_TABLE),
      this.book.records(LICENSES_TABLE),
      this.book.records(RENEWALS_TABLE),
      this.book.records(DOCUMENTS_TABLE),
      this.book.records(LICENSE_ACTIVITY_TABLE),
    ]);
    return { assets, licenses, renewals, documents, activity };
  }

  saveAsset(asset: Asset): Promise<void> {
    return this.book.upsert(ASSETS_TABLE, asset);
  }

  saveLicense(license: License): Promise<void> {
    return this.book.upsert(LICENSES_TABLE, license);
  }

  addRenewal(renewal: Renewal): Promise<void> {
    return this.book.append(RENEWALS_TABLE, [renewal]);
  }

  saveDocument(document: LicenseDocument): Promise<void> {
    return this.book.upsert(DOCUMENTS_TABLE, document);
  }

  appendActivity(entries: LicenseActivity[]): Promise<void> {
    return this.book.append(LICENSE_ACTIVITY_TABLE, entries);
  }

  readSetting(key: string): Promise<string | null> {
    return this.book.readSetting(key);
  }

  saveSetting(key: string, value: string | null): Promise<void> {
    return this.book.saveSetting(key, value);
  }

  async appendAll(data: LicenseData): Promise<void> {
    // One tab at a time, to stay well inside the Sheets write quota.
    await this.book.append(ASSETS_TABLE, data.assets);
    await this.book.append(LICENSES_TABLE, data.licenses);
    await this.book.append(RENEWALS_TABLE, data.renewals);
    await this.book.append(DOCUMENTS_TABLE, data.documents);
    await this.book.append(LICENSE_ACTIVITY_TABLE, data.activity);
  }

  async healthCheck(): Promise<RepositoryHealth> {
    try {
      const { title, missingTabs, missingHeadings } = await this.book.inspect();
      if (missingTabs.length) {
        return {
          ok: false,
          detail: `Connected to “${title}”`,
          warnings: [`Missing tabs: ${missingTabs.join(", ")}. Press “Prepare the license sheet”.`],
        };
      }
      const { licenses, assets } = await this.readAll();
      return {
        ok: true,
        detail: `Connected to “${title}” — ${licenses.length} licenses across ${assets.length} assets`,
        warnings: missingHeadings,
      };
    } catch (error) {
      return { ok: false, detail: (error as Error).message, warnings: [] };
    }
  }

  async setUpStorage(): Promise<{ ok: boolean; messages: string[] }> {
    return { ok: true, messages: await this.book.setUp() };
  }
}
