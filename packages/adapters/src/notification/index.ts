import type { HealthCheckableAdapter } from "../health";

export type NotificationMessage = {
  channel: "email" | "webhook" | "sms";
  recipient: string;
  subject?: string;
  body: string;
  metadata?: Record<string, unknown>;
};

export type NotificationChannelAdapter = HealthCheckableAdapter & {
  send: (message: NotificationMessage) => Promise<void>;
};
