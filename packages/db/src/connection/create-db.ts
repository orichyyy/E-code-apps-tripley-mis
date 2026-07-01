import type { DatabaseConfig, DatabaseDialect } from "../dialects/types";

export type DrizzleClientFactory = (url: string) => unknown;

export type DatabaseFactories = Partial<Record<DatabaseDialect, DrizzleClientFactory>>;

export type DatabaseHandle = {
  dialect: DatabaseDialect;
  client: unknown;
};

export function createDatabase(config: DatabaseConfig, factories: DatabaseFactories): DatabaseHandle {
  const factory = factories[config.dialect];

  if (!factory) {
    throw new Error(`No database factory configured for ${config.dialect}`);
  }

  return {
    dialect: config.dialect,
    client: factory(config.url)
  };
}
