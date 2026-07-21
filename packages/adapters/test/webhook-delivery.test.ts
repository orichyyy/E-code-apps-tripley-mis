import { createServer } from "node:http";
import { randomBytes } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import {
  createWebhookHttpClient,
  createWebhookSignature,
  decryptWebhookSecret,
  encryptWebhookSecret,
  isForbiddenAddress,
  loadWebhookDeliveryConfig,
  resolveWebhookTarget,
} from "../src";

const servers: Array<ReturnType<typeof createServer>> = [];

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  );
});

describe("webhook delivery adapter", () => {
  it("loads bounded configuration and validates the encryption keyring", () => {
    const encoded = randomBytes(32).toString("base64");
    const config = loadWebhookDeliveryConfig({
      NODE_ENV: "test",
      WEBHOOK_DELIVERY_ENABLED: "true",
      WEBHOOK_SECRET_KEYS: JSON.stringify({ active: encoded }),
      WEBHOOK_SECRET_ACTIVE_KEY_ID: "active",
      WEBHOOK_ALLOWED_HOSTS: "hooks.example.com, internal.example.com",
    });
    expect(config.enabled).toBe(true);
    expect(config.allowedHosts).toEqual(new Set(["hooks.example.com", "internal.example.com"]));
    expect(config.secretKeys.get("active")).toHaveLength(32);
    expect(() => loadWebhookDeliveryConfig({ WEBHOOK_MAX_ATTEMPTS: "0" })).toThrow();
    expect(() =>
      loadWebhookDeliveryConfig({
        NODE_ENV: "production",
        WEBHOOK_ALLOW_INSECURE_LOCALHOST: "true",
      }),
    ).toThrow(/forbidden in production/);
  });

  it("encrypts secrets and signs the exact timestamp and body", () => {
    const keyring = new Map([["primary", randomBytes(32)]]);
    const envelope = encryptWebhookSecret("delivery-secret", "primary", keyring);
    expect(envelope).not.toContain("delivery-secret");
    expect(decryptWebhookSecret(envelope, keyring)).toBe("delivery-secret");
    expect(createWebhookSignature("secret", 1_700_000_000, '{"ok":true}')).toBe(
      "v1=c1afc7c2df3db0690d7d75954610ed1a1d959ce96355ccb8c0a8bc09fd0cfc27",
    );
  });

  it("rejects private destinations unless the exact host is explicitly allowed", async () => {
    expect(isForbiddenAddress("127.0.0.1")).toBe(true);
    expect(isForbiddenAddress("10.1.2.3")).toBe(true);
    expect(isForbiddenAddress("8.8.8.8")).toBe(false);
    expect(isForbiddenAddress("::ffff:7f00:1")).toBe(true);
    await expect(resolveWebhookTarget("https://127.0.0.1/hook")).rejects.toThrow(/forbidden/);
    await expect(
      resolveWebhookTarget("https://internal.example/hook", {
        allowedHosts: new Set(["internal.example"]),
        resolve: async () => [{ address: "10.0.0.8", family: 4 }] as never,
      }),
    ).resolves.toMatchObject({ address: "10.0.0.8" });
  });

  it("posts to an explicitly enabled localhost receiver without following redirects", async () => {
    const received: string[] = [];
    const server = createServer((request, response) => {
      request.on("data", (chunk) => received.push(chunk.toString()));
      request.on("end", () => {
        response.statusCode = 302;
        response.setHeader("location", "/must-not-follow");
        response.end();
      });
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP server address.");

    const client = createWebhookHttpClient({ timeoutMs: 1_000, allowInsecureLocalhost: true });
    const result = await client.send({
      url: `http://127.0.0.1:${address.port}/hook`,
      body: "payload",
      headers: { "content-type": "application/cloudevents+json" },
    });

    expect(result.statusCode).toBe(302);
    expect(received.join("")).toBe("payload");
  });

  it("aborts responses that exceed the configured read limit", async () => {
    const server = createServer((_request, response) => {
      response.write(Buffer.alloc(32, "a"));
      response.end(Buffer.alloc(32, "b"));
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP server address.");

    const client = createWebhookHttpClient({
      timeoutMs: 1_000,
      responseLimitBytes: 16,
      allowInsecureLocalhost: true,
    });

    await expect(
      client.send({
        url: `http://127.0.0.1:${address.port}/hook`,
        body: "payload",
        headers: { "content-type": "application/cloudevents+json" },
      }),
    ).rejects.toThrow();
  });
});
