import {
  createAnnouncementRequestSchema,
  updateAnnouncementRequestSchema,
  type CreateAnnouncementRequest,
  type UpdateAnnouncementRequest
} from "@web-admin-base/contracts";
import { z } from "zod";

export type AnnouncementFormMode = "create" | "edit";

export type AnnouncementFormValues = {
  title: string;
  content: string;
  scopeType: "system" | "organization";
};

export const announcementFormSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  scopeType: z.enum(["system", "organization"])
});

export const defaultAnnouncementFormValues: AnnouncementFormValues = {
  title: "",
  content: "",
  scopeType: "system"
};

export function toAnnouncementApiInput(
  value: AnnouncementFormValues,
  mode: AnnouncementFormMode
): CreateAnnouncementRequest | UpdateAnnouncementRequest {
  const input = {
    title: value.title.trim(),
    content: value.content.trim(),
    scopeType: value.scopeType
  };

  return mode === "create"
    ? createAnnouncementRequestSchema.parse(input)
    : updateAnnouncementRequestSchema.parse(input);
}
