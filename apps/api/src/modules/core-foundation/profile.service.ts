import type {
  UpdateOwnAvatarRequest,
  UpdateOwnPreferencesRequest,
  UpdateOwnProfileRequest,
  UpdateUserRequest,
} from "@web-admin-base/contracts";

import { nowUtc, toUtcIso } from "../../core/time/utc";
import type { AuthService } from "./auth.service";
import type { PublicProfile, UserPreferenceRecord } from "./domain";
import type { BackendCoreContext } from "./service-context";
import { requireUser } from "./store-guards";
import { toPublicUser } from "./serializers";
import { UserService } from "./user.service";

type AuthContext = NonNullable<ReturnType<AuthService["findAuthContext"]>>;

export class ProfileService {
  constructor(
    private readonly context: BackendCoreContext,
    private readonly users: UserService,
  ) {}

  getProfile(authContext: AuthContext): PublicProfile {
    const user = requireUser(this.context.store, authContext.userId);
    return {
      user: toPublicUser(user),
      preferences: this.getOrCreatePreferences(user.id),
    };
  }

  getPreferences(userId: string): UserPreferenceRecord {
    requireUser(this.context.store, userId);
    return this.getOrCreatePreferences(userId);
  }

  updateProfile(authContext: AuthContext, input: UpdateOwnProfileRequest): PublicProfile {
    const profileInput: UpdateUserRequest = {
      displayName: input.displayName,
      email: input.email,
      phone: input.phone,
      avatarFileId: input.avatarFileId,
      gender: input.gender,
      employeeNumber: input.employeeNumber,
    };
    const user = this.users.update(authContext.userId, profileInput, authContext.userId);
    return {
      user,
      preferences: this.getOrCreatePreferences(authContext.userId),
    };
  }

  updatePreferences(
    authContext: AuthContext,
    input: UpdateOwnPreferencesRequest,
  ): UserPreferenceRecord {
    const preferences = this.getOrCreatePreferences(authContext.userId);
    if (input.language !== undefined) preferences.language = input.language;
    if (input.themeMode !== undefined) preferences.themeMode = input.themeMode;
    if (input.themeColor !== undefined) preferences.themeColor = input.themeColor;
    if (input.pageTabsEnabled !== undefined) preferences.pageTabsEnabled = input.pageTabsEnabled;
    preferences.updatedAt = toUtcIso(nowUtc());
    return preferences;
  }

  updateAvatar(authContext: AuthContext, input: UpdateOwnAvatarRequest): PublicProfile {
    return this.updateProfile(authContext, { avatarFileId: input.avatarFileId });
  }

  private getOrCreatePreferences(userId: string): UserPreferenceRecord {
    const existing = [...this.context.store.userPreferences.values()].find(
      (preference) => preference.userId === userId,
    );
    if (existing) return existing;

    const user = requireUser(this.context.store, userId);
    const preferences: UserPreferenceRecord = {
      id: this.context.store.nextId("userPreference"),
      tenantId: user.tenantId,
      userId,
      language: "en",
      themeMode: "light",
      themeColor: "blue",
      pageTabsEnabled: true,
      updatedAt: toUtcIso(nowUtc()),
    };
    this.context.store.userPreferences.set(preferences.id, preferences);
    return preferences;
  }
}
