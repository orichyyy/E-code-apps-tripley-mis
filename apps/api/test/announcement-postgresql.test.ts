import type { DatabaseAdapterExecutor } from "@web-admin-base/adapters";
import { encodeOrgPath, runPostgresqlMigrations } from "@web-admin-base/db";
import { describe, expect, it } from "vitest";

import { AnnouncementRepository } from "../src/modules/communications/announcement.repository";
import { createPostgresqlInfrastructureExecutor } from "../src/modules/infrastructure/infrastructure.executor";

const postgresqlUrl = process.env.TEST_DATABASE_URL;

describe("PostgreSQL announcement targeting", () => {
  it.runIf(postgresqlUrl)(
    "persists targets transactionally and calculates dynamic visibility after reload",
    async () => {
      const url = requirePostgresqlUrl();
      await runPostgresqlMigrations({ url });
      const firstExecutor = createPostgresqlInfrastructureExecutor(url);
      let organizationIds: string[] = [];
      let announcementIds: string[] = [];

      try {
        organizationIds = await insertOrganizations(firstExecutor);
        const [rootId, childId, unrelatedId, disabledId] = organizationIds;
        const repository = new AnnouncementRepository(firstExecutor);

        await expect(
          repository.create(organizationInput([rootId, childId]), null),
        ).rejects.toMatchObject({ code: "VALIDATION_ANNOUNCEMENT_TARGETS" });
        await expect(
          repository.create(organizationInput([disabledId]), null),
        ).rejects.toMatchObject({ code: "VALIDATION_ANNOUNCEMENT_TARGETS" });

        const scoped = await repository.create(organizationInput([childId]), null);
        const system = await repository.create(systemInput(), null);
        const multiTarget = await repository.create(
          organizationInput([childId, unrelatedId], "Multi-target notice"),
          null,
        );
        const expiredDraft = await repository.create(
          { ...systemInput("Expired notice"), expiresAt: "2000-01-01T00:00:00.000Z" },
          null,
        );
        announcementIds = [scoped.id, system.id, multiTarget.id, expiredDraft.id];
        await expect(
          repository.update(scoped.id, { targetOrganizationIds: [rootId, childId] }, null),
        ).rejects.toMatchObject({ code: "VALIDATION_ANNOUNCEMENT_TARGETS" });
        await expect(
          firstExecutor.all(
            "SELECT target_id FROM announcement_targets WHERE announcement_id = $1",
            [scoped.id],
          ),
        ).resolves.toEqual([expect.objectContaining({ target_id: Number(childId) })]);
        await repository.update(scoped.id, { targetOrganizationIds: [rootId] }, null);
        await firstExecutor.run("UPDATE organizations SET status = 'disabled' WHERE id = $1", [
          rootId,
        ]);
        await expect(repository.publish(scoped.id, null)).rejects.toMatchObject({
          code: "VALIDATION_ANNOUNCEMENT_TARGETS",
        });
        await firstExecutor.run("UPDATE organizations SET status = 'enabled' WHERE id = $1", [
          rootId,
        ]);
        await repository.publish(scoped.id, null);
        await repository.publish(system.id, null);
        await expect(repository.publish(expiredDraft.id, null)).rejects.toMatchObject({
          code: "VALIDATION_ANNOUNCEMENT_EXPIRATION",
        });

        expect((await repository.listCurrent(pageQuery, childId)).items.map(byTitle)).toEqual([
          "System notice",
          "Scoped notice",
        ]);
        expect((await repository.listCurrent(pageQuery, unrelatedId)).items.map(byTitle)).toEqual([
          "System notice",
        ]);
        await firstExecutor.run("UPDATE organizations SET status = 'disabled' WHERE id = $1", [
          childId,
        ]);
        await expect(repository.listCurrent(pageQuery, childId)).rejects.toMatchObject({
          code: "BUSINESS_ORG_DISABLED",
        });
        await firstExecutor.run("UPDATE organizations SET status = 'enabled' WHERE id = $1", [
          childId,
        ]);
      } finally {
        await firstExecutor.close();
      }

      const secondExecutor = createPostgresqlInfrastructureExecutor(url);
      try {
        const [rootId, childId] = organizationIds;
        const [scopedId] = announcementIds;
        const repository = new AnnouncementRepository(secondExecutor);
        const catalog = await repository.listCatalog({
          ...pageQuery,
          status: "published",
          scopeType: "organization",
        });
        expect(catalog.items).toEqual([
          expect.objectContaining({ id: scopedId, targetOrganizationIds: [rootId] }),
        ]);

        await secondExecutor.run("UPDATE announcements SET expire_at = $1 WHERE id = $2", [
          "2000-01-01T00:00:00.000Z",
          scopedId,
        ]);
        expect((await repository.listCurrent(pageQuery, childId)).items.map(byTitle)).toEqual([
          "System notice",
        ]);

        await secondExecutor.run("UPDATE announcements SET expire_at = NULL WHERE id = $1", [
          scopedId,
        ]);
        await repository.unpublish(scopedId, null);
        await secondExecutor.run(
          "UPDATE organizations SET is_deleted = TRUE, deleted_at = NOW() WHERE id = $1",
          [rootId],
        );
        await repository.delete(scopedId, null);
        await expect(
          secondExecutor.all(
            "SELECT target_id FROM announcement_targets WHERE announcement_id = $1",
            [scopedId],
          ),
        ).resolves.toEqual([expect.objectContaining({ target_id: Number(rootId) })]);
      } finally {
        await cleanup(secondExecutor, announcementIds, organizationIds);
        await secondExecutor.close();
      }
    },
  );
});

const pageQuery = { page: 1, pageSize: 20 };

function organizationInput(targetOrganizationIds: string[], title = "Scoped notice") {
  return {
    title,
    content: "Scoped content",
    scopeType: "organization" as const,
    targetOrganizationIds,
    expiresAt: "2099-01-01T00:00:00.000Z",
  };
}

function systemInput(title = "System notice") {
  return {
    title,
    content: "System content",
    scopeType: "system" as const,
    targetOrganizationIds: [],
  };
}

async function insertOrganizations(executor: DatabaseAdapterExecutor): Promise<string[]> {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const definitions = [
    { path: encodeOrgPath([127]), level: 1, segment: 127, name: "Target Root", status: "enabled" },
    {
      path: encodeOrgPath([127, 254]),
      level: 2,
      segment: 254,
      name: "Target Child",
      status: "enabled",
    },
    {
      path: encodeOrgPath([126]),
      level: 1,
      segment: 126,
      name: "Unrelated Root",
      status: "enabled",
    },
    {
      path: encodeOrgPath([125]),
      level: 1,
      segment: 125,
      name: "Disabled Root",
      status: "disabled",
    },
  ];
  const ids: string[] = [];
  for (const [index, item] of definitions.entries()) {
    const rows = await executor.all(
      `INSERT INTO organizations
       (path, level, segment, name, code, sort_order, status, is_deleted, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 0, $6, FALSE, NOW(), NOW()) RETURNING id`,
      [
        item.path.toString(),
        item.level,
        item.segment,
        item.name,
        `announcement-${suffix}-${index}`,
        item.status,
      ],
    );
    ids.push(String(rows[0]?.id));
  }
  return ids;
}

async function cleanup(
  executor: DatabaseAdapterExecutor,
  announcementIds: string[],
  organizationIds: string[],
): Promise<void> {
  if (announcementIds.length > 0) {
    await executor.run("DELETE FROM announcement_targets WHERE announcement_id = ANY($1::int[])", [
      announcementIds.map(Number),
    ]);
    await executor.run("DELETE FROM announcements WHERE id = ANY($1::int[])", [
      announcementIds.map(Number),
    ]);
  }
  if (organizationIds.length > 0) {
    await executor.run("DELETE FROM organizations WHERE id = ANY($1::int[])", [
      organizationIds.map(Number),
    ]);
  }
}

function byTitle(record: { title: string }): string {
  return record.title;
}

function requirePostgresqlUrl(): string {
  if (!postgresqlUrl) throw new Error("TEST_DATABASE_URL is required.");
  return postgresqlUrl;
}
