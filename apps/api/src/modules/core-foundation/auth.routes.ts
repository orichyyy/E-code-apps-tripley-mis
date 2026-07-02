import {
  changePasswordRequestSchema,
  loginRequestSchema,
  logoutRequestSchema,
  switchCurrentOrganizationRequestSchema
} from "@web-admin-base/contracts";
import { Hono } from "hono";

import type { AuthContextVariables } from "../../core/auth-context/auth-context";
import { createKnownError } from "../../core/errors/error-codes";
import { pageItems } from "./pagination";
import type { BackendCoreServices } from "./services";

type AuthRouteBindings = {
  Variables: AuthContextVariables;
};

export function createAuthRoutes(services: BackendCoreServices) {
  const routes = new Hono<AuthRouteBindings>();

  routes.post("/auth/login", async (context) => {
    const input = loginRequestSchema.parse(await context.req.json());
    const result = await services.login(input, {
      ipAddress: context.req.header("x-forwarded-for") ?? null,
      userAgent: context.req.header("user-agent") ?? null
    });

    context.header(
      "set-cookie",
      formatRefreshTokenCookie(result.refreshToken, {
        path: result.refreshTokenCookie.path,
        maxAgeSeconds: result.refreshTokenCookie.maxAgeSeconds
      })
    );

    return context.json({
      data: {
        accessToken: result.accessToken,
        refreshTokenCookie: result.refreshTokenCookie,
        session: result.session,
        user: result.user,
        currentOrganization: result.currentOrganization,
        organizations: result.organizations,
        permissionCodes: result.permissionCodes,
        menus: result.menus,
        passwordChangeRequired: result.passwordChangeRequired
      }
    });
  });

  routes.get("/auth/me", async (context) => {
    const authContext = context.get("authContext");
    if (!authContext) throw createKnownError("AUTH_TOKEN_EXPIRED");
    return context.json({ data: await services.getCurrentUserContext(authContext) });
  });

  routes.post("/auth/logout", async (context) => {
    const authContext = context.get("authContext");
    if (!authContext) throw createKnownError("AUTH_TOKEN_EXPIRED");
    const body = logoutRequestSchema.parse((await readOptionalJson(context.req.raw)) ?? {});
    if (body?.sessionId && body.sessionId !== authContext.sessionId) {
      throw createKnownError("PERMISSION_DENIED");
    }
    const result = await services.logout(authContext.sessionId);
    context.header(
      "set-cookie",
      formatRefreshTokenCookie("", {
        path: services.getRefreshTokenCookiePath(),
        maxAgeSeconds: 0
      })
    );
    return context.json({ data: result });
  });

  routes.post("/auth/change-password", async (context) => {
    const authContext = context.get("authContext");
    if (!authContext) throw createKnownError("AUTH_TOKEN_EXPIRED");
    const input = changePasswordRequestSchema.parse(await context.req.json());
    return context.json({ data: await services.changePassword(authContext, input) });
  });

  routes.post("/context/current-organization", async (context) => {
    const authContext = context.get("authContext");
    if (!authContext) throw createKnownError("AUTH_TOKEN_EXPIRED");
    const input = switchCurrentOrganizationRequestSchema.parse(await context.req.json());
    return context.json({ data: await services.switchCurrentOrganization(authContext, input) });
  });

  routes.post("/auth/current-organization", async (context) => {
    const authContext = context.get("authContext");
    if (!authContext) throw createKnownError("AUTH_TOKEN_EXPIRED");
    const input = switchCurrentOrganizationRequestSchema.parse(await context.req.json());
    return context.json({ data: await services.switchCurrentOrganization(authContext, input) });
  });

  routes.get("/context/organizations", (context) => {
    const authContext = context.get("authContext");
    if (!authContext) throw createKnownError("AUTH_TOKEN_EXPIRED");
    return context.json({ data: services.listCurrentUserOrganizations(authContext) });
  });

  routes.get("/context/permissions", async (context) => {
    const authContext = context.get("authContext");
    if (!authContext) throw createKnownError("AUTH_TOKEN_EXPIRED");
    return context.json({ data: await services.getCurrentPermissionContext(authContext) });
  });

  routes.get("/permissions/effective", async (context) => {
    const authContext = context.get("authContext");
    if (!authContext) throw createKnownError("AUTH_TOKEN_EXPIRED");
    return context.json({ data: await services.getCurrentPermissionContext(authContext) });
  });

  routes.post("/auth/refresh", async (context) => {
    const refreshToken = readCookie(context.req.header("cookie") ?? "", "refresh_token");
    if (!refreshToken) throw createKnownError("AUTH_TOKEN_EXPIRED");
    return context.json({ data: await services.refreshAccessToken(refreshToken) });
  });

  routes.get("/online-users", (context) => {
    const authContext = context.get("authContext");
    if (!authContext) throw createKnownError("AUTH_TOKEN_EXPIRED");
    const onlineUsers = services.listOnlineUsers({
      currentOrganizationId: context.req.query("organizationId"),
      userId: context.req.query("userId")
    });
    return context.json({
      data: hasPaginationQuery(context)
        ? pageItems(onlineUsers, {
            page: context.req.query("page"),
            pageSize: context.req.query("pageSize")
          })
        : onlineUsers
    });
  });

  return routes;
}

function readCookie(cookieHeader: string, name: string): string | null {
  const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
  const prefix = `${name}=`;
  const cookie = cookies.find((candidate) => candidate.startsWith(prefix));
  if (!cookie) return null;
  try {
    return decodeURIComponent(cookie.slice(prefix.length));
  } catch {
    return null;
  }
}

function formatRefreshTokenCookie(
  value: string,
  options: { path: string; maxAgeSeconds: number }
): string {
  return [
    `refresh_token=${encodeURIComponent(value)}`,
    "HttpOnly",
    "SameSite=Strict",
    `Path=${options.path}`,
    `Max-Age=${options.maxAgeSeconds}`
  ].join("; ");
}

async function readOptionalJson<T>(request: Request): Promise<T | null> {
  if (!request.body) return null;
  const text = await request.text();
  if (!text.trim()) return null;
  return JSON.parse(text) as T;
}

function hasPaginationQuery(context: { req: { query: (name: string) => string | undefined } }): boolean {
  return context.req.query("page") !== undefined || context.req.query("pageSize") !== undefined;
}
