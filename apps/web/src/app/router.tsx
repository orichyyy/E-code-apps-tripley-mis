import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect } from "react";
import type { ReactNode } from "react";

import { AdminShell, DashboardPage } from "@/components/admin/admin-shell";
import { ManagementPage } from "@/components/admin/management-page";
import {
  PasswordChangePage,
  ForcedPasswordChangePage,
  LoginPage,
} from "@/features/auth/auth-pages";
import { CoreManagementPage } from "@/features/core-management/core-management-page";
import { AnnouncementsPage } from "@/features/notifications/announcements-page";
import { InAppNotificationsPage } from "@/features/notifications/in-app-notifications-page";
import { NotificationTemplatesPage } from "@/features/notifications/notification-templates-page";
import { WebhookSubscriptionsPage } from "@/features/notifications/webhook-subscriptions-page";
import { LogsPage } from "@/features/logs/logs-page";
import { ImportExportPage } from "@/features/operations/import-export-page";
import { OnlineUsersPage } from "@/features/operations/online-users-page";
import { SchedulerPage } from "@/features/operations/scheduler-page";
import { DictionaryPage } from "@/features/system/dictionary-page";
import { FilesPage } from "@/features/system/files-page";
import { I18nMessagesPage } from "@/features/system/i18n-messages-page";
import { SystemConfigPage } from "@/features/system/system-config-page";
import { PersonalSettingsPage } from "@/features/account/settings-page";
import { ProfilePage } from "@/features/account/profile-page";
import { adminRouteMetadata } from "@/route-metadata";
import { hasPermission } from "@/features/permissions/permission-utils";
import { isLogRouteCode } from "@/features/logs/log-api";
import { useAuthStore } from "@/stores/auth.store";

function RootLayout() {
  return <Outlet />;
}

function AdminGuard() {
  const navigate = useNavigate();
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (!accessToken) {
      void navigate({ to: "/login" });
    } else if (user?.forcePasswordChange) {
      void navigate({ to: "/forced-password-change" });
    }
  }, [accessToken, navigate, user?.forcePasswordChange]);

  return accessToken ? <AdminShell /> : null;
}

function RoutePermissionGuard({
  children,
  requiredPermission,
}: {
  children: ReactNode;
  requiredPermission?: string;
}) {
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  return hasPermission(permissionCodes, requiredPermission) ? (
    <>{children}</>
  ) : (
    <section className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
      You do not have permission to view this page.
    </section>
  );
}

const rootRoute = createRootRoute({
  component: RootLayout,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
});

const forcedPasswordChangeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/forced-password-change",
  component: ForcedPasswordChangePage,
});

const adminLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "admin",
  component: AdminGuard,
});

const dashboardRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/",
  component: DashboardPage,
});

const managementRoutes = adminRouteMetadata
  .filter(
    (route) =>
      route.path !== "/" &&
      route.routeCode !== "account.profile" &&
      route.routeCode !== "account.password" &&
      route.routeCode !== "account.settings",
  )
  .map((route) =>
    createRoute({
      getParentRoute: () => adminLayoutRoute,
      path: route.path,
      component: () => (
        <RoutePermissionGuard requiredPermission={route.requiredPermission}>
          {route.routeCode === "notifications.in-app" ? (
            <InAppNotificationsPage route={route} />
          ) : route.routeCode === "notifications.announcements" ? (
            <AnnouncementsPage route={route} />
          ) : route.routeCode === "system.i18nMessages" ? (
            <I18nMessagesPage route={route} />
          ) : route.routeCode === "system.files" ? (
            <FilesPage route={route} />
          ) : route.routeCode === "notifications.templates" ? (
            <NotificationTemplatesPage route={route} />
          ) : route.routeCode === "notifications.webhooks" ? (
            <WebhookSubscriptionsPage route={route} />
          ) : route.routeCode === "operations.online-users" ? (
            <OnlineUsersPage route={route} />
          ) : route.routeCode === "operations.scheduler" ? (
            <SchedulerPage route={route} />
          ) : route.routeCode === "operations.import-export" ? (
            <ImportExportPage route={route} />
          ) : route.routeCode === "system.config" ? (
            <SystemConfigPage route={route} />
          ) : route.routeCode === "system.dictionaries" ? (
            <DictionaryPage route={route} />
          ) : route.routeCode === "system.users" ? (
            <CoreManagementPage kind="users" route={route} />
          ) : route.routeCode === "system.organizations" ? (
            <CoreManagementPage kind="organizations" route={route} />
          ) : route.routeCode === "system.roles" ? (
            <CoreManagementPage kind="roles" route={route} />
          ) : route.routeCode === "system.permissions" ? (
            <CoreManagementPage kind="permissions" route={route} />
          ) : route.routeCode === "system.menus" ? (
            <CoreManagementPage kind="menus" route={route} />
          ) : isLogRouteCode(route.routeCode) ? (
            <LogsPage route={{ ...route, routeCode: route.routeCode }} />
          ) : (
            <ManagementPage route={route} />
          )}
        </RoutePermissionGuard>
      ),
    }),
  );

const profileRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/account/profile",
  component: ProfilePage,
});

const passwordRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/account/password",
  component: PasswordChangePage,
});

const settingsRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/account/settings",
  component: PersonalSettingsPage,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  forcedPasswordChangeRoute,
  adminLayoutRoute.addChildren([
    dashboardRoute,
    ...managementRoutes,
    profileRoute,
    passwordRoute,
    settingsRoute,
  ]),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
