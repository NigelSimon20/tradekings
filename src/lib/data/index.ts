import "server-only";

import { getConfig } from "@/lib/config/env";
import { GoogleSheetsRepository } from "@/lib/data/google-sheets-repository";
import { LocalJsonRepository } from "@/lib/data/local-repository";
import type { ContractRepository } from "@/lib/data/repository";

let repository: ContractRepository | null = null;

/**
 * Chooses the data source once per process: the Google Sheet when service
 * account credentials are configured, otherwise the local sample file.
 */
export function getRepository(): ContractRepository {
  if (repository) return repository;

  const config = getConfig();
  repository =
    config.dataSource === "google-sheets" && config.google
      ? new GoogleSheetsRepository(config.google)
      : new LocalJsonRepository(config.localDataFile, config.timezone);

  return repository;
}

/** Test seam — forces the next call to rebuild the repository. */
export function resetRepository(): void {
  repository = null;
}
