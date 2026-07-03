export type NotificationTemplateVariables = Record<string, unknown>;

export function renderNotificationTemplate(
  template: string,
  variables: NotificationTemplateVariables
): string {
  return template.replace(/\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}|\{\s*([A-Za-z0-9_.-]+)\s*\}/g, (_, doubleKey, singleKey) => {
    const key = String(doubleKey ?? singleKey);
    return stringifyTemplateValue(variables[key]);
  });
}

function stringifyTemplateValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  return JSON.stringify(value);
}
