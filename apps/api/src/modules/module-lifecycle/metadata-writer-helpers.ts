export function splitPermissionCode(code: string): { resource: string; action: string } {
  const separator = code.indexOf(":");
  return separator < 0
    ? { resource: code, action: "" }
    : { resource: code.slice(0, separator), action: code.slice(separator + 1) };
}
