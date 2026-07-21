import type { DatabaseAdapterExecutor } from "@web-admin-base/adapters";
import { loadDatabaseConfig } from "@web-admin-base/db";

import {
  createPostgresqlInfrastructureExecutor,
  createSqliteInfrastructureExecutor,
} from "../infrastructure/infrastructure.executor";
import { AnnouncementRepository } from "./announcement.repository";
import { WebhookRepository } from "./webhook.repository";

export class CommunicationsRepository {
  readonly announcements: AnnouncementRepository;
  readonly webhooks: WebhookRepository;

  constructor(private readonly executor: DatabaseAdapterExecutor) {
    this.announcements = new AnnouncementRepository(executor);
    this.webhooks = new WebhookRepository(executor);
  }

  static fromEnvironment(env: NodeJS.ProcessEnv = process.env): CommunicationsRepository {
    const config = loadDatabaseConfig(env);
    const executor =
      config.dialect === "postgresql"
        ? createPostgresqlInfrastructureExecutor(config.url)
        : createSqliteInfrastructureExecutor(config.url);
    return new CommunicationsRepository(executor);
  }

  close(): Promise<void> {
    return this.executor.close();
  }
}
