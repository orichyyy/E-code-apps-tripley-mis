import http from "node:http";
import https from "node:https";

import { resolveWebhookTarget, type WebhookUrlPolicyOptions } from "./webhook-url-policy";

export type WebhookHttpRequest = {
  url: string;
  body: string;
  headers: Record<string, string>;
};

export type WebhookHttpResult = {
  statusCode: number;
  durationMs: number;
  retryAfter: string | null;
};

export type WebhookHttpClient = {
  send: (request: WebhookHttpRequest) => Promise<WebhookHttpResult>;
};

export type WebhookHttpClientOptions = WebhookUrlPolicyOptions & {
  timeoutMs: number;
  responseLimitBytes?: number;
};

export function createWebhookHttpClient(options: WebhookHttpClientOptions): WebhookHttpClient {
  return {
    async send(request) {
      const target = await resolveWebhookTarget(request.url, options);
      const startedAt = Date.now();
      return new Promise<WebhookHttpResult>((resolve, reject) => {
        const transport = target.url.protocol === "https:" ? https : http;
        const outgoing = transport.request(
          target.url,
          {
            method: "POST",
            headers: {
              ...request.headers,
              "content-length": Buffer.byteLength(request.body).toString(),
            },
            servername: target.url.hostname,
            lookup: (_hostname, _lookupOptions, callback) =>
              callback(null, target.address, target.family),
          },
          (response) => {
            let bytes = 0;
            let responseLimitExceeded = false;
            const limit = options.responseLimitBytes ?? 64 * 1024;
            response.on("data", (chunk: Buffer) => {
              bytes += chunk.byteLength;
              if (bytes > limit && !responseLimitExceeded) {
                responseLimitExceeded = true;
                response.destroy(new Error("Webhook response exceeded the configured read limit."));
              }
            });
            response.on("end", () => {
              if (responseLimitExceeded) return;
              resolve({
                statusCode: response.statusCode ?? 0,
                durationMs: Math.max(0, Date.now() - startedAt),
                retryAfter:
                  typeof response.headers["retry-after"] === "string"
                    ? response.headers["retry-after"]
                    : null,
              });
            });
            response.on("error", reject);
          },
        );
        outgoing.setTimeout(options.timeoutMs, () =>
          outgoing.destroy(new Error("Webhook request timed out.")),
        );
        outgoing.on("error", reject);
        outgoing.end(request.body);
      });
    },
  };
}
