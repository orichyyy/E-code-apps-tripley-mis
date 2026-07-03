import { create } from "zustand";

export type AuthUser = {
  id: string;
  username: string;
  displayName: string;
  language: "en" | "zh";
  forcePasswordChange: boolean;
};

type AuthState = {
  accessToken: string | null;
  user: AuthUser | null;
  permissionCodes: string[];
  hiddenFields: Record<string, string[]>;
  setAccessToken: (accessToken: string | null) => void;
  signIn: (input: { accessToken: string; user: AuthUser; permissionCodes: string[] }) => void;
  signOut: () => void;
  updateUser: (patch: Partial<AuthUser>) => void;
  setPermissionContext: (input: {
    permissionCodes: string[];
    hiddenFields?: Record<string, string[]>;
  }) => void;
  markPasswordChanged: () => void;
};

const initialAccessToken =
  typeof localStorage === "undefined" ? null : localStorage.getItem("web-admin.access-token");

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: initialAccessToken,
  user: initialAccessToken
    ? {
        id: "1",
        username: "admin",
        displayName: "Super Administrator",
        language: "en",
        forcePasswordChange: false
      }
    : null,
  permissionCodes: initialAccessToken ? ["*"] : [],
  hiddenFields: {},
  setAccessToken: (accessToken) => {
    if (typeof localStorage !== "undefined") {
      if (accessToken) {
        localStorage.setItem("web-admin.access-token", accessToken);
      } else {
        localStorage.removeItem("web-admin.access-token");
      }
    }
    set({ accessToken });
  },
  signIn: ({ accessToken, user, permissionCodes }) => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("web-admin.access-token", accessToken);
    }
    set({ accessToken, user, permissionCodes });
  },
  signOut: () => {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem("web-admin.access-token");
    }
    set({ accessToken: null, user: null, permissionCodes: [], hiddenFields: {} });
  },
  updateUser: (patch) =>
    set((state) => ({
      user: state.user ? { ...state.user, ...patch } : state.user
    })),
  setPermissionContext: ({ permissionCodes, hiddenFields = {} }) =>
    set({ permissionCodes, hiddenFields }),
  markPasswordChanged: () =>
    set((state) => ({
      user: state.user ? { ...state.user, forcePasswordChange: false } : state.user
    }))
}));
