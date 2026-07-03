import type {
  UpdateOwnAvatarRequest,
  UpdateOwnPreferencesRequest,
  UpdateOwnProfileRequest
} from "@web-admin-base/contracts";

import { requestJson, stringField } from "@/lib/api-request";
import type { ThemeColor } from "@/stores/layout.store";

export type UserPreferences = {
  id: string;
  tenantId: string | null;
  userId: string;
  language: "en" | "zh";
  themeMode: "light" | "dark";
  themeColor: ThemeColor;
  pageTabsEnabled: boolean;
  updatedAt: string;
};

export type ProfileUser = {
  id: string;
  username: string;
  displayName: string;
  email: string;
  phone: string;
  avatarFileId: string | null;
  gender: string | null;
  employeeNumber: string | null;
};

export type Profile = {
  user: ProfileUser;
  preferences: UserPreferences;
};

export async function fetchProfile(): Promise<Profile> {
  const envelope = await requestJson<{ data?: unknown }>("/profile");
  return toProfile(envelope.data);
}

export async function updateOwnProfile(input: UpdateOwnProfileRequest) {
  const envelope = await requestJson<{ data?: unknown }>("/profile", {
    method: "PATCH",
    body: JSON.stringify(input)
  });
  return toProfile(envelope.data);
}

export async function updateOwnPreferences(input: UpdateOwnPreferencesRequest) {
  const envelope = await requestJson<{ data?: unknown }>("/profile/preferences", {
    method: "PATCH",
    body: JSON.stringify(input)
  });
  return toUserPreferences(envelope.data);
}

export async function updateOwnAvatar(input: UpdateOwnAvatarRequest) {
  const envelope = await requestJson<{ data?: unknown }>("/profile/avatar", {
    method: "POST",
    body: JSON.stringify(input)
  });
  return toProfile(envelope.data);
}

function toProfile(value: unknown): Profile {
  const record = isRecord(value) ? value : {};
  const user = isRecord(record.user) ? record.user : {};
  return {
    user: {
      id: stringField(user.id, ""),
      username: stringField(user.username, ""),
      displayName: stringField(user.displayName, ""),
      email: stringField(user.email, ""),
      phone: stringField(user.phone, ""),
      avatarFileId: nullableString(user.avatarFileId),
      gender: nullableString(user.gender),
      employeeNumber: nullableString(user.employeeNumber)
    },
    preferences: toUserPreferences(record.preferences)
  };
}

function toUserPreferences(value: unknown): UserPreferences {
  const record = isRecord(value) ? value : {};
  return {
    id: stringField(record.id, ""),
    tenantId: nullableString(record.tenantId),
    userId: stringField(record.userId, ""),
    language: record.language === "zh" ? "zh" : "en",
    themeMode: record.themeMode === "dark" ? "dark" : "light",
    themeColor: toThemeColor(record.themeColor),
    pageTabsEnabled: record.pageTabsEnabled !== false,
    updatedAt: stringField(record.updatedAt, "")
  };
}

function toThemeColor(value: unknown): ThemeColor {
  if (value === "emerald" || value === "violet" || value === "slate") return value;
  return "blue";
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
