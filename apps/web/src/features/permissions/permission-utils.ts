export function hasPermission(permissionCodes: string[], requiredPermission?: string) {
  return !requiredPermission || permissionCodes.includes("*") || permissionCodes.includes(requiredPermission);
}

export function isFieldHidden(hiddenFields: Record<string, string[]>, routeCode: string, field: string) {
  return hiddenFields[routeCode]?.includes(field) ?? false;
}
