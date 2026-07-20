import {
  updateI18nMessageRequestSchema,
  type UpdateI18nMessageRequest,
} from "@web-admin-base/contracts";
import { z } from "zod";

export type I18nMessageFormValues = {
  overrideValue: string;
};

export const i18nMessageFormSchema = z.object({
  overrideValue: z.string(),
});

export function toI18nMessageApiInput(value: I18nMessageFormValues): UpdateI18nMessageRequest {
  return updateI18nMessageRequestSchema.parse({
    overrideValue: value.overrideValue.trim() || null,
  });
}
