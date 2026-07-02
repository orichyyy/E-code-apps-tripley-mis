import { Hono } from "hono";

import { createKnownError } from "../../core/errors/error-codes";
import { pageItems } from "./pagination";
import type { RouteMetadataListFilters } from "./route-metadata.service";
import type { BackendCoreServices } from "./services";

export function createRouteMetadataRoutes(services: BackendCoreServices) {
  const routes = new Hono();

  routes.get("/routes/manifest", (context) => {
    const routeMetadata = services.listRoutes({
      keyword: context.req.query("keyword"),
      menuVisible: parseOptionalBoolean(context.req.query("menuVisible")),
      path: context.req.query("path"),
      requiredPermission: context.req.query("requiredPermission"),
      routeCode: context.req.query("routeCode"),
      status: context.req.query("status") as RouteMetadataListFilters["status"] | undefined
    });
    return context.json({
      data: hasPaginationQuery(context)
        ? pageItems(routeMetadata, {
            page: context.req.query("page"),
            pageSize: context.req.query("pageSize")
          })
        : routeMetadata
    });
  });

  routes.post("/routes/sync", async (context) => {
    return context.json({ data: await services.syncRoutes() });
  });

  return routes;
}

function hasPaginationQuery(context: { req: { query: (name: string) => string | undefined } }): boolean {
  return context.req.query("page") !== undefined || context.req.query("pageSize") !== undefined;
}

function parseOptionalBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  throw createKnownError("VALIDATION_INVALID_REQUEST");
}
