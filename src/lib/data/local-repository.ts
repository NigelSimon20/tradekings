import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { isServerless } from "@/lib/config/env";
import {
  RepositoryError,
  companyPrefix,
  generateContractId,
  type ContractRepository,
  type RepositoryHealth,
} from "@/lib/data/repository";
import { buildSeedContracts } from "@/lib/data/seed";
import type { SheetSetupResult } from "@/lib/data/sheet-setup";
import type { SheetUser } from "@/lib/data/sheet-schema";
import { todayIn } from "@/lib/date/dates";
import type { Contract, ContractInput, EvaluatedContract, RunLogEntry } from "@/lib/domain/types";

interface LocalStore {
  version: 1;
  contracts: Contract[];
  runLog: RunLogEntry[];
}

/**
 * File-backed store used for local development and demos, so the UI can be run
 * without Google credentials. It mirrors the Google Sheet repository exactly.
 */
export class LocalJsonRepository implements ContractRepository {
  readonly kind = "local" as const;
  readonly label = "Local JSON file";

  private readonly file: string;
  /** Serialises writes so concurrent requests cannot clobber the file. */
  private queue: Promise<unknown> = Promise.resolve();
  /** Held in memory when the filesystem cannot be written to (hosted demos). */
  private memory: LocalStore | null = null;
  /**
   * Hosted runtimes have a read-only filesystem, and the failure they give for
   * a write varies (EROFS, EACCES, ENOENT…). Rather than guess at codes, the
   * store keeps everything in memory whenever it is running serverless, and
   * falls back to memory if any write fails anyway.
   */
  private readOnly = isServerless();

  constructor(filePath: string, private readonly timezone: string) {
    // turbopackIgnore: the path is configuration, not a module to trace.
    this.file = path.isAbsolute(filePath)
      ? filePath
      : path.join(/* turbopackIgnore: true */ process.cwd(), filePath);
  }

  /** True once a write has failed, e.g. on a hosted read-only filesystem. */
  get isReadOnly(): boolean {
    return this.readOnly;
  }

  private async read(): Promise<LocalStore> {
    if (this.memory) return this.memory;

    if (this.readOnly) {
      this.memory = {
        version: 1,
        contracts: buildSeedContracts(todayIn(this.timezone)),
        runLog: [],
      };
      return this.memory;
    }

    try {
      const raw = await readFile(this.file, "utf8");
      const parsed = JSON.parse(raw) as Partial<LocalStore>;
      return {
        version: 1,
        contracts: parsed.contracts ?? [],
        runLog: parsed.runLog ?? [],
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        const store: LocalStore = {
          version: 1,
          contracts: buildSeedContracts(todayIn(this.timezone)),
          runLog: [],
        };
        await this.write(store);
        return this.memory ?? store;
      }
      throw new RepositoryError(`The sample database could not be opened: ${(error as Error).message}`, {
        cause: error,
      });
    }
  }

  private async write(store: LocalStore): Promise<void> {
    if (this.readOnly) {
      this.memory = store;
      return;
    }

    try {
      await mkdir(path.dirname(this.file), { recursive: true });
      await writeFile(this.file, `${JSON.stringify(store, null, 2)}\n`, "utf8");
    } catch (error) {
      // Sample data must never take the tracker down: if it cannot be written,
      // carry on in memory and say so in the health check.
      console.warn("Sample data could not be saved, continuing in memory:", (error as Error).message);
      this.readOnly = true;
      this.memory = store;
    }
  }

  /** Runs a read-modify-write cycle with no interleaving. */
  private mutate<T>(operation: (store: LocalStore) => Promise<T> | T): Promise<T> {
    const run = this.queue.then(async () => {
      const store = await this.read();
      const result = await operation(store);
      await this.write(store);
      return result;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  async listContracts(): Promise<Contract[]> {
    // The file is local, so there is nothing to cache.
    const store = await this.read();
    return store.contracts;
  }

  async createContract(input: ContractInput): Promise<Contract> {
    return this.mutate((store) => {
      const contract: Contract = {
        ...input,
        id: input.id?.trim() || generateContractId(companyPrefix(input.company)),
        lastUpdated: new Date().toISOString(),
        lastUpdatedBy: input.lastUpdatedBy ?? "",
      };
      store.contracts.push(contract);
      return contract;
    });
  }

  async createContracts(inputs: ContractInput[]): Promise<Contract[]> {
    if (!inputs.length) return [];
    return this.mutate((store) => {
      const timestamp = new Date().toISOString();
      const created = inputs.map((input) => ({
        ...input,
        id: input.id?.trim() || generateContractId(companyPrefix(input.company)),
        lastUpdated: timestamp,
        lastUpdatedBy: input.lastUpdatedBy ?? "",
      }));
      store.contracts.push(...created);
      return created;
    });
  }

  async updateContract(id: string, patch: Partial<ContractInput>): Promise<Contract> {
    return this.mutate((store) => {
      const index = store.contracts.findIndex((contract) => contract.id === id);
      if (index === -1) throw new RepositoryError(`Contract ${id} was not found.`);
      const updated: Contract = {
        ...store.contracts[index],
        ...patch,
        id,
        lastUpdated: new Date().toISOString(),
        lastUpdatedBy: patch.lastUpdatedBy ?? store.contracts[index].lastUpdatedBy,
      };
      store.contracts[index] = updated;
      return updated;
    });
  }

  /** The local store holds raw data only — calculated fields are derived on read. */
  async writeCalculatedColumns(rows: EvaluatedContract[]): Promise<number> {
    return rows.length;
  }

  /** There is no sheet to write a dashboard into; the app shows it instead. */
  async writeDashboard(): Promise<boolean> {
    return false;
  }

  /** Report settings come from the environment when running on sample data. */
  async readSettings(): Promise<Record<string, string>> {
    return {};
  }

  /** Sample data has no user list; the bootstrap administrators apply. */
  async listUsers(): Promise<SheetUser[]> {
    return [];
  }

  async recordSignIn(): Promise<void> {
    // Nothing to stamp without a sheet.
  }

  async appendRunLog(entry: RunLogEntry): Promise<void> {
    await this.mutate((store) => {
      store.runLog.push(entry);
      // Keep the file small; the sheet keeps the full history in production.
      if (store.runLog.length > 200) store.runLog.splice(0, store.runLog.length - 200);
    });
  }

  async listRunLog(limit = 20): Promise<RunLogEntry[]> {
    const store = await this.read();
    return [...store.runLog].reverse().slice(0, limit);
  }

  /** The sample database needs no setting up. */
  async setUpStorage(): Promise<SheetSetupResult> {
    return {
      ok: false,
      createdTabs: [],
      addedColumns: [],
      addedSettings: [],
      colourCoded: false,
      messages: ["There is no Google Sheet connected yet, so there is nothing to set up."],
    };
  }

  async healthCheck(): Promise<RepositoryHealth> {
    const store = await this.read();
    return {
      ok: true,
      detail: `${store.contracts.length} contracts in the built-in sample database`,
      warnings: [
        this.readOnly
          ? "The live Google Sheet is not connected yet. This is practice data, and changes made here are not saved."
          : "The live Google Sheet is not connected yet, so this is practice data.",
      ],
    };
  }
}
