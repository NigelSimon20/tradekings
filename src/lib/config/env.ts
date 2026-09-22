/**
 * Every environment variable the system reads, resolved once and validated in
 * one place so the rest of the code never touches `process.env` directly.
 */
export interface GoogleConfig {
  spreadsheetId: string;
  contractsSheet: string;
  runLogSheet: string;
  dashboardSheet: string;
  settingsSheet: string;
  clientEmail: string;
  privateKey: string;
  /** Used when the system writes timestamps into the sheet. */
  timezone: string;
  /** How long a read of the sheet may be reused, in seconds. */
  cacheSeconds: number;
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
}

export interface AppConfig {
  appName: string;
  appUrl: string;
  timezone: string;
  dataSource: "google-sheets" | "local";
  localDataFile: string;
  google: GoogleConfig | null;
  smtp: SmtpConfig | null;
  mailFrom: string;
  hrRecipient: string;
  reportCc: string[];
  managerReportsEnabled: boolean;
  skipEmptyManagerReports: boolean;
  outboxDir: string;
  auth: { enabled: boolean; password: string; secret: string };
  cronSecret: string;
}

function str(name: string, fallback = ""): string {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value.trim();
}

function bool(name: string, fallback: boolean): boolean {
  const value = str(name);
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function list(name: string): string[] {
  return str(name)
    .split(/[,;]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/** Service account keys arrive either as raw JSON, base64 JSON, or two vars. */
function resolveServiceAccount(): { clientEmail: string; privateKey: string } | null {
  const rawJson = str("GOOGLE_SERVICE_ACCOUNT_JSON") || decodeBase64(str("GOOGLE_SERVICE_ACCOUNT_BASE64"));
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson) as { client_email?: string; private_key?: string };
      if (parsed.client_email && parsed.private_key) {
        return { clientEmail: parsed.client_email, privateKey: normalisePrivateKey(parsed.private_key) };
      }
    } catch {
      // Fall through to the individual variables below.
    }
  }

  const clientEmail = str("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const privateKey = normalisePrivateKey(str("GOOGLE_PRIVATE_KEY"));
  return clientEmail && privateKey ? { clientEmail, privateKey } : null;
}

function decodeBase64(value: string): string {
  if (!value) return "";
  try {
    return Buffer.from(value, "base64").toString("utf8");
  } catch {
    return "";
  }
}

/** Hosting providers store the key with escaped newlines. */
function normalisePrivateKey(key: string): string {
  return key.replace(/\\n/g, "\n").replace(/^"|"$/g, "");
}

let cached: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (cached) return cached;

  const serviceAccount = resolveServiceAccount();
  const spreadsheetId = str("GOOGLE_SHEET_ID");
  const google: GoogleConfig | null =
    serviceAccount && spreadsheetId
      ? {
          spreadsheetId,
          contractsSheet: str("GOOGLE_CONTRACTS_SHEET_NAME", "Contracts"),
          runLogSheet: str("GOOGLE_RUN_LOG_SHEET_NAME", "Run Log"),
          dashboardSheet: str("GOOGLE_DASHBOARD_SHEET_NAME", "Dashboard"),
          settingsSheet: str("GOOGLE_SETTINGS_SHEET_NAME", "Settings"),
          timezone: str("APP_TIMEZONE", "Africa/Harare"),
          cacheSeconds: Math.max(0, Number(str("SHEET_CACHE_SECONDS", "30")) || 0),
          ...serviceAccount,
        }
      : null;

  const smtpHost = str("SMTP_HOST");
  const smtp: SmtpConfig | null = smtpHost
    ? {
        host: smtpHost,
        port: Number(str("SMTP_PORT", "587")),
        secure: bool("SMTP_SECURE", Number(str("SMTP_PORT", "587")) === 465),
        user: str("SMTP_USER"),
        password: str("SMTP_PASSWORD"),
      }
    : null;

  const requestedSource = str("DATA_SOURCE").toLowerCase();
  const dataSource: AppConfig["dataSource"] =
    requestedSource === "local" ? "local" : google ? "google-sheets" : "local";

  const password = str("APP_PASSWORD");

  cached = {
    appName: str("APP_NAME", "Blue Collar Contract Tracker"),
    appUrl: str("APP_URL", "http://localhost:3000").replace(/\/$/, ""),
    timezone: str("APP_TIMEZONE", "Africa/Harare"),
    dataSource,
    localDataFile: str("LOCAL_DATA_FILE", "data/contracts.local.json"),
    google,
    smtp,
    mailFrom: str("MAIL_FROM", smtp?.user || "contract-tracker@localhost"),
    hrRecipient: str("HR_REPORT_EMAIL"),
    reportCc: list("REPORT_CC"),
    managerReportsEnabled: bool("MANAGER_REPORTS_ENABLED", true),
    skipEmptyManagerReports: bool("SKIP_EMPTY_MANAGER_REPORTS", true),
    outboxDir: str("OUTBOX_DIR", ".outbox"),
    auth: {
      enabled: password.length > 0,
      password,
      secret: str("AUTH_SECRET", password || "development-secret"),
    },
    cronSecret: str("CRON_SECRET"),
  };

  return cached;
}

/**
 * What an administrator still has to provide. Used by the "cannot reach the
 * database" screen so a deployment problem explains itself.
 */
export function configurationProblems(): string[] {
  const config = getConfig();
  const problems: string[] = [];

  if (!str("GOOGLE_SHEET_ID")) problems.push("GOOGLE_SHEET_ID is not set");
  if (!resolveServiceAccount()) {
    problems.push(
      "Service account credentials are not set (GOOGLE_SERVICE_ACCOUNT_BASE64, or GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY)",
    );
  }
  if (config.google && !config.hrRecipient) {
    problems.push("HR_REPORT_EMAIL is not set (or fill in the sheet's Settings tab)");
  }

  return problems;
}

/** True when the app is running somewhere it cannot write files. */
export function isServerless(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

/** Test seam — clears the memoised config. */
export function resetConfigCache(): void {
  cached = null;
}
