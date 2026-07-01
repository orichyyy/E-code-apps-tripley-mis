export const i18nNamespaces = ["common", "errors", "routes"] as const;

export type I18nNamespace = (typeof i18nNamespaces)[number];
