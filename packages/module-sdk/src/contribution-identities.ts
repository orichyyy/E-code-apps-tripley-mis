import type { BusinessModuleDefinition } from "@web-admin-base/contracts";

import type { ContributionIdentity } from "./conformance-diagnostics";

export function definitionIdentities(definition: BusinessModuleDefinition): ContributionIdentity[] {
  const contributions = definition.contributions;
  return [
    ...contributions.permissions.map(({ code }) => ({ kind: "permission", identifier: code })),
    ...contributions.apis.map(({ code }) => ({ kind: "api", identifier: code })),
    ...contributions.routes.map(({ routeCode }) => ({ kind: "route", identifier: routeCode })),
    ...contributions.menus.map(({ code }) => ({ kind: "menu", identifier: code })),
    ...contributions.dataResources.map(({ resourceType }) => ({
      kind: "dataResource",
      identifier: resourceType,
    })),
    ...contributions.fields.map(({ resourceType, field }) => ({
      kind: "field",
      identifier: `${resourceType}:${field}`,
    })),
    ...contributions.operationEvents.map(({ code }) => ({
      kind: "operationEvent",
      identifier: code,
    })),
    ...contributions.importExportResources.map(({ resourceType }) => ({
      kind: "importExportResource",
      identifier: resourceType,
    })),
    ...contributions.fileAttachments.map(({ attachmentCode }) => ({
      kind: "fileAttachment",
      identifier: attachmentCode,
    })),
    ...contributions.domainEvents.map(({ eventType }) => ({
      kind: "domainEvent",
      identifier: eventType,
    })),
    ...contributions.notificationEvents.map(({ eventType }) => ({
      kind: "notificationEvent",
      identifier: eventType,
    })),
    ...contributions.i18nMessages.map(({ key }) => ({ kind: "i18nMessage", identifier: key })),
    ...contributions.scheduledJobs.map(({ jobType }) => ({
      kind: "scheduledJob",
      identifier: jobType,
    })),
    ...contributions.errors.map(({ code }) => ({ kind: "error", identifier: code })),
  ];
}

export function localizedDescriptors(definition: BusinessModuleDefinition): Array<{ key: string }> {
  const contributions = definition.contributions;
  return [
    definition.title,
    ...(definition.description ? [definition.description] : []),
    ...contributions.permissions.map(({ description }) => description),
    ...contributions.apis.map(({ description }) => description),
    ...contributions.routes.map(({ title }) => title),
    ...contributions.menus.map(({ title }) => title),
    ...contributions.dataResources.flatMap(({ title, fields }) => [
      title,
      ...fields.map((field) => field.title),
    ]),
    ...contributions.fields.map(({ title }) => title),
    ...contributions.operationEvents.map(({ title }) => title),
    ...contributions.importExportResources.flatMap(({ title, columns }) => [
      title,
      ...columns.map((column) => column.title),
    ]),
    ...contributions.fileAttachments.map(({ title }) => title),
    ...contributions.domainEvents.map(({ title }) => title),
    ...contributions.notificationEvents.map(({ title }) => title),
    ...contributions.scheduledJobs.map(({ title }) => title),
    ...contributions.errors.map(({ message }) => message),
  ];
}
