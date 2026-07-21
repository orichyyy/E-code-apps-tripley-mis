import { randomUUID } from "node:crypto";

import type { NotificationChannelAdapter, NotificationMessage } from ".";
import {
  createNodeSmtpTransport,
  type SmtpNotificationConfig,
  type SmtpTransport,
} from "./smtp-transport";

export * from "./smtp-transport";

export function createSmtpNotificationChannelAdapter(
  config: SmtpNotificationConfig,
  transport: SmtpTransport = createNodeSmtpTransport(),
): NotificationChannelAdapter {
  return {
    async healthCheck() {
      if (transport.healthCheck) return transport.healthCheck();
      return {
        ok: Boolean(config.host && config.port > 0 && config.from),
        details: { host: config.host, port: config.port, secure: config.secure },
      };
    },
    async send(message: NotificationMessage) {
      if (message.channel !== "email") {
        throw new Error(
          `SMTP notification channel only supports email messages, received ${message.channel}.`,
        );
      }
      await transport.send(
        {
          from: config.from,
          recipient: message.recipient,
          subject: message.subject,
          body: message.body,
          messageId: message.messageId ?? `<${randomUUID()}@web-admin-base.local>`,
        },
        config,
      );
    },
  };
}
