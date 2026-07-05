import { create } from "zustand";

export type ThemeColor = "blue" | "emerald" | "violet" | "slate";

type LayoutState = {
  pageTabsEnabled: boolean;
  darkModeEnabled: boolean;
  fullscreenEnabled: boolean;
  themeColor: ThemeColor;
  openTabs: string[];
  language: "en" | "zh";
  setPageTabsEnabled: (enabled: boolean) => void;
  setDarkModeEnabled: (enabled: boolean) => void;
  setFullscreenEnabled: (enabled: boolean) => void;
  setThemeColor: (themeColor: ThemeColor) => void;
  addTab: (path: string) => void;
  closeTab: (path: string) => void;
  setLanguage: (language: "en" | "zh") => void;
};

export const useLayoutStore = create<LayoutState>((set) => ({
  pageTabsEnabled: true,
  darkModeEnabled: false,
  fullscreenEnabled: false,
  themeColor: "blue",
  openTabs: ["/"],
  language: "en",
  setPageTabsEnabled: (pageTabsEnabled) => set({ pageTabsEnabled }),
  setDarkModeEnabled: (darkModeEnabled) => set({ darkModeEnabled }),
  setFullscreenEnabled: (fullscreenEnabled) => set({ fullscreenEnabled }),
  setThemeColor: (themeColor) => set({ themeColor }),
  addTab: (path) =>
    set((state) => ({
      openTabs: state.openTabs.includes(path) ? state.openTabs : [...state.openTabs, path],
    })),
  closeTab: (path) =>
    set((state) => ({
      openTabs: state.openTabs.filter((tab) => tab !== path),
    })),
  setLanguage: (language) => set({ language }),
}));
