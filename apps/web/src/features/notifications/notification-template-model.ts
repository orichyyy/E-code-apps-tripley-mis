import {
  createNotificationTemplateRequestSchema,
  updateNotificationTemplateRequestSchema,
  type CreateNotificationTemplateRequest,
  type UpdateNotificationTemplateRequest
} from "@web-admin-base/contracts";
import { z } from "zod";

export type NotificationTemplateFormMode = "create" | "edit";

export type NotificationTemplateFormValues = {
  code: string;
  channel: "in_app" | "email" | "sms";
  locale: string;
  subject: string;
  body: string;
  variablesText: string;
};

export const notificationTemplateFormSchema = z.object({
  code: z.string().min(1),
  channel: z.enum(["in_app", "email", "sms"]),
  locale: z.string().min(1),
  subject: z.string(),
  body: z.string().min(1),
  variablesText: z.string()
});

export const defaultNotificationTemplateFormValues: NotificationTemplateFormValues = {
  code: "",
  channel: "in_app",
  locale: "en",
  subject: "",
  body: "",
  variablesText: ""
};

export function toNotificationTemplateApiInput(
  value: NotificationTemplateFormValues,
  mode: NotificationTemplateFormMode
): CreateNotificationTemplateRequest | UpdateNotificationTemplateRequest {
  const input = {
    code: value.code.trim(),
    channel: value.channel,
    locale: value.locale.trim(),
    subject: value.subject.trim() || null,
    body: value.body,
    variables: parseVariables(value.variablesText)
  };

  return mode === "create"
    ? createNotificationTemplateRequestSchema.parse(input)
    : updateNotificationTemplateRequestSchema.parse(input);
}

function parseVariables(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
