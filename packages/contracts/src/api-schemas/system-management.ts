import { z } from "zod";

const strictObject = <T extends z.ZodRawShape>(shape: T) => z.object(shape).strict();

export const configValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.record(z.unknown()),
  z.array(z.unknown())
]);

export const updateSystemConfigRequestSchema = strictObject({
  configValue: configValueSchema
});

export const dictionaryStatusSchema = z.enum(["enabled", "disabled"]);

export const createDictionaryTypeRequestSchema = strictObject({
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  status: dictionaryStatusSchema.default("enabled")
});

export const updateDictionaryTypeRequestSchema = strictObject({
  code: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: dictionaryStatusSchema.optional()
});

export const createDictionaryItemRequestSchema = strictObject({
  itemValue: z.string().min(1),
  labelI18nKey: z.string().min(1),
  sortOrder: z.number().int().default(0),
  status: dictionaryStatusSchema.default("enabled")
});

export const updateDictionaryItemRequestSchema = strictObject({
  itemValue: z.string().min(1).optional(),
  labelI18nKey: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
  status: dictionaryStatusSchema.optional()
});

export const updateI18nMessageRequestSchema = strictObject({
  messageValue: z.string()
});

export type UpdateSystemConfigRequest = z.infer<typeof updateSystemConfigRequestSchema>;
export type CreateDictionaryTypeRequest = z.infer<typeof createDictionaryTypeRequestSchema>;
export type UpdateDictionaryTypeRequest = z.infer<typeof updateDictionaryTypeRequestSchema>;
export type CreateDictionaryItemRequest = z.infer<typeof createDictionaryItemRequestSchema>;
export type UpdateDictionaryItemRequest = z.infer<typeof updateDictionaryItemRequestSchema>;
export type UpdateI18nMessageRequest = z.infer<typeof updateI18nMessageRequestSchema>;
