import {
  randomBytes
} from "node:crypto";
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
import { assertEmptyJsonBody, readOptionalJson } from "./request-body";
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
        sameSite: result.refreshTokenCookie.sameSite,
        secure: result.refreshTokenCookie.secure,
        domain: result.refreshTokenCookie.domain,
        maxAgeSeconds: result.refreshTokenCookie.maxAgeSeconds
      }),
      { append: true }
    );
    context.header(
      "set-cookie",
      formatCsrfTokenCookie(createCsrfToken(), {
        path: result.refreshTokenCookie.path,
        sameSite: result.refreshTokenCookie.sameSite,
        secure: result.refreshTokenCookie.secure,
        domain: result.refreshTokenCookie.domain,
        maxAgeSeconds: result.refreshTokenCookie.maxAgeSeconds
      }),
      { append: true }
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
        passwordChangeRequired: result.passwordChangeRequired,
        preferences: result.preferences
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
    requireDoubleSubmitCsrf(context.req.header("cookie") ?? "", context.req.header("x-csrf-token"));
    if (body?.sessionId && body.sessionId !== authContext.sessionId) {
      throw createKnownError("PERMISSION_DENIED");
    }
    const result = await services.logout(authContext.sessionId);
    context.header(
      "set-cookie",
      formatRefreshTokenCookie("", {
        ...services.getRefreshTokenCookieOptions(),
        maxAgeSeconds: 0
      }),
      { append: true }
    );
    context.header(
      "set-cookie",
      formatCsrfTokenCookie("", {
        ...services.getRefreshTokenCookieOptions(),
        maxAgeSeconds: 0
      }),
      { append: true }
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
    await assertEmptyJsonBody(context.req.raw);
    const cookieHeader = context.req.header("cookie") ?? "";
    requireDoubleSubmitCsrf(cookieHeader, context.req.header("x-csrf-token"));
    const refreshToken = readCookie(cookieHeader, "refresh_token");
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

function createCsrfToken(): string {
  return randomBytes(32).toString("base64url");
}

function requireDoubleSubmitCsrf(cookieHeader: string, headerToken: string | undefined): void {
  const cookieToken = readCookie(cookieHeader, "csrf_token");
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    throw createKnownError("AUTH_CSRF_TOKEN_INVALID");
  }
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
  options: {
    path: string;
    sameSite: "Strict" | "Lax" | "None";
    secure: boolean;
    domain: string | null;
    maxAgeSeconds: number;
  }
): string {
  const parts = [
    `refresh_token=${encodeURIComponent(value)}`,
    "HttpOnly",
    `SameSite=${options.sameSite}`,
    `Path=${options.path}`,
    `Max-Age=${options.maxAgeSeconds}`
  ];
  if (options.secure) parts.push("Secure");
  if (options.domain) parts.push(`Domain=${options.domain}`);
  return parts.join("; ");
}

function formatCsrfTokenCookie(
  value: string,
  options: {
    path: string;
    sameSite: "Strict" | "Lax" | "None";
    secure: boolean;
    domain: string | null;
    maxAgeSeconds: number;
  }
): string {
  const parts = [
    `csrf_token=${encodeURIComponent(value)}`,
    `SameSite=${options.sameSite}`,
    `Path=${options.path}`,
    `Max-Age=${options.maxAgeSeconds}`
  ];
  if (options.secure) parts.push("Secure");
  if (options.domain) parts.push(`Domain=${options.domain}`);
  return parts.join("; ");
}

function hasPaginationQuery(context: { req: { query: (name: string) => string | undefined } }): boolean {
  return context.req.query("page") !== undefined || context.req.query("pageSize") !== undefined;
}
