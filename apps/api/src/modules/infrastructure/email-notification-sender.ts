import type { NotificationChannelAdapter } from "@web-admin-base/adapters";
import type { SendTestEmailNotificationRequest } from "@web-admin-base/contracts";

import { createKnownError } from "../../core/errors/error-codes";
import { renderStrictEmailTemplate } from "./email-delivery-domain";

export type NotificationTemplateRecord = Record<string, unknown> & {
  id: string;
  code: string;
  channel: string;
  locale: string;
  subject?: string | null;
  body: string;
  variables: string[];
  status: string;
};

export async function sendTestEmailNotification(
  input: SendTestEmailNotificationRequest,
  dependencies: {
    listTemplates: () => Promise<unknown[]>;
    notificationChannel: NotificationChannelAdapter;
  },
) {
  const template = await findEnabledEmailTemplate(
    await dependencies.listTemplates(),
    input.templateCode,
    input.locale,
  );
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
  const { subject, body } = rendered;
  const sentAt = new Date().toISOString();

  await dependencies.notificationChannel.send({
    channel: "email",
    recipient: input.recipient,
    subject,
    body,
    metadata: {
      templateCode: input.templateCode,
      locale: input.locale,
      variables: input.variables,
      sentAt,
    },
  });

  return {
    channel: "email",
    recipient: input.recipient,
    templateCode: input.templateCode,
    locale: input.locale,
    subject,
    status: "sent",
    sentAt,
  };
}

function findEnabledEmailTemplate(
  templates: unknown[],
  code: string,
  locale: string,
): NotificationTemplateRecord {
  const template = (templates as NotificationTemplateRecord[]).find(
    (item) =>
      item.code === code &&
      item.locale === locale &&
      item.channel === "email" &&
      (item.status ?? "enabled") === "enabled",
  );
  if (!template) {
    throw createKnownError("VALIDATION_INVALID_REQUEST", {
      templateCode: code,
      locale,
      channel: "email",
    });
  }
  return template;
}
