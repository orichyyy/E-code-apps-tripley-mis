import { pathToFileURL } from "node:url";

import { loadEmailDeliveryConfig } from "@web-admin-base/adapters";
import { emailNotificationRequestSchema } from "@web-admin-base/contracts";
import { loadDatabaseConfig } from "@web-admin-base/db";

import { EmailDeliveryRepository } from "./modules/infrastructure/email-delivery.repository";
import { EmailDeliveryService } from "./modules/infrastructure/email-delivery.service";
import {
  createPostgresqlInfrastructureExecutor,
  createSqliteInfrastructureExecutor,
} from "./modules/infrastructure/infrastructure.executor";

export function parseEmailDeliveryRequestArgs(args: string[]) {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith("--") || value == null) throw new Error("Invalid CLI arguments.");
    values.set(key.slice(2), value);
  }
  return emailNotificationRequestSchema.parse({
    requestKey: values.get("request-key"),
    userId: values.get("user-id"),
    templateCode: values.get("template-code"),
    variables: JSON.parse(values.get("variables") ?? "{}"),
    referenceType: values.get("reference-type"),
    referenceId: values.get("reference-id"),
  });
}

export async function runEmailDeliveryRequestCli(options: {
  args: string[];
  env: NodeJS.ProcessEnv;
  output: (value: string) => void;
}): Promise<void> {
  if (options.env.NODE_ENV === "production") {
    throw new Error("The email delivery request CLI is disabled in production.");
  }
  const database = loadDatabaseConfig(options.env);
  const executor =
    database.dialect === "postgresql"
      ? createPostgresqlInfrastructureExecutor(database.url)
      : createSqliteInfrastructureExecutor(database.url);
  try {
    const service = new EmailDeliveryService(
      new EmailDeliveryRepository(executor),
      loadEmailDeliveryConfig(options.env),
    );
    const delivery = await service.request(parseEmailDeliveryRequestArgs(options.args));
    options.output(JSON.stringify({ id: delivery.id, status: delivery.status }));
  } finally {
    await executor.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runEmailDeliveryRequestCli({
    args: process.argv.slice(2),
    env: process.env,
    output: console.log,
  });
}
