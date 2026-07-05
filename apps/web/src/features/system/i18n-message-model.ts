import {
  updateI18nMessageRequestSchema,
  type UpdateI18nMessageRequest,
} from "@web-admin-base/contracts";
import { z } from "zod";

export type I18nMessageFormValues = {
  messageValue: string;
};

export const i18nMessageFormSchema = z.object({
  messageValue: z.string(),
});

export function toI18nMessageApiInput(value: I18nMessageFormValues): UpdateI18nMessageRequest {
  return updateI18nMessageRequestSchema.parse({
    messageValue: value.messageValue,
  });
}
