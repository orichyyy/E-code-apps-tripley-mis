import { randomUUID } from "node:crypto";

import { encryptEmailContent, type EmailDeliveryConfig } from "@web-admin-base/adapters";
import type { EmailDeliveryListQuery, EmailNotificationRequest } from "@web-admin-base/contracts";
import { z } from "zod";

import { createKnownError } from "../../core/errors/error-codes";
import {
  createEmailRequestFingerprint,
  createStableMessageId,
  maskEmailAddress,
  renderStrictEmailTemplate,
} from "./email-delivery-domain";
import { EmailDeliveryRepository } from "./email-delivery.repository";

const emailAddressSchema = z.string().email();

export class EmailDeliveryService {
  constructor(
    private readonly repository: EmailDeliveryRepository,
    private readonly config: EmailDeliveryConfig,
  ) {}

  async request(input: EmailNotificationRequest) {
    const normalized = {
      userId: input.userId,
      templateCode: input.templateCode,
      variables: input.variables,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
    };
    const fingerprint = createEmailRequestFingerprint(normalized);
    const existing = await this.repository.findByRequestKey(input.requestKey, input.userId);
    if (existing) return this.assertIdempotent(existing, fingerprint);
    if (!this.config.enabled) throw createKnownError("BUSINESS_EMAIL_DELIVERY_DISABLED");

    const recipient = await this.repository.resolveEligibleRecipient(input.userId);
    if (!recipient || !emailAddressSchema.safeParse(recipient.email).success) {
      throw createKnownError("BUSINESS_EMAIL_RECIPIENT_INELIGIBLE", { userId: input.userId });
    }
    const template = await this.repository.findEnabledEmailTemplate(
      input.templateCode,
      recipient.locale,
    );
    if (!template) {
      throw createKnownError("VALIDATION_EMAIL_TEMPLATE_UNAVAILABLE", {
        templateCode: input.templateCode,
        locale: recipient.locale,
      });
    }

    let rendered: { subject: string; body: string };
    try {
      rendered = renderStrictEmailTemplate(
        template.subject ?? "",
        template.body,
        template.variables,
        input.variables,
      );
    } catch (error) {
      throw createKnownError("VALIDATION_TEMPLATE_VARIABLE_MISMATCH", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
    const keyId = this.config.activeKeyId;
    if (!keyId) throw createKnownError("SYSTEM_EMAIL_CONTENT_KEY_UNAVAILABLE");
    const deliveryToken = randomUUID();
    const created = await this.repository.create({
      requestKey: input.requestKey,
      requestFingerprint: fingerprint,
      userId: input.userId,
      template,
      maskedRecipient: maskEmailAddress(recipient.email),
      messageId: createStableMessageId(deliveryToken),
      contentKeyId: keyId,
      contentEnvelope: encryptEmailContent(
        { recipient: recipient.email, subject: rendered.subject, body: rendered.body },
        keyId,
        this.config.contentKeys,
      ),
      referenceType: normalized.referenceType,
      referenceId: normalized.referenceId,
      maxAttempts: this.config.maxAttempts,
    });
    if (!created) throw createKnownError("SYSTEM_INTERNAL_ERROR");
    return this.assertIdempotent(created, fingerprint);
  }

  list(query: EmailDeliveryListQuery) {
    return this.repository.list(query);
  }

  get(id: string) {
    return this.repository.get(id);
  }

  private assertIdempotent<T extends { requestFingerprint: string }>(
    delivery: T,
    fingerprint: string,
  ): T {
    if (delivery.requestFingerprint !== fingerprint) {
      throw createKnownError("BUSINESS_EMAIL_IDEMPOTENCY_CONFLICT");
    }
    return delivery;
  }
}
