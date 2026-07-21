import { spawnSync } from "node:child_process";

type AcceptanceStep = {
  name: string;
  args: string[];
};

const isWindows = process.platform === "win32";
const pnpm = isWindows ? "pnpm.cmd" : "pnpm";
const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "TEST_DATABASE_URL or DATABASE_URL is required for Business Module PostgreSQL acceptance.",
  );
}

const steps: AcceptanceStep[] = [
  { name: "production registry conformance", args: ["modules:check"] },
  {
    name: "contracts",
    args: [
      "--filter",
      "@web-admin-base/contracts",
      "exec",
      "vitest",
      "run",
      "test/business-module-definition.test.ts",
      "test/business-module-lifecycle.test.ts",
      "test/business-module-capabilities.test.ts",
      "test/webhook-events.test.ts",
    ],
  },
  {
    name: "module SDK",
    args: [
      "--filter",
      "@web-admin-base/module-sdk",
      "exec",
      "vitest",
      "run",
      "test/registry.test.ts",
      "test/conformance.test.ts",
      "test/activation.test.ts",
      "test/business-permission-enforcer.test.ts",
      "test/business-module-capabilities.test.ts",
    ],
  },
  {
    name: "database and migrations",
    args: [
      "--filter",
      "@web-admin-base/db",
      "exec",
      "vitest",
      "run",
      "test/module-migrations.test.ts",
      "test/migration-execution.test.ts",
      "test/data-permission-predicate.test.ts",
      "test/data-permission-predicate-postgresql.test.ts",
    ],
  },
  {
    name: "API lifecycle and capabilities",
    args: [
      "--filter",
      "@web-admin-base/api",
      "exec",
      "vitest",
      "run",
      "--no-file-parallelism",
      "test/module-lifecycle-service.test.ts",
      "test/module-lifecycle-routes.test.ts",
      "test/module-lifecycle-sqlite.test.ts",
      "test/module-lifecycle-postgresql.test.ts",
      "test/business-module-foundation.test.ts",
      "test/business-module-capability-persistence.test.ts",
      "test/business-module-file-access.test.ts",
      "test/business-module-operation-fallback.test.ts",
      "test/business-module-webhook-catalog.test.ts",
      "test/business-module-scheduled-job-catalog.test.ts",
      "test/hono-rpc-types.test.ts",
    ],
  },
  {
    name: "Worker execution",
    args: [
      "--filter",
      "@web-admin-base/worker",
      "exec",
      "vitest",
      "run",
      "test/business-module-capabilities.test.ts",
      "test/worker-bootstrap.test.ts",
      "test/webhook-delivery.test.ts",
    ],
  },
  {
    name: "frontend integration",
    args: [
      "--filter",
      "@web-admin-base/web",
      "exec",
      "vitest",
      "run",
      "test/module-registry-api.test.ts",
      "test/module-registry-page.test.tsx",
      "test/field-permission-utils.test.ts",
      "test/admin-route-manifest.test.ts",
    ],
  },
];

for (const step of steps) {
  process.stdout.write(`\n=== Business Module acceptance: ${step.name} ===\n`);
  const result = spawnSync(pnpm, step.args, {
    env: process.env,
    shell: isWindows,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

process.stdout.write("\nBusiness Module cross-boundary acceptance passed.\n");
