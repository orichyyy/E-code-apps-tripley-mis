import { defineBusinessModule } from "@web-admin-base/module-sdk";

export const businessPermissionFixture = defineBusinessModule({
  contractVersion: 1,
  moduleCode: "fixture-permissions",
  defaultLocale: "en",
  title: {
    key: "modules.fixture-permissions.title",
    defaultMessage: "Permission fixture",
  },
  contributions: {
    permissions: [
      {
        code: "fixture-permissions.record:data",
        permissionType: "data",
        description: {
          key: "modules.fixture-permissions.permissions.recordData",
          defaultMessage: "Access fixture records",
        },
      },
    ],
    dataResources: [
      {
        resourceType: "fixture-permissions.record",
        permissionCode: "fixture-permissions.record:data",
        title: {
          key: "modules.fixture-permissions.resources.record",
          defaultMessage: "Fixture record",
        },
        accessModel: "policy",
        fields: [
          {
            code: "organizationId",
            title: {
              key: "modules.fixture-permissions.fields.organizationId",
              defaultMessage: "Organization",
            },
            valueType: "id",
          },
          {
            code: "ownerUserId",
            title: {
              key: "modules.fixture-permissions.fields.ownerUserId",
              defaultMessage: "Owner",
            },
            valueType: "id",
          },
        ],
        ownerUserField: "ownerUserId",
        organizationField: "organizationId",
      },
    ],
  },
});
