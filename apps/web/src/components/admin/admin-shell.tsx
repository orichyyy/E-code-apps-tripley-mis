import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  BookOpen,
  ChevronDown,
  ChevronRight,
  BriefcaseBusiness,
  ChevronsLeftRight,
  CircleUserRound,
  Database,
  FileClock,
  KeyRound,
  LogOut,
  Maximize2,
  Menu,
  Moon,
  Settings,
  Sun,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { translate } from "@/i18n/messages";
import { adminRouteMetadata, type AdminRouteGroup } from "@/route-metadata";
import { hasPermission } from "@/features/permissions/permission-utils";
import { useAuthStore } from "@/stores/auth.store";
import { useLayoutStore } from "@/stores/layout.store";
import { useOrganizationStore } from "@/stores/organization.store";

const groupLabels: Record<AdminRouteGroup, string> = {
  system: "nav.system",
  notifications: "nav.notifications",
  operations: "nav.operations",
  logs: "nav.logs",
  account: "nav.account",
};

const groupIcons = {
  system: Settings,
  notifications: Bell,
  operations: BriefcaseBusiness,
  logs: FileClock,
  account: CircleUserRound,
} satisfies Record<AdminRouteGroup, typeof Settings>;

const sidebarGroupOrder: AdminRouteGroup[] = [
  "system",
  "notifications",
  "operations",
  "logs",
  "account",
];

const sidebarStorageKey = "web-admin-base.sidebar.expandedGroups";

function readStoredExpandedGroups(): AdminRouteGroup[] {
  if (typeof window === "undefined") return [];

  try {
    const rawValue = window.localStorage.getItem(sidebarStorageKey);
    if (!rawValue) return [];
    const parsedValue = JSON.parse(rawValue);
    if (!Array.isArray(parsedValue)) return [];
    return parsedValue.filter(isAdminRouteGroup);
  } catch {
    return [];
  }
}

function persistExpandedGroups(groups: AdminRouteGroup[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(sidebarStorageKey, JSON.stringify(groups));
}

function isAdminRouteGroup(value: unknown): value is AdminRouteGroup {
  return typeof value === "string" && sidebarGroupOrder.includes(value as AdminRouteGroup);
}

export function AdminShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const language = useLayoutStore((state) => state.language);
  const pageTabsEnabled = useLayoutStore((state) => state.pageTabsEnabled);
  const darkModeEnabled = useLayoutStore((state) => state.darkModeEnabled);
  const fullscreenEnabled = useLayoutStore((state) => state.fullscreenEnabled);
  const openTabs = useLayoutStore((state) => state.openTabs);
  const addTab = useLayoutStore((state) => state.addTab);
  const closeTab = useLayoutStore((state) => state.closeTab);
  const setDarkModeEnabled = useLayoutStore((state) => state.setDarkModeEnabled);
  const setFullscreenEnabled = useLayoutStore((state) => state.setFullscreenEnabled);
  const signOut = useAuthStore((state) => state.signOut);
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const organizations = useOrganizationStore((state) => state.organizations);
  const currentOrganizationId = useOrganizationStore((state) => state.currentOrganizationId);
  const switchOrganization = useOrganizationStore((state) => state.switchOrganization);
  const currentRoute = adminRouteMetadata.find((route) => route.path === location.pathname);
  const activeGroup = currentRoute?.group ?? "system";
  const [storedExpandedGroups, setStoredExpandedGroups] = useState<AdminRouteGroup[]>(() =>
    readStoredExpandedGroups(),
  );

  useEffect(() => {
    addTab(location.pathname);
  }, [addTab, location.pathname]);

  useEffect(() => {
    setStoredExpandedGroups((groups) =>
      groups.includes(activeGroup) ? groups : [...groups, activeGroup],
    );
  }, [activeGroup]);

  useEffect(() => {
    persistExpandedGroups(storedExpandedGroups);
  }, [storedExpandedGroups]);

  const visibleRoutes = adminRouteMetadata.filter(
    (route) => route.menuVisible && hasPermission(permissionCodes, route.requiredPermission),
  );
  const groupedRoutes = visibleRoutes.reduce<
    Partial<Record<AdminRouteGroup, typeof visibleRoutes>>
  >((groups, route) => {
    const group = route.group ?? "system";
    groups[group] = [...(groups[group] ?? []), route];
    return groups;
  }, {});
  const orderedGroups = useMemo(
    () => sidebarGroupOrder.filter((group) => (groupedRoutes[group]?.length ?? 0) > 0),
    [groupedRoutes],
  );
  const expandedGroups = useMemo(() => {
    const groups = new Set(storedExpandedGroups);
    groups.add(activeGroup);
    return groups;
  }, [activeGroup, storedExpandedGroups]);

  function toggleGroup(group: AdminRouteGroup): void {
    setStoredExpandedGroups((groups) => {
      if (group === activeGroup) {
        return groups.includes(group) ? groups : [...groups, group];
      }
      return groups.includes(group)
        ? groups.filter((expandedGroup) => expandedGroup !== group)
        : [...groups, group];
    });
  }

  return (
    <main className="flex min-h-dvh bg-muted/35 text-foreground">
      {!fullscreenEnabled ? (
        <aside className="flex w-72 shrink-0 flex-col border-r bg-background">
          <div className="flex h-16 items-center gap-3 border-b px-5">
            <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Database className="size-5" aria-hidden="true" />
            </div>
            <div>
              <div className="text-sm font-semibold">{translate(language, "app.name")}</div>
              <div className="text-xs text-muted-foreground">Base system</div>
            </div>
          </div>
          <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4" aria-label="Primary">
            {orderedGroups.map((group) => {
              const routes = groupedRoutes[group] ?? [];
              const Icon = groupIcons[group] ?? Menu;
              const isExpanded = expandedGroups.has(group);
              const groupId = `sidebar-group-${group}`;
              const groupLabel = translate(language, groupLabels[group]);
              return (
                <section className="mb-5" key={group}>
                  <button
                    aria-controls={groupId}
                    aria-expanded={isExpanded}
                    className="mb-2 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    onClick={() => toggleGroup(group)}
                    type="button"
                  >
                    <Icon className="size-4" aria-hidden="true" />
                    <span className="flex-1 text-left">{groupLabel}</span>
                    {isExpanded ? (
                      <ChevronDown className="size-4" aria-hidden="true" />
                    ) : (
                      <ChevronRight className="size-4" aria-hidden="true" />
                    )}
                  </button>
                  {isExpanded ? (
                    <div className="flex flex-col gap-1" id={groupId}>
                      {routes
                        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                        .map((route) => (
                          <Link
                            activeOptions={{ exact: true }}
                            className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground [&.active]:bg-primary [&.active]:text-primary-foreground"
                            key={route.routeCode}
                            to={route.path}
                          >
                            {translate(language, route.titleI18nKey)}
                          </Link>
                        ))}
                    </div>
                  ) : null}
                </section>
              );
            })}
          </nav>
        </aside>
      ) : null}
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b bg-background px-5">
          <div className="min-w-0">
            <nav
              className="text-xs text-muted-foreground"
              aria-label={translate(language, "layout.breadcrumb")}
            >
              {translate(language, "app.name")} /{" "}
              {currentRoute ? translate(language, currentRoute.titleI18nKey) : ""}
            </nav>
            <h1 className="truncate text-lg font-semibold">
              {currentRoute
                ? translate(language, currentRoute.titleI18nKey)
                : translate(language, "routes.dashboard")}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="organization-selector">
              {translate(language, "layout.currentOrganization")}
            </label>
            <select
              className="h-9 rounded-md border bg-background px-3 text-sm"
              id="organization-selector"
              value={currentOrganizationId ?? ""}
              onChange={(event) => switchOrganization(event.target.value)}
            >
              {organizations
                .filter((organization) => organization.status === "enabled")
                .map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
            </select>
            <Button
              aria-label={darkModeEnabled ? "Use light mode" : "Use dark mode"}
              onClick={() => setDarkModeEnabled(!darkModeEnabled)}
              size="icon"
              variant="outline"
            >
              {darkModeEnabled ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
            <Button
              aria-label={translate(language, "actions.fullscreen")}
              onClick={() => setFullscreenEnabled(!fullscreenEnabled)}
              size="icon"
              variant="outline"
            >
              <Maximize2 className="size-4" />
            </Button>
            <Button
              onClick={() => {
                signOut();
                void navigate({ to: "/login" });
              }}
              variant="outline"
            >
              <LogOut className="size-4" aria-hidden="true" />
              {translate(language, "actions.logout")}
            </Button>
          </div>
        </header>
        {pageTabsEnabled ? (
          <div className="flex h-11 items-center gap-2 overflow-x-auto border-b bg-background px-4">
            {openTabs.map((tab) => {
              const tabRoute = adminRouteMetadata.find((route) => route.path === tab);
              return (
                <div className="flex items-center rounded-md border bg-card" key={tab}>
                  <Link
                    activeOptions={{ exact: true }}
                    className="px-3 py-1.5 text-xs [&.active]:font-semibold"
                    to={tab}
                  >
                    {translate(language, tabRoute?.titleI18nKey ?? "routes.dashboard")}
                  </Link>
                  {tab !== "/" ? (
                    <button
                      aria-label={`Close ${tab}`}
                      className="px-2 text-muted-foreground hover:text-foreground"
                      onClick={() => closeTab(tab)}
                      type="button"
                    >
                      x
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-auto p-5">
          <Outlet />
        </div>
      </section>
    </main>
  );
}

export function DashboardPage() {
  const language = useLayoutStore((state) => state.language);
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {[
        { label: "System routes", value: String(adminRouteMetadata.length), icon: BookOpen },
        { label: "Permission-aware pages", value: "24", icon: KeyRound },
        { label: "Current organization", value: "Main", icon: ChevronsLeftRight },
      ].map((item) => {
        const Icon = item.icon;
        return (
          <section className="rounded-lg border bg-card p-4 shadow-sm" key={item.label}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold">{item.value}</p>
              </div>
              <Icon className="size-5 text-primary" aria-hidden="true" />
            </div>
          </section>
        );
      })}
      <section className="rounded-lg border bg-card p-4 shadow-sm lg:col-span-3">
        <h2 className="text-base font-semibold">{translate(language, "routes.dashboard")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The frontend shell is wired for base administration pages, permission-aware navigation,
          organization context switching, page tabs, dark mode, and typed API placeholders.
        </p>
      </section>
    </div>
  );
}
