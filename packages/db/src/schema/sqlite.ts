import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const schemaMetadata = sqliteTable("schema_metadata", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  value: text("value", { mode: "json" }),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const sqliteSchema = {
  schemaMetadata
};
