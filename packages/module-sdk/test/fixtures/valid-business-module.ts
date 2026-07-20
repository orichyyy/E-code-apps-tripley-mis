import { defineBusinessModule } from "../../src";

export const fixtureModuleCode = "fixture-orders";

export function createValidFixtureModule() {
  return defineBusinessModule({
    contractVersion: 1,
    moduleCode: fixtureModuleCode,
    defaultLocale: "en",
    title: { key: "modules.fixture-orders.title", defaultMessage: "Fixture orders" },
    contributions: {
      permissions: [
        {
          code: "fixture-orders.order:view",
          description: {
            key: "modules.fixture-orders.permissions.orderView",
            defaultMessage: "View fixture orders",
          },
          permissionType: "page",
        },
      ],
      apis: [
        {
          code: "api.fixture-orders.list",
          method: "GET",
          path: "/api/modules/fixture-orders/orders",
          description: {
            key: "modules.fixture-orders.apis.list",
            defaultMessage: "List fixture orders",
          },
          requiredPermission: "fixture-orders.order:view",
          logLevel: "basic",
          requestSchemaId: "FixtureOrderListRequest",
          responseSchemaId: "FixtureOrderList",
        },
      ],
      routes: [
        {
          routeCode: "fixture-orders.orders",
          path: "/modules/fixture-orders/orders",
          title: {
            key: "modules.fixture-orders.routes.orders",
            defaultMessage: "Fixture orders",
          },
          requiredPermission: "fixture-orders.order:view",
          menuVisible: true,
        },
      ],
      menus: [
        {
          code: "fixture-orders.orders",
          path: "/modules/fixture-orders/orders",
          title: {
            key: "modules.fixture-orders.menus.orders",
            defaultMessage: "Fixture orders",
          },
          routeCode: "fixture-orders.orders",
          requiredPermission: "fixture-orders.order:view",
          sortOrder: 10,
        },
      ],
    },
  });
}
