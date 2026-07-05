import { z } from "zod";

const strictObject = <T extends z.ZodRawShape>(shape: T) => z.object(shape).strict();

export const createLogExportTaskRequestSchema = strictObject({
  logType: z.enum([
    "login",
    "operation",
    "access",
    "api_call",
    "exception",
    "security",
    "scheduler",
    "file_operation",
  ]),
});

export const createNotificationTemplateRequestSchema = strictObject({
  code: z.string().min(1),
  channel: z.enum(["in_app", "email", "sms"]),
  locale: z.string().min(1),
  subject: z.string().nullable().optional(),
  body: z.string().min(1),
  variables: z.array(z.string()).default([]),
});

export const updateNotificationTemplateRequestSchema =
  createNotificationTemplateRequestSchema.partial();

export const sendTestEmailNotificationRequestSchema = strictObject({
  templateCode: z.string().min(1),
  locale: z.string().min(1),
  recipient: z.string().email(),
  variables: z.record(z.unknown()).default({}),
});

export const createScheduledTaskRequestSchema = strictObject({
  code: z.string().min(1),
  cronExpression: z.string().min(1),
  handlerType: z.string().min(1),
  payload: z.record(z.unknown()).default({}),
  enabled: z.boolean().default(true),
});

export const updateScheduledTaskRequestSchema = createScheduledTaskRequestSchema.partial();

export const createExportTaskRequestSchema = strictObject({
  resourceType: z.string().min(1),
});

export type CreateLogExportTaskRequest = z.infer<typeof createLogExportTaskRequestSchema>;
export type CreateNotificationTemplateRequest = z.infer<
  typeof createNotificationTemplateRequestSchema
>;
export type UpdateNotificationTemplateRequest = z.infer<
  typeof updateNotificationTemplateRequestSchema
>;
export type SendTestEmailNotificationRequest = z.infer<
  typeof sendTestEmailNotificationRequestSchema
>;
export type CreateScheduledTaskRequest = z.infer<typeof createScheduledTaskRequestSchema>;
export type UpdateScheduledTaskRequest = z.infer<typeof updateScheduledTaskRequestSchema>;
export type CreateExportTaskRequest = z.infer<typeof createExportTaskRequestSchema>;
