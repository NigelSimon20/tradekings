import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Minimal `.env` loader for the command line scripts. Next.js loads these files
 * itself when the app runs; the scripts run outside Next, so they need this.
 *
 * Quoted values may span several lines, because a service account private key
 * is usually pasted straight out of the JSON key file.
 */
export function loadEnv(files = [".env.local", ".env"]): void {
  for (const file of files) {
    let contents: string;
    try {
      contents = readFileSync(path.join(process.cwd(), file), "utf8");
    } catch {
      continue;
    }

    for (const [key, value] of parseEnv(contents)) {
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

function parseEnv(contents: string): [string, string][] {
  const entries: [string, string][] = [];
  const lines = contents.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    const quote = value[0] === '"' || value[0] === "'" ? value[0] : "";

    if (quote) {
      value = value.slice(1);
      // Keep reading until the closing quote, so multi-line PEM keys survive.
      while (!value.endsWith(quote) && index + 1 < lines.length) {
        index += 1;
        value += `\n${lines[index]}`;
      }
      value = value.endsWith(quote) ? value.slice(0, -1) : value;
    }

    entries.push([key, value]);
  }

  return entries;
}
