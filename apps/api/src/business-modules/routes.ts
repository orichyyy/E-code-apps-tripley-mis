import { Hono } from "hono";

import type { AppBindings } from "../app-bindings";
import type { BusinessModuleCapabilityFactory } from "./capabilities/factory";

export type BusinessModuleRouteDependencies = {
  capabilityFactory?: BusinessModuleCapabilityFactory;
};

export function createBusinessModuleRoutes(dependencies: BusinessModuleRouteDependencies = {}) {
  // The empty production registry has no routers yet; future explicit route composition consumes this factory.
  void dependencies.capabilityFactory;
  return new Hono<AppBindings>();
}
