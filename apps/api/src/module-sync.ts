import { businessModuleDefinitions } from "@web-admin-base/contracts";
import { createBusinessModuleRegistry } from "@web-admin-base/module-sdk";
import { pathToFileURL } from "node:url";

import { ModuleLifecycleRepository } from "./modules/module-lifecycle/module-lifecycle.repository";
import { ModuleLifecycleService } from "./modules/module-lifecycle/module-lifecycle.service";

type ModuleSyncCliOptions = { mode: "plan" } | { mode: "apply"; expectedRegistryHash: string };

export function parseModuleSyncCliArgs(args: string[]): ModuleSyncCliOptions {
  const apply = args.includes("--apply");
  const confirmed = args.includes("--confirmed");
  const expectedHash = args
    .find((argument) => argument.startsWith("--expected-registry-hash="))
    ?.slice("--expected-registry-hash=".length);
  const known = args.every(
    (argument) =>
      argument === "--apply" ||
      argument === "--confirmed" ||
      argument.startsWith("--expected-registry-hash="),
  );

  if (!known) throw new Error("Unknown Module Sync CLI argument.");
  if (!apply) {
    if (confirmed || expectedHash) throw new Error("Apply flags require --apply.");
    return { mode: "plan" };
  }
  if (!expectedHash || !/^[a-f0-9]{64}$/.test(expectedHash)) {
    throw new Error("--expected-registry-hash=<sha256> is required for Apply.");
  }
  if (!confirmed) throw new Error("--confirmed is required for Apply.");
  return { mode: "apply", expectedRegistryHash: expectedHash };
}

export async function runModuleSyncCli(
  args: string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
) {
  const options = parseModuleSyncCliArgs(args);
  const repository = ModuleLifecycleRepository.fromEnvironment(env);
  const service = new ModuleLifecycleService(
    createBusinessModuleRegistry(businessModuleDefinitions),
    repository,
  );
  try {
    return options.mode === "plan"
      ? { mode: options.mode, data: await service.plan() }
      : {
          mode: options.mode,
          data: await service.apply(
            { expectedRegistryHash: options.expectedRegistryHash, confirmed: true },
            null,
          ),
        };
  } finally {
    await repository.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runModuleSyncCli()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : "Module Sync failed.");
      process.exitCode = 1;
    });
}
