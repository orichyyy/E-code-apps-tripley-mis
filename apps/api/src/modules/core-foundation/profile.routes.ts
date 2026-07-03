import {
  updateOwnAvatarRequestSchema,
  updateOwnPreferencesRequestSchema,
  updateOwnProfileRequestSchema
} from "@web-admin-base/contracts";
import { Hono } from "hono";

import type { AuthContextVariables } from "../../core/auth-context/auth-context";
import { createKnownError } from "../../core/errors/error-codes";
import type { BackendCoreServices } from "./services";

type ProfileRouteBindings = {
  Variables: AuthContextVariables;
};

export function createProfileRoutes(services: BackendCoreServices) {
  const routes = new Hono<ProfileRouteBindings>();

  routes.get("/profile", (context) => {
    const authContext = context.get("authContext");
    if (!authContext) throw createKnownError("AUTH_TOKEN_EXPIRED");
    return context.json({ data: services.getProfile(authContext) });
  });

  routes.patch("/profile", async (context) => {
    const authContext = context.get("authContext");
    if (!authContext) throw createKnownError("AUTH_TOKEN_EXPIRED");
    const input = updateOwnProfileRequestSchema.parse(await context.req.json());
    return context.json({ data: await services.updateOwnProfile(authContext, input) });
  });

  routes.patch("/profile/preferences", async (context) => {
    const authContext = context.get("authContext");
    if (!authContext) throw createKnownError("AUTH_TOKEN_EXPIRED");
    const input = updateOwnPreferencesRequestSchema.parse(await context.req.json());
    return context.json({ data: await services.updateOwnPreferences(authContext, input) });
  });

  routes.post("/profile/avatar", async (context) => {
    const authContext = context.get("authContext");
    if (!authContext) throw createKnownError("AUTH_TOKEN_EXPIRED");
    const input = updateOwnAvatarRequestSchema.parse(await context.req.json());
    return context.json({ data: await services.updateOwnAvatar(authContext, input) });
  });

  return routes;
}
