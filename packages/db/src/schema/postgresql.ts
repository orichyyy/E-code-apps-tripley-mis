import { jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const schemaMetadata = pgTable("schema_metadata", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: jsonb("value"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
});

export const postgresqlSchema = {
  schemaMetadata
};
