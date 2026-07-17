import {
  createWebhookHttpClient,
  createWebhookSignature,
  decryptWebhookSecret,
  type AlertIntegration,
  type WebhookDeliveryConfig,
  type WebhookHttpClient,
  type WebhookHttpResult,
} from "@web-admin-base/adapters";
import { createCloudEventEnvelope } from "@web-admin-base/contracts";

import {
  WebhookDeliveryRepository,
  type ClaimedWebhookDelivery,
  type WebhookAttemptResult,
} from "./webhook-delivery.repository";

export type WebhookDeliveryProcessor = {
  processReady: () => Promise<number>;
  fanOutPending: () => Promise<number>;
};

export function createWebhookDeliveryProcessor(options: {
  repository: WebhookDeliveryRepository;
  config: WebhookDeliveryConfig;
  workerId: string;
  httpClient?: WebhookHttpClient;
  log?: (entry: Record<string, unknown>) => void;
  alert?: AlertIntegration;
}): WebhookDeliveryProcessor {
  const httpClient = options.httpClient ?? createWebhookHttpClient({
    timeoutMs: options.config.requestTimeoutMs,
    allowedHosts: options.config.allowedHosts,
    allowInsecureLocalhost: options.config.allowInsecureLocalhost,
  });
  return {
    async fanOutPending() {
      if (!options.config.enabled) return 0;
      return options.repository.fanOutPending(options.config.eventSource, options.config.maxAttempts);
    },
    async processReady() {
      if (!options.config.enabled) return 0;
      await options.repository.recoverStaleRunning();
      const deliveries = await options.repository.claimReady(options.workerId, options.config.concurrency);
      await Promise.all(deliveries.map(async (delivery) => {
        const result = await deliverOne(delivery, options.config, httpClient);
        await options.repository.recordAttempt(result);
        options.log?.(safeLog(delivery, result));
        if (result.status === "failed" && !result.retry) {
          await options.alert?.notify({
            severity: "error",
            code: "WEBHOOK_DELIVERY_FAILED",
            message: "Webhook delivery exhausted its configured attempts.",
            metadata: safeLog(delivery, result),
            createdAt: result.finishedAt,
          });
        }
      }));
      return deliveries.length;
    },
  };
}

async function deliverOne(
  delivery: ClaimedWebhookDelivery,
  config: WebhookDeliveryConfig,
  httpClient: WebhookHttpClient,
): Promise<WebhookAttemptResult> {
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  try {
    const envelope = createCloudEventEnvelope(delivery.eventId, delivery.eventSource, delivery.event);
    const body = JSON.stringify(envelope);
    const timestamp = Math.floor(Date.now() / 1000);
    const headers: Record<string, string> = {
      "content-type": "application/cloudevents+json",
      "user-agent": "web-admin-base-system-webhook/1.0",
      "x-webhook-id": delivery.id,
      "x-webhook-event": delivery.event.type,
      "x-webhook-attempt": String(delivery.attempt),
      "x-webhook-timestamp": String(timestamp),
    };
    if (delivery.encryptedSecret) {
      const secret = decryptWebhookSecret(delivery.encryptedSecret, config.secretKeys);
      headers["x-webhook-signature"] = createWebhookSignature(secret, timestamp, body);
    }
    const response = await httpClient.send({ url: delivery.targetUrl, body, headers });
    return resultFromResponse(delivery, response, startedAt, startedMs);
  } catch (error) {
    return failedResult(delivery, startedAt, startedMs, "NETWORK_OR_SECURITY_ERROR",
      safeError(error), delivery.attempt < delivery.maxAttempts, null, null);
  }
}

function resultFromResponse(
  delivery: ClaimedWebhookDelivery,
  response: WebhookHttpResult,
  startedAt: string,
  startedMs: number,
): WebhookAttemptResult {
  if (response.statusCode >= 200 && response.statusCode < 300) {
    return { delivery, status: "succeeded", retry: false, startedAt,
      finishedAt: new Date().toISOString(), durationMs: response.durationMs,
      httpStatus: response.statusCode, errorCode: null, errorMessage: null, nextAttemptAt: null };
  }
  const retryable = response.statusCode === 408 || response.statusCode === 425 ||
    response.statusCode === 429 || response.statusCode >= 500;
  const retry = retryable && delivery.attempt < delivery.maxAttempts;
  return failedResult(delivery, startedAt, startedMs, `HTTP_${response.statusCode}`,
    `Webhook receiver returned HTTP ${response.statusCode}.`, retry, response.statusCode,
    retry ? nextAttempt(delivery.attempt, response.retryAfter, response.statusCode) : null);
}

function failedResult(
  delivery: ClaimedWebhookDelivery,
  startedAt: string,
  startedMs: number,
  errorCode: string,
  errorMessage: string,
  retry: boolean,
  httpStatus: number | null,
  nextAttemptAt: string | null,
): WebhookAttemptResult {
  const finishedAt = new Date().toISOString();
  return { delivery, status: "failed", retry, startedAt, finishedAt,
    durationMs: Math.max(0, Date.now() - startedMs), httpStatus, errorCode,
    errorMessage: errorMessage.slice(0, 500), nextAttemptAt: retry ? nextAttemptAt ?? nextAttempt(delivery.attempt) : null };
}

function nextAttempt(attempt: number, retryAfter: string | null = null, status = 0): string {
  const retryAfterMs = (status === 429 || status === 503) ? parseRetryAfter(retryAfter) : null;
  const delays = [30, 120, 600, 1800];
  const seconds = retryAfterMs ?? delays[Math.min(Math.max(attempt - 1, 0), delays.length - 1)] ?? 1800;
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = /^\d+$/.test(value) ? Number(value) : Math.ceil((Date.parse(value) - Date.now()) / 1000);
  return Number.isFinite(seconds) ? Math.min(3600, Math.max(30, seconds)) : null;
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/https?:\/\/[^\s]+/gi, "[webhook-url]").slice(0, 500);
}

function safeLog(delivery: ClaimedWebhookDelivery, result: WebhookAttemptResult) {
  let targetHost = "invalid";
  try { targetHost = new URL(delivery.targetUrl).hostname; } catch { /* safe fallback */ }
  return { eventId: delivery.eventId, deliveryId: delivery.id,
    subscriptionId: delivery.subscriptionId, eventType: delivery.event.type,
    attempt: delivery.attempt, targetHost, httpStatus: result.httpStatus,
    durationMs: result.durationMs, outcome: result.status, errorCode: result.errorCode };
}
