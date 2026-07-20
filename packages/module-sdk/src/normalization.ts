import type {
  BusinessModuleContributions,
  BusinessModuleDefinition,
} from "@web-admin-base/contracts";

type ContributionName = keyof BusinessModuleContributions;

const identityByContribution: Record<ContributionName, (value: never) => string> = {
  permissions: (value: { code: string }) => value.code,
  apis: (value: { code: string }) => value.code,
  routes: (value: { routeCode: string }) => value.routeCode,
  menus: (value: { code: string }) => value.code,
  dataResources: (value: { resourceType: string }) => value.resourceType,
  fields: (value: { resourceType: string; field: string }) =>
    `${value.resourceType}:${value.field}`,
  operationEvents: (value: { code: string }) => value.code,
  importExportResources: (value: { resourceType: string }) => value.resourceType,
  fileAttachments: (value: { attachmentCode: string }) => value.attachmentCode,
  domainEvents: (value: { eventType: string }) => value.eventType,
  notificationEvents: (value: { eventType: string }) => value.eventType,
  i18nMessages: (value: { key: string }) => value.key,
  dictionaryDependencies: (value: { code: string }) => value.code,
  scheduledJobs: (value: { jobType: string }) => value.jobType,
  errors: (value: { code: string }) => value.code,
};

function sortCollection<T>(values: T[], identity: (value: T) => string): T[] {
  return [...values].sort((left, right) => identity(left).localeCompare(identity(right)));
}

export function normalizeContributionOrder(
  definition: BusinessModuleDefinition,
): BusinessModuleDefinition {
  const contributions = Object.fromEntries(
    Object.entries(definition.contributions).map(([name, values]) => {
      const contributionName = name as ContributionName;
      const identity = identityByContribution[contributionName] as (value: unknown) => string;
      return [contributionName, sortCollection(values, identity)];
    }),
  ) as BusinessModuleContributions;

  return { ...definition, contributions };
}
