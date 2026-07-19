import {
  createAnnouncementRequestSchema,
  updateAnnouncementRequestSchema,
  type CreateAnnouncementRequest,
  type UpdateAnnouncementRequest,
} from "@web-admin-base/contracts";
import { z } from "zod";

export type AnnouncementFormMode = "create" | "edit";

export type AnnouncementFormValues = {
  title: string;
  content: string;
  scopeType: "system" | "organization";
  targetOrganizationIds: string[];
  expiresAt: string;
};

export const announcementFormSchema = z
  .object({
    title: z.string().min(1),
    content: z.string().min(1),
    scopeType: z.enum(["system", "organization"]),
    targetOrganizationIds: z.array(z.string()),
    expiresAt: z.string(),
  })
  .superRefine((value, context) => {
    if (value.scopeType === "organization" && value.targetOrganizationIds.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetOrganizationIds"],
        message: "Select at least one organization.",
      });
    }
  });

export const defaultAnnouncementFormValues: AnnouncementFormValues = {
  title: "",
  content: "",
  scopeType: "system",
  targetOrganizationIds: [],
  expiresAt: "",
};

export function toAnnouncementApiInput(
  value: AnnouncementFormValues,
  mode: AnnouncementFormMode,
): CreateAnnouncementRequest | UpdateAnnouncementRequest {
  const input = {
    title: value.title.trim(),
    content: value.content.trim(),
    scopeType: value.scopeType,
    targetOrganizationIds: value.scopeType === "organization" ? value.targetOrganizationIds : [],
    expiresAt: value.expiresAt ? new Date(value.expiresAt).toISOString() : null,
  };

  return mode === "create"
    ? createAnnouncementRequestSchema.parse(input)
    : updateAnnouncementRequestSchema.parse(input);
}

export function toLocalDateTime(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
