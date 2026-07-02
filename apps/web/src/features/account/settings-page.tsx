import { Button } from "@/components/ui/button";
import { translate } from "@/i18n/messages";
import { useLayoutStore, type ThemeColor } from "@/stores/layout.store";

export function PersonalSettingsPage() {
  const language = useLayoutStore((state) => state.language);
  const pageTabsEnabled = useLayoutStore((state) => state.pageTabsEnabled);
  const darkModeEnabled = useLayoutStore((state) => state.darkModeEnabled);
  const themeColor = useLayoutStore((state) => state.themeColor);
  const setLanguage = useLayoutStore((state) => state.setLanguage);
  const setPageTabsEnabled = useLayoutStore((state) => state.setPageTabsEnabled);
  const setDarkModeEnabled = useLayoutStore((state) => state.setDarkModeEnabled);
  const setThemeColor = useLayoutStore((state) => state.setThemeColor);
  const colors: ThemeColor[] = ["blue", "emerald", "violet", "slate"];

  return (
    <section className="max-w-3xl rounded-lg border bg-card p-5 shadow-sm">
      <h2 className="text-base font-semibold">{translate(language, "routes.account.settings")}</h2>
      <div className="mt-5 grid gap-5">
        <label className="flex items-center justify-between gap-6 text-sm">
          <span>
            <span className="font-medium">{translate(language, "layout.tabs")}</span>
            <span className="mt-1 block text-muted-foreground">Enable persistent page tabs.</span>
          </span>
          <input
            checked={pageTabsEnabled}
            className="size-5"
            onChange={(event) => setPageTabsEnabled(event.target.checked)}
            type="checkbox"
          />
        </label>
        <label className="flex items-center justify-between gap-6 text-sm">
          <span>
            <span className="font-medium">Dark mode</span>
            <span className="mt-1 block text-muted-foreground">Use the dark admin theme.</span>
          </span>
          <input
            checked={darkModeEnabled}
            className="size-5"
            onChange={(event) => setDarkModeEnabled(event.target.checked)}
            type="checkbox"
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Language
          <select
            className="h-10 rounded-md border bg-background px-3"
            onChange={(event) => setLanguage(event.target.value as "en" | "zh")}
            value={language}
          >
            <option value="en">English</option>
            <option value="zh">中文</option>
          </select>
        </label>
        <div>
          <div className="mb-2 text-sm font-medium">Theme color</div>
          <div className="flex gap-2">
            {colors.map((color) => (
              <Button
                aria-pressed={themeColor === color}
                key={color}
                onClick={() => setThemeColor(color)}
                size="sm"
                variant={themeColor === color ? "default" : "outline"}
              >
                {color}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
