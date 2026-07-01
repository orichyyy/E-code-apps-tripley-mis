import { loginRequestSchema } from "@web-admin-base/contracts";
import { Hono } from "hono";

import { createKnownError } from "../../core/errors/error-codes";
import type { BackendCoreServices } from "./services";

export function createAuthRoutes(services: BackendCoreServices) {
  const routes = new Hono();

  routes.post("/auth/login", async (context) => {
    const input = loginRequestSchema.parse(await context.req.json());
    const result = await services.login(input, {
      ipAddress: context.req.header("x-forwarded-for") ?? null,
      userAgent: context.req.header("user-agent") ?? null
    });

    context.header(
      "set-cookie",
      `refresh_token=${result.refreshToken}; HttpOnly; SameSite=Strict; Path=/api/auth; Max-Age=2592000`
    );

    return context.json({
      data: {
        accessToken: result.accessToken,
        refreshTokenCookie: result.refreshTokenCookie,
        session: result.session,
        user: result.user
      }
    });
  });

  routes.post("/auth/logout", async (context) => {
    const body = (await context.req.json()) as { sessionId?: string };
    if (!body.sessionId) throw createKnownError("VALIDATION_REQUIRED_FIELD");
    return context.json({ data: services.logout(body.sessionId) });
  });

  routes.post("/auth/refresh", (context) => {
    const refreshToken = readCookie(context.req.header("cookie") ?? "", "refresh_token");
    if (!refreshToken) throw createKnownError("AUTH_TOKEN_EXPIRED");
    return context.json({ data: services.refreshAccessToken(refreshToken) });
  });

  routes.get("/online-users", (context) => {
    return context.json({ data: services.listOnlineUsers() });
  });

  return routes;
}

function readCookie(cookieHeader: string, name: string): string | null {
  const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
  const prefix = `${name}=`;
  const cookie = cookies.find((candidate) => candidate.startsWith(prefix));
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null;
}
