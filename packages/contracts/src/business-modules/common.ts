import { z } from "zod";

export const moduleCodeSchema = z
  .string()
  .regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/, "Expected a lower kebab-case Module Code.");

export const namespacedCodeSchema = z.string().min(3);

export const localizedMessageSchema = z
  .object({
    key: z.string().min(1),
    defaultMessage: z.string().min(1),
  })
  .strict();

export const localeSchema = z.string().min(2).refine(isCanonicalLocale, {
  message: "Expected a canonical BCP 47 language tag.",
});

export const apiMethodSchema = z.enum(["GET", "POST", "PATCH", "PUT", "DELETE"]);
export const apiLogLevelSchema = z.enum(["none", "basic", "request", "request_response"]);

export type LocalizedMessage = z.infer<typeof localizedMessageSchema>;

function isCanonicalLocale(locale: string): boolean {
  try {
    return Intl.getCanonicalLocales(locale)[0] === locale;
  } catch {
    return false;
  }
}
