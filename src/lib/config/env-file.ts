import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Settings listed more than once in a local env file.
 *
 * The last entry wins, so a stray blank line left over from the example file
 * silently replaces a real value — which has already caused a signing key and a
 * sending address to be quietly ignored. Worth surfacing rather than debugging
 * twice.
 */
export function duplicateEnvKeys(): string[] {
  const counts = new Map<string, number>();

  for (const file of [".env.local", ".env"]) {
    let contents: string;
    try {
      contents = readFileSync(path.join(process.cwd(), file), "utf8");
    } catch {
      continue;
    }

    for (const line of contents.split(/\r?\n/)) {
      const match = /^([A-Z_][A-Z0-9_]*)=/.exec(line.trim());
      if (match) counts.set(match[1], (counts.get(match[1]) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([key]) => key)
    .sort();
}
