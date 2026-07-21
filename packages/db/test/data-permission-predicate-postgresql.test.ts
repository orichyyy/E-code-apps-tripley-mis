import type { NeutralDataPredicate } from "@web-admin-base/contracts";
import { drizzle } from "drizzle-orm/node-postgres";
import { integer, pgTable, text } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { createPostgresqlPool, toDrizzleDataPredicate } from "../src";

const postgresqlUrl = process.env.TEST_DATABASE_URL;
const records = pgTable("phase3_permission_records", {
  id: integer("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  ownerUserId: text("owner_user_id").notNull(),
});

describe("PostgreSQL data permission predicate translation", () => {
  it.runIf(postgresqlUrl)("executes values as parameters without broadening access", async () => {
    const pool = createPostgresqlPool(requiredPostgresqlUrl());
    const client = await pool.connect();
    const db = drizzle(client);
    const suspiciousOrganizationId = "10') OR TRUE --";

    try {
      await client.query(
        `CREATE TEMP TABLE phase3_permission_records (
          id INTEGER PRIMARY KEY,
          organization_id TEXT NOT NULL,
          owner_user_id TEXT NOT NULL
        )`,
      );
      await db.insert(records).values([
        { id: 1, organizationId: "10", ownerUserId: "7" },
        { id: 2, organizationId: "11", ownerUserId: "8" },
        { id: 3, organizationId: suspiciousOrganizationId, ownerUserId: "9" },
      ]);
      const predicate: NeutralDataPredicate = {
        type: "equal",
        field: "organizationId",
        value: suspiciousOrganizationId,
      };

      const result = await db
        .select()
        .from(records)
        .where(
          toDrizzleDataPredicate(predicate, {
            organizationId: records.organizationId,
          }),
        );

      expect(result.map(({ id }) => id)).toEqual([3]);
    } finally {
      client.release();
      await pool.end();
    }
  });
});

function requiredPostgresqlUrl(): string {
  if (!postgresqlUrl) throw new Error("TEST_DATABASE_URL is required.");
  return postgresqlUrl;
}
