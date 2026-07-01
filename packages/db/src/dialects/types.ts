export const databaseDialects = ["sqlite", "postgresql"] as const;

export type DatabaseDialect = (typeof databaseDialects)[number];

export type DatabaseConfig = {
  dialect: DatabaseDialect;
  url: string;
};
