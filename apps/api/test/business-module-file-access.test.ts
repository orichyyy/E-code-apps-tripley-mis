import { describe, expect, it } from "vitest";

import type {
  BusinessApiModuleRegistration,
  ModuleExecutionContext,
} from "@web-admin-base/contracts";
import { defineBusinessModule } from "@web-admin-base/module-sdk";

import { BusinessModuleFileAccessAuthorizer } from "../src/business-modules/capabilities/file-access-authorizer";

const definition = defineBusinessModule({
  contractVersion: 1,
  moduleCode: "fixture-files",
  defaultLocale: "en",
  title: { key: "modules.fixture-files.title", defaultMessage: "Fixture files" },
  contributions: {
    permissions: [
      {
        code: "fixture-files.record:data",
        description: {
          key: "modules.fixture-files.permissions.data",
          defaultMessage: "Access records",
        },
        permissionType: "data",
      },
    ],
    dataResources: [
      {
        resourceType: "fixture-files.record",
        permissionCode: "fixture-files.record:data",
        title: { key: "modules.fixture-files.resources.record", defaultMessage: "Record" },
        accessModel: "global",
        fields: [],
      },
    ],
    fileAttachments: [
      {
        attachmentCode: "fixture-files.document",
        resourceType: "fixture-files.record",
        title: { key: "modules.fixture-files.attachments.document", defaultMessage: "Document" },
        cardinality: "multiple",
        allowedExtensions: ["pdf"],
        maxSizeBytes: 1024,
      },
    ],
  },
});

function registration(canView: boolean): BusinessApiModuleRegistration {
  return {
    moduleCode: definition.moduleCode,
    routes: [],
    schemas: {},
    dataPermissionOperators: {},
    importExportResources: {},
    notificationRecipientResolvers: {},
    fileAttachmentAuthorizers: {
      "fixture-files.document": {
        canView: () => canView,
        canAttach: () => false,
        canDetach: () => false,
      },
    },
  };
}

describe("Business Module referenced-file authorization", () => {
  it("allows only active modules with an active declared reference", async () => {
    const context: ModuleExecutionContext = {
      moduleCode: "fixture-files",
      source: "api",
      actorId: "7",
      organizationId: "3",
      sessionId: "9",
      requestId: "request-123",
      traceId: "trace-123",
      correlationId: "correlation-123",
      locale: "en",
    };
    const references = [
      {
        fileObjectId: "5",
        resourceType: "fixture-files.record",
        resourceId: "11",
        referenceType: "fixture-files.document",
        status: "active",
      },
    ];

    await expect(
      new BusinessModuleFileAccessAuthorizer(
        [definition],
        [registration(true)],
        async () => true,
      ).canView(context, "5", references),
    ).resolves.toBe(true);
    await expect(
      new BusinessModuleFileAccessAuthorizer(
        [definition],
        [registration(true)],
        async () => false,
      ).canView(context, "5", references),
    ).resolves.toBe(false);
    await expect(
      new BusinessModuleFileAccessAuthorizer(
        [definition],
        [registration(false)],
        async () => true,
      ).canView(context, "5", references),
    ).resolves.toBe(false);
  });
});
