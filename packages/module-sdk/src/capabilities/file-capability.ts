import type {
  BusinessApiModuleRegistration,
  BusinessModuleDefinition,
  ModuleExecutionContext,
} from "@web-admin-base/contracts";

import { capabilityDenied } from "./errors";
import type { ModuleCapabilityBindings } from "./types";

export function createFileCapability(input: {
  definition: BusinessModuleDefinition;
  registration: BusinessApiModuleRegistration;
  context: ModuleExecutionContext;
  binding: ModuleCapabilityBindings["files"];
}) {
  const requireAttachment = (attachmentCode: string) =>
    input.definition.contributions.fileAttachments.find(
      (item) => item.attachmentCode === attachmentCode,
    ) ?? capabilityDenied(`Attachment ${attachmentCode} is not declared.`);

  const authorize = async (
    action: "canView" | "canAttach" | "canDetach",
    attachmentCode: string,
    resourceId: string,
    fileId: string,
  ) => {
    const handler = input.registration.fileAttachmentAuthorizers[attachmentCode];
    if (!handler || !(await handler[action]({ context: input.context, resourceId, fileId }))) {
      capabilityDenied(`${action} was denied for ${attachmentCode}.`);
    }
    return requireAttachment(attachmentCode);
  };

  return {
    async authorizeView(attachmentCode: string, resourceId: string, fileId: string) {
      await authorize("canView", attachmentCode, resourceId, fileId);
    },
    async attach(attachmentCode: string, resourceId: string, fileId: string) {
      const attachment = await authorize("canAttach", attachmentCode, resourceId, fileId);
      const file = await input.binding.get(fileId);
      if (!file || file.status !== "active") capabilityDenied("Managed File is not active.");
      if (
        file.sizeBytes > attachment.maxSizeBytes ||
        !attachment.allowedExtensions.includes(file.extension)
      ) {
        capabilityDenied("Managed File violates the attachment declaration.");
      }
      return input.binding.attach({
        context: input.context,
        fileId,
        resourceId,
        resourceType: attachment.resourceType,
        attachmentCode,
        cardinality: attachment.cardinality,
      });
    },
    async detach(attachmentCode: string, resourceId: string, fileId: string) {
      const attachment = await authorize("canDetach", attachmentCode, resourceId, fileId);
      return input.binding.detach({
        context: input.context,
        fileId,
        resourceId,
        resourceType: attachment.resourceType,
        attachmentCode,
      });
    },
  };
}
