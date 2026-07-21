import { webhookEventCatalog, type WebhookEventCatalogEntry } from "@web-admin-base/contracts";

import { createKnownError } from "../../core/errors/error-codes";

export type WebhookEventCatalogSource = () => Promise<readonly WebhookEventCatalogEntry[]>;

export function listWebhookEventCatalog(source?: WebhookEventCatalogSource) {
  return source?.() ?? Promise.resolve(webhookEventCatalog);
}

export async function assertWebhookEventTypes(
  source: WebhookEventCatalogSource | undefined,
  eventTypes: readonly string[],
): Promise<void> {
  const catalog = await listWebhookEventCatalog(source);
  const allowed = new Set(catalog.map(({ type }) => type));
  const unsupported = eventTypes.find((eventType) => !allowed.has(eventType));
  if (!unsupported) return;
  throw createKnownError("VALIDATION_INVALID_REQUEST", {
    field: "eventTypes",
    reason: `Webhook event type ${unsupported} is not active or registered.`,
  });
}
