import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  updateOwnPreferencesRequestSchema,
  type UpdateOwnPreferencesRequest,
} from "@web-admin-base/contracts";
import { AlertCircle, Loader2, Save } from "lucide-react";
import { useCallback, useEffect, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  fetchProfile,
  updateOwnPreferences,
  type UserPreferences,
} from "@/features/account/profile-api";
import { translate } from "@/i18n/messages";
import { useAuthStore } from "@/stores/auth.store";
import { useLayoutStore, type ThemeColor } from "@/stores/layout.store";

type SettingsFormValues = {
  language: "en" | "zh";
  themeMode: "light" | "dark";
  themeColor: ThemeColor;
  pageTabsEnabled: boolean;
};

export function PersonalSettingsPage() {
  const language = useLayoutStore((state) => state.language);
  const applyPreferences = usePreferenceApplier();
  const updateUser = useAuthStore((state) => state.updateUser);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["profile"],
    queryFn: fetchProfile,
  });
  const mutation = useMutation({
    mutationFn: updateOwnPreferences,
    onSuccess: async (preferences) => {
      applyPreferences(preferences);
      updateUser({ language: preferences.language });
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });

  useEffect(() => {
    if (query.data?.preferences) applyPreferences(query.data.preferences);
  }, [applyPreferences, query.data?.preferences]);

  if (query.isLoading) {
    return (
      <SettingsState icon={<Loader2 className="size-5 animate-spin" />} title="Loading settings" />
    );
  }

  if (query.isError || !query.data) {
    return (
      <SettingsState
        icon={<AlertCircle className="size-5 text-destructive" />}
        title="Settings could not be loaded"
      />
    );
  }

  return (
    <SettingsForm
      busy={mutation.isPending}
      key={query.data.preferences.updatedAt}
      language={language}
      onSubmit={(input) => mutation.mutate(updateOwnPreferencesRequestSchema.parse(input))}
      preferences={query.data.preferences}
    />
  );
}

function SettingsForm({
  busy,
  language,
  onSubmit,
  preferences,
}: {
  busy: boolean;
  language: "en" | "zh";
  onSubmit: (input: UpdateOwnPreferencesRequest) => void;
  preferences: UserPreferences;
}) {
  const colors: ThemeColor[] = ["blue", "emerald", "violet", "slate"];
  const form = useForm({
    defaultValues: toSettingsFormValues(preferences),
    onSubmit: ({ value }) => onSubmit(value),
  });

  return (
    <section className="max-w-3xl rounded-lg border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">
            {translate(language, "routes.account.settings")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Persist layout preferences for this account.
          </p>
        </div>
        <Button disabled={busy} form="personal-settings-form" size="sm" type="submit">
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="size-4" aria-hidden="true" />
          )}
          Save
        </Button>
      </div>
      <form
        className="mt-5 grid gap-5"
        id="personal-settings-form"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.Field
          name="pageTabsEnabled"
          children={(field) => (
            <label className="flex items-center justify-between gap-6 text-sm">
              <span>
                <span className="font-medium">{translate(language, "layout.tabs")}</span>
                <span className="mt-1 block text-muted-foreground">
                  Enable persistent page tabs.
                </span>
              </span>
              <input
                checked={field.state.value}
                className="size-5"
                onChange={(event) => field.handleChange(event.target.checked)}
                type="checkbox"
              />
            </label>
          )}
        />
        <form.Field
          name="themeMode"
          children={(field) => (
            <label className="flex items-center justify-between gap-6 text-sm">
              <span>
                <span className="font-medium">Dark mode</span>
                <span className="mt-1 block text-muted-foreground">Use the dark admin theme.</span>
              </span>
              <input
                checked={field.state.value === "dark"}
                className="size-5"
                onChange={(event) => field.handleChange(event.target.checked ? "dark" : "light")}
                type="checkbox"
              />
            </label>
          )}
        />
        <form.Field
          name="language"
          children={(field) => (
            <label className="grid gap-2 text-sm font-medium">
              Language
              <select
                className="h-10 rounded-md border bg-background px-3"
                onChange={(event) => field.handleChange(event.target.value as "en" | "zh")}
                value={field.state.value}
              >
                <option value="en">English</option>
                <option value="zh">中文</option>
              </select>
            </label>
          )}
        />
        <form.Field
          name="themeColor"
          children={(field) => (
            <div>
              <div className="mb-2 text-sm font-medium">Theme color</div>
              <div className="flex flex-wrap gap-2">
                {colors.map((color) => (
                  <Button
                    aria-pressed={field.state.value === color}
                    key={color}
                    onClick={() => field.handleChange(color)}
                    size="sm"
                    type="button"
                    variant={field.state.value === color ? "default" : "outline"}
                  >
                    {color}
                  </Button>
                ))}
              </div>
            </div>
          )}
        />
      </form>
    </section>
  );
}

function SettingsState({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <section className="max-w-3xl rounded-lg border bg-card p-8 text-center shadow-sm">
      <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted">
        {icon}
      </div>
      <h2 className="mt-3 text-base font-semibold">{title}</h2>
    </section>
  );
}

function usePreferenceApplier() {
  const setLanguage = useLayoutStore((state) => state.setLanguage);
  const setPageTabsEnabled = useLayoutStore((state) => state.setPageTabsEnabled);
  const setDarkModeEnabled = useLayoutStore((state) => state.setDarkModeEnabled);
  const setThemeColor = useLayoutStore((state) => state.setThemeColor);

  return useCallback(
    (preferences: UserPreferences) => {
      setLanguage(preferences.language);
      setPageTabsEnabled(preferences.pageTabsEnabled);
      setDarkModeEnabled(preferences.themeMode === "dark");
      setThemeColor(preferences.themeColor);
    },
    [setDarkModeEnabled, setLanguage, setPageTabsEnabled, setThemeColor],
  );
}

function toSettingsFormValues(preferences: UserPreferences): SettingsFormValues {
  return {
    language: preferences.language,
    themeMode: preferences.themeMode,
    themeColor: preferences.themeColor,
    pageTabsEnabled: preferences.pageTabsEnabled,
  };
}
