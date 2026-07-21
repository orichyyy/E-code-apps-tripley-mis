import type {
  BusinessApiModuleRegistration,
  BusinessModuleDefinition,
  ModuleExecutionContext,
} from "@web-admin-base/contracts";

export type BusinessModuleFileReference = {
  fileObjectId: string;
  resourceType: string;
  resourceId: string;
  referenceType: string;
  status: string;
};

export class BusinessModuleFileAccessAuthorizer {
  private readonly definitions = new Map<string, BusinessModuleDefinition>();
  private readonly registrations = new Map<string, BusinessApiModuleRegistration>();

  constructor(
    definitions: readonly BusinessModuleDefinition[],
    registrations: readonly BusinessApiModuleRegistration[],
    private readonly isActive: (moduleCode: string) => boolean | Promise<boolean>,
  ) {
    definitions.forEach((item) => this.definitions.set(item.moduleCode, item));
    registrations.forEach((item) => this.registrations.set(item.moduleCode, item));
  }

  async canView(
    context: ModuleExecutionContext,
    fileId: string,
    references: BusinessModuleFileReference[],
  ): Promise<boolean> {
    for (const reference of references) {
      if (reference.status !== "active" || reference.fileObjectId !== fileId) continue;
      const moduleCode = moduleCodeFromResource(reference.resourceType);
      if (!moduleCode || !(await this.isActive(moduleCode))) continue;
      const definition = this.definitions.get(moduleCode);
      const registration = this.registrations.get(moduleCode);
      const attachment = definition?.contributions.fileAttachments.find(
        (item) =>
          item.attachmentCode === reference.referenceType &&
          item.resourceType === reference.resourceType,
      );
      const authorizer = registration?.fileAttachmentAuthorizers[reference.referenceType];
      if (
        attachment &&
        authorizer &&
        (await authorizer.canView({
          context: { ...context, moduleCode },
          resourceId: reference.resourceId,
          fileId,
        }))
      ) {
        return true;
      }
    }
    return false;
  }
}

function moduleCodeFromResource(resourceType: string): string | null {
  const separator = resourceType.indexOf(".");
  return separator > 0 ? resourceType.slice(0, separator) : null;
}
