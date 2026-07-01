import { create } from "zustand";

type OrganizationState = {
  currentOrganizationId: string | null;
  setCurrentOrganizationId: (organizationId: string | null) => void;
};

export const useOrganizationStore = create<OrganizationState>((set) => ({
  currentOrganizationId: null,
  setCurrentOrganizationId: (currentOrganizationId) => set({ currentOrganizationId })
}));
