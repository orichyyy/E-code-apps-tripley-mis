import type { BusinessModuleDefinition, LocalizedMessage } from "@web-admin-base/contracts";

export type ModuleLocalizedMessage = {
  key: string;
  language: string;
  defaultMessage: string;
};

export function collectModuleLocalizedMessages(
  definition: BusinessModuleDefinition,
): ModuleLocalizedMessage[] {
  const messages = new Map<string, ModuleLocalizedMessage>();
  const add = (message: LocalizedMessage, language = definition.defaultLocale) => {
    messages.set(`${message.key}\0${language}`, {
      key: message.key,
      language,
      defaultMessage: message.defaultMessage,
    });
  };

  add(definition.title);
  if (definition.description) add(definition.description);
  definition.contributions.permissions.forEach((entry) => add(entry.description));
  definition.contributions.apis.forEach((entry) => add(entry.description));
  definition.contributions.routes.forEach((entry) => add(entry.title));
  definition.contributions.menus.forEach((entry) => add(entry.title));
  definition.contributions.dataResources.forEach((entry) => {
    add(entry.title);
    entry.fields.forEach((field) => add(field.title));
  });
  definition.contributions.fields.forEach((entry) => add(entry.title));
  definition.contributions.operationEvents.forEach((entry) => add(entry.title));
  definition.contributions.importExportResources.forEach((entry) => {
    add(entry.title);
    entry.columns.forEach((column) => add(column.title));
  });
  definition.contributions.fileAttachments.forEach((entry) => add(entry.title));
  definition.contributions.domainEvents.forEach((entry) => add(entry.title));
  definition.contributions.notificationEvents.forEach((entry) => add(entry.title));
  definition.contributions.scheduledJobs.forEach((entry) => add(entry.title));
  definition.contributions.errors.forEach((entry) => add(entry.message));

  for (const entry of definition.contributions.i18nMessages) {
    add({ key: entry.key, defaultMessage: entry.defaultMessage });
    for (const [language, defaultMessage] of Object.entries(entry.translations)) {
      add({ key: entry.key, defaultMessage }, language);
    }
  }

  return [...messages.values()].sort(
    (left, right) =>
      left.key.localeCompare(right.key) || left.language.localeCompare(right.language),
  );
}
