import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const result = spawnSync(
  command,
  [
    "--filter",
    "@web-admin-base/adapters",
    "exec",
    "vitest",
    "run",
    "test/smtp-integration.test.ts",
  ],
  {
    env: {
      ...process.env,
      SMTP_INTEGRATION_REQUIRED: "true",
      SMTP_HOST: process.env.SMTP_HOST ?? "localhost",
      SMTP_PORT: process.env.SMTP_PORT ?? "1025",
      MAILPIT_API_URL: process.env.MAILPIT_API_URL ?? "http://127.0.0.1:8025",
      NODE_EXTRA_CA_CERTS: process.env.NODE_EXTRA_CA_CERTS ?? resolve("scripts/mailpit/cert.pem"),
    },
    stdio: "inherit",
    shell: process.platform === "win32",
  },
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

const acceptance = spawnSync(
  command,
  ["exec", "tsx", "--tsconfig", "tsconfig.base.json", "scripts/email-delivery-smtp-acceptance.ts"],
  {
    env: {
      ...process.env,
      SMTP_INTEGRATION_REQUIRED: "true",
      SMTP_HOST: process.env.SMTP_HOST ?? "localhost",
      SMTP_PORT: process.env.SMTP_PORT ?? "1025",
      MAILPIT_API_URL: process.env.MAILPIT_API_URL ?? "http://127.0.0.1:8025",
      NODE_EXTRA_CA_CERTS: process.env.NODE_EXTRA_CA_CERTS ?? resolve("scripts/mailpit/cert.pem"),
    },
    stdio: "inherit",
    shell: process.platform === "win32",
  },
);
if (acceptance.error) throw acceptance.error;
process.exit(acceptance.status ?? 1);
