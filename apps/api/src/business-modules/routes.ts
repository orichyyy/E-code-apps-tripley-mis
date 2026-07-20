import { Hono } from "hono";

import type { AppBindings } from "../app-bindings";

export function createBusinessModuleRoutes() {
  return new Hono<AppBindings>();
}
