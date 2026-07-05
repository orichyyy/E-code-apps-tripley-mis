import path from "node:path";

export const rootDir = process.cwd();
export const tmpDir = path.join(rootDir, ".tmp");
export const dataDir = path.join(rootDir, "data");

export const apiPort = process.env.SMOKE_API_PORT ?? "3100";
export const webPort = process.env.SMOKE_WEB_PORT ?? "5174";
export const databaseUrl = process.env.SMOKE_DATABASE_URL ?? "file:./data/local-smoke.sqlite";
export const fileStorageRoot = process.env.SMOKE_FILE_STORAGE_ROOT ?? "./data/local-smoke-files";
export const adminUsername = process.env.SMOKE_ADMIN_USERNAME ?? "admin";
export const adminPassword = process.env.SMOKE_ADMIN_PASSWORD ?? "Admin1234";

const pnpmCli = process.env.npm_execpath;

export const pnpmCommand = pnpmCli
  ? process.execPath
  : process.platform === "win32"
    ? "pnpm.cmd"
    : "pnpm";
export const pnpmPrefixArgs = pnpmCli ? [pnpmCli] : [];

export const serviceEnv = normalizeEnv({
  ...process.env,
  NODE_ENV: "development",
  BACKEND_CORE_STORE: "database",
  DATABASE_DIALECT: "sqlite",
  DATABASE_URL: databaseUrl,
  API_PORT: apiPort,
  JWT_SECRET: process.env.JWT_SECRET ?? "development-only-change-me",
  VITE_API_PROXY_TARGET: `http://localhost:${apiPort}`,
  WEB_PORT: webPort,
  WORKER_NAME: "local-smoke-worker",
  WORKER_POLL_INTERVAL_MS: "250",
  FILE_STORAGE_ROOT: fileStorageRoot,
  SMTP_ENABLED: "false",
  WEB_ADMIN_SEED_ADMIN_USERNAME: adminUsername,
  WEB_ADMIN_SEED_ADMIN_PASSWORD: adminPassword,
});

export const requiredMenuCodes = [
  "system.config",
  "system.dictionaries",
  "operations.scheduler",
  "logs.api",
  "account.settings",
];

export const apiChecks = [
  "/auth/me",
  "/users",
  "/organizations/tree",
  "/roles",
  "/permissions",
  "/menus/tree",
  "/system-config",
  "/dictionary-types",
  "/online-users",
  "/scheduled-tasks",
  "/import-export/tasks",
  "/logs/login",
  "/logs/operation",
  "/logs/access",
  "/logs/api",
  "/logs/exception",
  "/logs/security",
  "/logs/jobs",
  "/logs/files",
  "/files",
  "/announcements",
  "/notifications",
  "/notification-templates",
  "/webhooks",
];

function normalizeEnv(input: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(input).filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === "string" && !entry[0].startsWith("="),
    ),
  );
}
