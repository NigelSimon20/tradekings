import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { BillboardRepository, BillboardSetupResult } from "@/lib/billboards/data/repository";
import { buildSeedBillboards } from "@/lib/billboards/data/seed";
import type {
  ActivityEntry,
  Billboard,
  BillboardData,
  BillboardFile,
  Campaign,
  MaintenanceRecord,
} from "@/lib/billboards/types";
import { isServerless } from "@/lib/config/env";
import { RepositoryError, type RepositoryHealth } from "@/lib/data/repository";
import { todayIn } from "@/lib/date/dates";

interface LocalBillboardStore extends BillboardData {
  version: 1;
}

/**
 * File-backed billboard store for development and demos, seeded with a sample
 * network on first use. Mirrors the contract tracker's local store: writes are
 * serialised, and a read-only filesystem falls back to memory.
 */
export class LocalBillboardRepository implements BillboardRepository {
  readonly kind = "local" as const;
  readonly label = "Local sample file";

  private readonly file: string;
  private queue: Promise<unknown> = Promise.resolve();
  private memory: LocalBillboardStore | null = null;
  private readOnly = isServerless();

  constructor(filePath: string, private readonly timezone: string) {
    this.file = path.isAbsolute(filePath)
      ? filePath
      : path.join(/* turbopackIgnore: true */ process.cwd(), filePath);
  }

  private seed(): LocalBillboardStore {
    return { version: 1, ...buildSeedBillboards(todayIn(this.timezone)) };
  }

  private async read(): Promise<LocalBillboardStore> {
    if (this.memory) return this.memory;
    if (this.readOnly) {
      this.memory = this.seed();
      return this.memory;
    }

    try {
      const parsed = JSON.parse(await readFile(this.file, "utf8")) as Partial<LocalBillboardStore>;
      return {
        version: 1,
        billboards: parsed.billboards ?? [],
        campaigns: parsed.campaigns ?? [],
        maintenance: parsed.maintenance ?? [],
        files: parsed.files ?? [],
        activity: parsed.activity ?? [],
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        const store = this.seed();
        await this.write(store);
        return this.memory ?? store;
      }
      throw new RepositoryError(
        `The sample billboard data could not be opened: ${(error as Error).message}`,
        { cause: error },
      );
    }
  }

  private async write(store: LocalBillboardStore): Promise<void> {
    if (this.readOnly) {
      this.memory = store;
      return;
    }
    try {
      await mkdir(path.dirname(this.file), { recursive: true });
      await writeFile(this.file, `${JSON.stringify(store, null, 2)}\n`, "utf8");
    } catch (error) {
      console.warn("Sample billboard data could not be saved, continuing in memory:", (error as Error).message);
      this.readOnly = true;
      this.memory = store;
    }
  }

  private mutate(operation: (store: LocalBillboardStore) => void): Promise<void> {
    const run = this.queue.then(async () => {
      const store = await this.read();
      operation(store);
      await this.write(store);
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  async readAll(): Promise<BillboardData> {
    const { billboards, campaigns, maintenance, files, activity } = await this.read();
    return { billboards, campaigns, maintenance, files, activity };
  }

  saveBillboard(billboard: Billboard): Promise<void> {
    return this.mutate((store) => upsert(store.billboards, billboard));
  }

  addCampaign(campaign: Campaign): Promise<void> {
    return this.mutate((store) => void store.campaigns.push(campaign));
  }

  addMaintenance(record: MaintenanceRecord): Promise<void> {
    return this.mutate((store) => void store.maintenance.push(record));
  }

  saveFile(file: BillboardFile): Promise<void> {
    return this.mutate((store) => upsert(store.files, file));
  }

  appendActivity(entries: ActivityEntry[]): Promise<void> {
    return this.mutate((store) => void store.activity.push(...entries));
  }

  appendAll(data: BillboardData): Promise<void> {
    return this.mutate((store) => {
      store.billboards.push(...data.billboards);
      store.campaigns.push(...data.campaigns);
      store.maintenance.push(...data.maintenance);
      store.files.push(...data.files);
      store.activity.push(...data.activity);
    });
  }

  async healthCheck(): Promise<RepositoryHealth> {
    const { billboards } = await this.read();
    return {
      ok: true,
      detail: `Sample data — ${billboards.length} billboards`,
      warnings: this.readOnly
        ? ["Changes are kept in memory only and will be lost when the server restarts."]
        : [],
    };
  }

  async setUpStorage(): Promise<BillboardSetupResult> {
    return {
      ok: false,
      messages: [
        "There is no billboard spreadsheet to set up yet. Ask your system administrator to set GOOGLE_BILLBOARDS_SHEET_ID first.",
      ],
    };
  }
}

function upsert<T extends { id: string }>(rows: T[], record: T): void {
  const position = rows.findIndex((row) => row.id === record.id);
  if (position === -1) rows.push(record);
  else rows[position] = record;
}
