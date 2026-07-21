import type { HealthCheckableAdapter } from "../health";

export type NotificationMessage = {
  channel: "email" | "webhook" | "sms";
  recipient: string;
  subject?: string;
  body: string;
  messageId?: string;
  metadata?: Record<string, unknown>;
};

export type NotificationChannelAdapter = HealthCheckableAdapter & {
  send: (message: NotificationMessage) => Promise<void>;
};

export * from "./in-memory-notification";
export * from "./email-content-crypto";
export * from "./email-delivery-config";
export * from "./smtp-notification";
export * from "./webhook-config";
export * from "./webhook-http";
export * from "./webhook-notification";
export * from "./webhook-secret-crypto";
export * from "./webhook-signature";
export * from "./webhook-url-policy";
