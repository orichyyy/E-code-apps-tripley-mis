import { create } from "zustand";

export type SelectableOrganization = {
  id: string;
  name: string;
  code: string;
  status: "enabled" | "disabled";
};

type OrganizationState = {
  currentOrganizationId: string | null;
  organizations: SelectableOrganization[];
  setCurrentOrganizationId: (organizationId: string | null) => void;
  setOrganizations: (organizations: SelectableOrganization[]) => void;
  switchOrganization: (organizationId: string) => void;
  reset: () => void;
};

const currentOrganizationStorageKey = "web-admin.current-organization-id";
const organizationsStorageKey = "web-admin.organizations";

const defaultOrganizations: SelectableOrganization[] = [
  { id: "1", name: "Main Organization", code: "main", status: "enabled" },
  { id: "2", name: "Shared Services", code: "shared", status: "enabled" },
];

const initialOrganizations = readOrganizations();
const initialOrganizationId = readCurrentOrganizationId(initialOrganizations);

export const useOrganizationStore = create<OrganizationState>((set) => ({
  currentOrganizationId: initialOrganizationId,
  organizations: initialOrganizations,
  setCurrentOrganizationId: (currentOrganizationId) => {
    persistCurrentOrganizationId(currentOrganizationId);
    set({ currentOrganizationId });
  },
  setOrganizations: (organizations) => {
    persistOrganizations(organizations);
    set({ organizations });
  },
  switchOrganization: (currentOrganizationId) => {
    persistCurrentOrganizationId(currentOrganizationId);
    set({ currentOrganizationId });
  },
  reset: () => {
    clearPersistedOrganizationContext();
    set({ currentOrganizationId: null, organizations: [] });
  },
}));

function readOrganizations(): SelectableOrganization[] {
  if (typeof localStorage === "undefined") return defaultOrganizations;
  try {
    const value = JSON.parse(localStorage.getItem(organizationsStorageKey) ?? "[]");
    if (!Array.isArray(value)) return defaultOrganizations;
    const organizations = value.filter(isSelectableOrganization);
    return organizations.length > 0 ? organizations : defaultOrganizations;
  } catch {
    return defaultOrganizations;
  }
}

function readCurrentOrganizationId(organizations: SelectableOrganization[]): string | null {
  if (typeof localStorage === "undefined") return organizations[0]?.id ?? null;
  const stored = localStorage.getItem(currentOrganizationStorageKey);
  return organizations.some((organization) => organization.id === stored)
    ? stored
    : (organizations[0]?.id ?? null);
}

function persistCurrentOrganizationId(value: string | null): void {
  if (typeof localStorage === "undefined") return;
  if (value) localStorage.setItem(currentOrganizationStorageKey, value);
  else localStorage.removeItem(currentOrganizationStorageKey);
}

function persistOrganizations(organizations: SelectableOrganization[]): void {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(organizationsStorageKey, JSON.stringify(organizations));
  }
}

function clearPersistedOrganizationContext(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(currentOrganizationStorageKey);
  localStorage.removeItem(organizationsStorageKey);
}

function isSelectableOrganization(value: unknown): value is SelectableOrganization {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<SelectableOrganization>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.code === "string" &&
    (candidate.status === "enabled" || candidate.status === "disabled")
  );
}
