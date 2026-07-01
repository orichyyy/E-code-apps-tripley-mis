import { create } from "zustand";

type LayoutState = {
  pageTabsEnabled: boolean;
  darkModeEnabled: boolean;
  setPageTabsEnabled: (enabled: boolean) => void;
  setDarkModeEnabled: (enabled: boolean) => void;
};

export const useLayoutStore = create<LayoutState>((set) => ({
  pageTabsEnabled: true,
  darkModeEnabled: false,
  setPageTabsEnabled: (pageTabsEnabled) => set({ pageTabsEnabled }),
  setDarkModeEnabled: (darkModeEnabled) => set({ darkModeEnabled })
}));
