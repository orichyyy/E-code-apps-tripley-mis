import { spawnSync } from "node:child_process";

const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const environment = {
  ...process.env,
  S3_INTEGRATION_REQUIRED: "true",
  S3_ENDPOINT: process.env.S3_ENDPOINT ?? "http://127.0.0.1:9000",
  S3_REGION: process.env.S3_REGION ?? "us-east-1",
  S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID ?? "webadmin",
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY ?? "webadmin-development-secret",
};
const result = spawnSync(
  command,
  ["--filter", "@web-admin-base/adapters", "exec", "vitest", "run", "test/s3-integration.test.ts"],
  { env: environment, stdio: "inherit", shell: process.platform === "win32" },
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
