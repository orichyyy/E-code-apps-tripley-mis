import { z } from "zod";

import type {
  BusinessApiModuleRegistration,
  ModuleExecutionContext,
} from "@web-admin-base/contracts";
import { defineBusinessModule } from "../../src";

export const capabilityModule = defineBusinessModule({
  contractVersion: 1,
  moduleCode: "fixture-capabilities",
  defaultLocale: "en",
  title: {
    key: "modules.fixture-capabilities.title",
    defaultMessage: "Fixture capabilities",
  },
  contributions: {
    permissions: [
      {
        code: "fixture-capabilities.record:view",
        description: {
          key: "modules.fixture-capabilities.permissions.view",
          defaultMessage: "View records",
        },
        permissionType: "page",
      },
      {
        code: "fixture-capabilities.record:data",
        description: {
          key: "modules.fixture-capabilities.permissions.data",
          defaultMessage: "Access records",
        },
        permissionType: "data",
      },
    ],
    dataResources: [
      {
        resourceType: "fixture-capabilities.record",
        permissionCode: "fixture-capabilities.record:data",
        title: {
          key: "modules.fixture-capabilities.resources.record",
          defaultMessage: "Record",
        },
        accessModel: "global",
        fields: [
          {
            code: "name",
            title: {
              key: "modules.fixture-capabilities.fields.name",
              defaultMessage: "Name",
            },
            valueType: "string",
          },
        ],
      },
    ],
    operationEvents: [
      {
        code: "fixture-capabilities.record-updated",
        title: {
          key: "modules.fixture-capabilities.events.updated",
          defaultMessage: "Record updated",
        },
        resourceType: "fixture-capabilities.record",
        sensitiveFields: ["secret"],
      },
    ],
    fileAttachments: [
      {
        attachmentCode: "fixture-capabilities.document",
        resourceType: "fixture-capabilities.record",
        title: {
          key: "modules.fixture-capabilities.attachments.document",
          defaultMessage: "Document",
        },
        cardinality: "single",
        allowedExtensions: ["pdf"],
        maxSizeBytes: 1024,
      },
    ],
    importExportResources: [
      {
        resourceType: "fixture-capabilities:records",
        title: {
          key: "modules.fixture-capabilities.csv.records",
          defaultMessage: "Records",
        },
        capabilities: ["import", "export"],
        columns: [
          {
            code: "name",
            title: {
              key: "modules.fixture-capabilities.csv.name",
              defaultMessage: "Name",
            },
            valueType: "string",
            required: true,
          },
        ],
        exportFields: ["name"],
      },
    ],
    domainEvents: [
      {
        eventType: "fixture-capabilities.record-changed",
        title: {
          key: "modules.fixture-capabilities.domain.recordChanged",
          defaultMessage: "Record changed",
        },
        payloadSchemaId: "RecordChanged",
      },
    ],
    notificationEvents: [
      {
        eventType: "fixture-capabilities.record-notice",
        title: {
          key: "modules.fixture-capabilities.notifications.record",
          defaultMessage: "Record notification",
        },
        payloadSchemaId: "RecordNotice",
        channels: ["in_app", "webhook"],
        templateCodes: {
          in_app: "fixture-capabilities.record-notice",
          webhook: "fixture-capabilities.record-notice",
        },
      },
    ],
    scheduledJobs: [
      {
        jobType: "fixture-capabilities.reconcile",
        title: {
          key: "modules.fixture-capabilities.jobs.reconcile",
          defaultMessage: "Reconcile records",
        },
        parameterSchemaId: "ReconcileInput",
        executionMode: "singleton",
        defaultTimeoutSeconds: 30,
        maxTimeoutSeconds: 60,
        defaultMaxAttempts: 2,
        maxAttempts: 3,
      },
    ],
    errors: [
      {
        code: "BUSINESS_FIXTURE_CAPABILITIES_CONFLICT",
        status: 409,
        message: {
          key: "modules.fixture-capabilities.errors.conflict",
          defaultMessage: "Record conflict",
        },
        detailsSchemaId: "ConflictDetails",
      },
    ],
  },
});

export const capabilityApiRegistration: BusinessApiModuleRegistration = {
  moduleCode: capabilityModule.moduleCode,
  routes: [],
  dataPermissionOperators: {},
  schemas: {
    RecordChanged: z.object({ recordId: z.string() }).strict(),
    RecordNotice: z.object({ recordId: z.string() }).strict(),
    ReconcileInput: z.object({ batchSize: z.number().int().positive() }).strict(),
    ConflictDetails: z.object({ recordId: z.string() }).strict(),
  },
  fileAttachmentAuthorizers: {
    "fixture-capabilities.document": {
      canView: () => true,
      canAttach: () => true,
      canDetach: () => true,
    },
  },
  importExportResources: {
    "fixture-capabilities:records": {
      normalizeExportFilters: (value) => z.object({ active: z.boolean() }).parse(value),
      previewImport: () => ({ valid: true, totalRows: 1, errors: [] }),
    },
  },
  notificationRecipientResolvers: {
    "fixture-capabilities.record-notice": () => ["7", "7", "8"],
  },
};

export const capabilityContext: ModuleExecutionContext = {
  moduleCode: capabilityModule.moduleCode,
  source: "api",
  actorId: "7",
  organizationId: "3",
  sessionId: "11",
  requestId: "request-123",
  traceId: "trace-123",
  correlationId: "correlation-123",
  locale: "en",
};
