import { z } from "zod";

import { moduleCodeSchema, namespacedCodeSchema } from "./common";

const identifierSchema = z.string().min(1);

export const businessModuleMaxFileSizeBytes = 50 * 1024 * 1024;
export const businessModuleOperationLogJobType = "business-module.operation-log.write";
export const businessModuleCsvProcessJobType = "business-module.csv.process";
export const businessModuleFileExtensionWhitelist = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "csv",
  "txt",
  "zip",
] as const;

export const moduleExecutionContextSchema = z
  .object({
    moduleCode: moduleCodeSchema,
    source: z.enum(["api", "worker"]),
    actorId: identifierSchema.nullable(),
    organizationId: identifierSchema.nullable(),
    sessionId: identifierSchema.nullable(),
    requestId: identifierSchema,
    traceId: identifierSchema,
    correlationId: identifierSchema,
    locale: z.string().min(2),
  })
  .strict();

export const moduleAsyncMessageSchema = z
  .object({
    messageId: identifierSchema,
    idempotencyKey: identifierSchema,
    context: moduleExecutionContextSchema,
    payload: z.unknown(),
    execution: z
      .object({
        timeoutSeconds: z.number().int().positive(),
        maxAttempts: z.number().int().positive(),
      })
      .strict()
      .optional(),
    createdAt: z.string().datetime(),
  })
  .strict();

export const moduleOperationOutcomeSchema = z.enum(["succeeded", "failed"]);

export const moduleOperationEventInputSchema = z
  .object({
    eventCode: namespacedCodeSchema,
    outcome: moduleOperationOutcomeSchema,
    targetId: identifierSchema.optional(),
    targetSummary: z.string().max(500).optional(),
    details: z.record(z.string(), z.unknown()).default({}),
    errorCode: z.string().min(1).optional(),
  })
  .strict();

export const moduleOperationLogJobSchema = z
  .object({
    context: moduleExecutionContextSchema,
    event: moduleOperationEventInputSchema,
  })
  .strict();

export const moduleFileReferenceSchema = z
  .object({
    id: identifierSchema,
    fileId: identifierSchema,
    attachmentCode: namespacedCodeSchema,
    resourceType: namespacedCodeSchema,
    resourceId: identifierSchema,
    status: z.enum(["active", "invalid"]),
    createdAt: z.string().datetime(),
  })
  .strict();

export const moduleCsvTaskSchema = z
  .object({
    id: identifierSchema,
    taskType: z.enum(["import", "export"]),
    resourceType: z.string().min(3),
    status: z.enum(["pending", "running", "succeeded", "failed"]),
  })
  .strict();

export type ModuleExecutionContext = z.infer<typeof moduleExecutionContextSchema>;
export type ModuleAsyncMessage<TPayload = unknown> = Omit<
  z.infer<typeof moduleAsyncMessageSchema>,
  "payload"
> & { payload: TPayload };
export type ModuleOperationEventInput = z.infer<typeof moduleOperationEventInputSchema>;
export type ModuleOperationLogJob = z.infer<typeof moduleOperationLogJobSchema>;
export type ModuleFileReference = z.infer<typeof moduleFileReferenceSchema>;
export type ModuleCsvTask = z.infer<typeof moduleCsvTaskSchema>;
