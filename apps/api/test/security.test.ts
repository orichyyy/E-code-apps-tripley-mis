import { describe, expect, it } from "vitest";

import { serializeId } from "../src/core/ids";
import { hashPassword, verifyPassword } from "../src/infra/security/password-hash";
import {
  defaultPasswordPolicy,
  validatePasswordComplexity
} from "../src/infra/security/password-policy";
import { signAccessToken, verifyAccessToken } from "../src/infra/security/jwt";

describe("backend security foundation", () => {
  it("serializes API IDs as strings", () => {
    expect(serializeId(123)).toBe("123");
    expect(serializeId(456n)).toBe("456");
  });

  it("enforces the default password complexity policy", () => {
    expect(validatePasswordComplexity("password", defaultPasswordPolicy)).toMatchObject({
      valid: false,
      reasons: ["PASSWORD_REQUIRES_NUMBER"]
    });
    expect(validatePasswordComplexity("password1", defaultPasswordPolicy)).toMatchObject({
      valid: true
    });
  });

  it("hashes and verifies passwords without storing plaintext", async () => {
    const passwordHash = await hashPassword("password1");

    expect(passwordHash).not.toContain("password1");
    await expect(verifyPassword("password1", passwordHash)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", passwordHash)).resolves.toBe(false);
  });

  it("signs and verifies HS256 access tokens", () => {
    const token = signAccessToken(
      {
        sub: "1",
        sid: "1",
        username: "admin",
        currentOrganizationId: "1",
        tokenVersion: 0,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 60
      },
      {
        issuer: "web-admin-base",
        secret: "test-secret"
      }
    );
    const payload = decodeJwtPayload(token);

    expect(verifyAccessToken(token, { issuer: "web-admin-base", secret: "test-secret" })).toMatchObject({
      sub: "1",
      sid: "1",
      username: "admin",
      currentOrganizationId: "1",
      tokenVersion: 0
    });
    expect(payload).toMatchObject({ token_version: 0 });
    expect(payload).not.toHaveProperty("tokenVersion");
  });

  it("rejects signed access tokens with invalid claim shapes", () => {
    const token = signAccessToken(
      {
        sub: "",
        sid: "1",
        username: "admin",
        currentOrganizationId: "1",
        tokenVersion: 0,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 60
      },
      {
        issuer: "web-admin-base",
        secret: "test-secret"
      }
    );

    expect(() => verifyAccessToken(token, { issuer: "web-admin-base", secret: "test-secret" }))
      .toThrow("Invalid JWT claims");
  });
});

function decodeJwtPayload(token: string): Record<string, unknown> {
  const payload = token.split(".")[1];
  if (!payload) throw new Error("Missing JWT payload");
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
}
