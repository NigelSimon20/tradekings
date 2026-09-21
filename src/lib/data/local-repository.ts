import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  RepositoryError,
  companyPrefix,
  generateContractId,
  type ContractRepository,
  type RepositoryHealth,
} from "@/lib/data/repository";
import { buildSeedContracts } from "@/lib/data/seed";
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

  constructor(filePath: string, private readonly timezone: string) {
    // turbopackIgnore: the path is configuration, not a module to trace.
    this.file = path.isAbsolute(filePath)
      ? filePath
      : path.join(/* turbopackIgnore: true */ process.cwd(), filePath);
  }

  private async read(): Promise<LocalStore> {
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
        return store;
      }
      throw new RepositoryError(`The sample database could not be opened: ${(error as Error).message}`, {
        cause: error,
      });
    }
  }

  private async write(store: LocalStore): Promise<void> {
    await mkdir(path.dirname(this.file), { recursive: true });
    await writeFile(this.file, `${JSON.stringify(store, null, 2)}\n`, "utf8");
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
    const store = await this.read();
    return store.contracts;
  }

  async createContract(input: ContractInput): Promise<Contract> {
    return this.mutate((store) => {
      const contract: Contract = {
        ...input,
        id: input.id?.trim() || generateContractId(companyPrefix(input.company)),
        lastUpdated: new Date().toISOString(),
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

  async healthCheck(): Promise<RepositoryHealth> {
    const store = await this.read();
    return {
      ok: true,
      detail: `${store.contracts.length} contracts in the built-in sample database`,
      warnings: ["The live Google Sheet is not connected yet, so this is practice data."],
    };
  }
}
