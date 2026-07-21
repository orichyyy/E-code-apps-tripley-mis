import { z } from "zod";

import type { BusinessWorkerModuleRegistration } from "@web-admin-base/contracts";
import { defineBusinessModule } from "@web-admin-base/module-sdk";

export const workerCapabilityModule = defineBusinessModule({
  contractVersion: 1,
  moduleCode: "fixture-worker",
  defaultLocale: "en",
  title: { key: "modules.fixture-worker.title", defaultMessage: "Fixture worker" },
  contributions: {
    permissions: [
      {
        code: "fixture-worker.record:data",
        description: {
          key: "modules.fixture-worker.permissions.data",
          defaultMessage: "Access records",
        },
        permissionType: "data",
      },
    ],
    dataResources: [
      {
        resourceType: "fixture-worker.record",
        permissionCode: "fixture-worker.record:data",
        title: { key: "modules.fixture-worker.resources.record", defaultMessage: "Record" },
        accessModel: "global",
        fields: [],
      },
    ],
    importExportResources: [
      {
        resourceType: "fixture-worker:records",
        title: { key: "modules.fixture-worker.csv.records", defaultMessage: "Records" },
        capabilities: ["export"],
        columns: [
          {
            code: "name",
            title: { key: "modules.fixture-worker.csv.name", defaultMessage: "Name" },
            valueType: "string",
          },
        ],
        exportFields: ["name"],
      },
    ],
    scheduledJobs: [
      {
        jobType: "fixture-worker.reconcile",
        title: { key: "modules.fixture-worker.jobs.reconcile", defaultMessage: "Reconcile" },
        parameterSchemaId: "ReconcileInput",
        executionMode: "singleton",
        defaultTimeoutSeconds: 30,
        maxTimeoutSeconds: 60,
        defaultMaxAttempts: 2,
        maxAttempts: 3,
      },
    ],
  },
});

export function createWorkerCapabilityRegistration(
  input: {
    onJob?: BusinessWorkerModuleRegistration["jobHandlers"][string];
  } = {},
): BusinessWorkerModuleRegistration {
  return {
    moduleCode: workerCapabilityModule.moduleCode,
    schemas: { ReconcileInput: z.object({ batchSize: z.number().int().positive() }).strict() },
    jobHandlers: {
      "fixture-worker.reconcile": input.onJob ?? (async () => undefined),
    },
    importExportHandlers: {
      "fixture-worker:records": {
        export: async () => ({ rows: [{ name: "=1+1", ignored: "secret" }] }),
      },
    },
  };
}
