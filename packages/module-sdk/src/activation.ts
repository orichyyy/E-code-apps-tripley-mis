export function selectActiveModuleRegistrations<T extends { moduleCode: string }>(
  registrations: readonly T[],
  activeModuleCodes: ReadonlySet<string>,
): T[] {
  return registrations.filter((registration) => activeModuleCodes.has(registration.moduleCode));
}
