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
};

const defaultOrganizations: SelectableOrganization[] = [
  { id: "1", name: "Main Organization", code: "main", status: "enabled" },
  { id: "2", name: "Shared Services", code: "shared", status: "enabled" }
];

export const useOrganizationStore = create<OrganizationState>((set) => ({
  currentOrganizationId: "1",
  organizations: defaultOrganizations,
  setCurrentOrganizationId: (currentOrganizationId) => set({ currentOrganizationId }),
  setOrganizations: (organizations) => set({ organizations }),
  switchOrganization: (currentOrganizationId) => set({ currentOrganizationId })
}));
