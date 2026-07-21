import { defineBusinessModule } from "@web-admin-base/module-sdk";

export function createLifecycleFixtureModule(
  options: {
    title?: string;
    requiredPermission?: string;
    dictionaryDependency?: string;
  } = {},
) {
  const permissionCode = options.requiredPermission ?? "fixture-lifecycle.record:view";
  return defineBusinessModule({
    contractVersion: 1,
    moduleCode: "fixture-lifecycle",
    defaultLocale: "en",
    title: {
      key: "modules.fixture-lifecycle.title",
      defaultMessage: options.title ?? "Fixture lifecycle",
    },
    contributions: {
      permissions: [
        {
          code: permissionCode,
          description: {
            key: "modules.fixture-lifecycle.permissions.view",
            defaultMessage: "View fixture records",
          },
          permissionType: "action",
        },
      ],
      apis: [
        {
          code: "api.fixture-lifecycle.list",
          method: "GET",
          path: "/api/modules/fixture-lifecycle/records",
          description: {
            key: "modules.fixture-lifecycle.apis.list",
            defaultMessage: "List fixture records",
          },
          requiredPermission: permissionCode,
          logLevel: "basic",
          requestSchemaId: "FixtureListRequest",
          responseSchemaId: "FixtureListResponse",
        },
      ],
      routes: [
        {
          routeCode: "fixture-lifecycle.records",
          path: "/modules/fixture-lifecycle/records",
          title: {
            key: "modules.fixture-lifecycle.routes.records",
            defaultMessage: "Fixture records",
          },
          requiredPermission: permissionCode,
          menuVisible: true,
          sortOrder: 10,
        },
      ],
      menus: [
        {
          code: "fixture-lifecycle.records",
          path: "/modules/fixture-lifecycle/records",
          title: {
            key: "modules.fixture-lifecycle.menus.records",
            defaultMessage: "Fixture records",
          },
          parentCode: "system",
          routeCode: "fixture-lifecycle.records",
          requiredPermission: permissionCode,
          sortOrder: 10,
        },
      ],
      i18nMessages: [
        {
          key: "modules.fixture-lifecycle.status.ready",
          defaultMessage: "Ready",
          translations: { "zh-CN": "就绪" },
        },
      ],
      dictionaryDependencies: options.dictionaryDependency
        ? [{ code: options.dictionaryDependency }]
        : [],
      scheduledJobs: [
        {
          jobType: "fixture-lifecycle.reconcile",
          title: {
            key: "modules.fixture-lifecycle.jobs.reconcile",
            defaultMessage: "Reconcile fixture records",
          },
          parameterSchemaId: "FixtureReconcileInput",
          executionMode: "singleton",
          defaultTimeoutSeconds: 30,
          maxTimeoutSeconds: 60,
          defaultMaxAttempts: 1,
          maxAttempts: 3,
        },
      ],
    },
  });
}
