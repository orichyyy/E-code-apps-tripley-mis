import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ModuleRegistryPage } from "../src/features/system/module-registry-page";
import { useAuthStore } from "../src/stores/auth.store";

const hash = "a".repeat(64);
const route = {
  routeCode: "system.modules",
  path: "/system/modules",
  titleI18nKey: "routes.system.modules",
  requiredPermission: "module-registry:view",
  menuVisible: true,
  sortOrder: 167,
} as const;

describe("ModuleRegistryPage", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    useAuthStore.getState().signOut();
  });

  it("shows release state, drift, dependencies, and the reviewed sync action", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const path = String(input);
      if (path.endsWith("/modules/registry")) return jsonResponse({ data: registry() });
      if (path.endsWith("/modules/sync/apply")) {
        return jsonResponse({
          data: {
            applied: true,
            registryHash: hash,
            acceptedAt: "2026-07-20T04:00:00.000Z",
            modules: registry().modules,
          },
        });
      }
      return jsonResponse({
        data: {
          registryHash: hash,
          acceptedRegistryHash: null,
          changes: [
            {
              type: "add",
              moduleCode: "regional-ops",
              drift: "new",
              authorizationBindingsRemoved: [],
            },
          ],
          dependencyFailures: [],
          canApply: true,
        },
      });
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    signIn(["module-registry:view", "module-registry:sync"]);

    renderPage();

    expect(await screen.findByText("Regional operations")).toBeInTheDocument();
    expect(screen.getByText("pending")).toBeInTheDocument();
    expect(screen.getByText("new")).toBeInTheDocument();
    expect(screen.getByText("dictionary dependencies satisfied")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Apply reviewed plan" }));
    await waitFor(() =>
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/modules/sync/apply",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });

  it("renders the page-level permission-denied state", () => {
    signIn([]);
    renderPage();

    expect(screen.getByText("You do not have permission to view this page.")).toBeInTheDocument();
  });
});

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ModuleRegistryPage route={route} />
    </QueryClientProvider>,
  );
}

function signIn(permissionCodes: string[]) {
  useAuthStore.getState().signIn({
    accessToken: "test-token",
    user: {
      id: "1",
      username: "admin",
      displayName: "Administrator",
      language: "en",
      forcePasswordChange: false,
    },
    permissionCodes,
  });
}

function registry() {
  return {
    registryHash: hash,
    acceptedRegistryHash: null,
    modules: [
      {
        moduleCode: "regional-ops",
        defaultLocale: "en",
        title: { key: "modules.regional-ops.title", defaultMessage: "Regional operations" },
        description: null,
        definitionHash: "b".repeat(64),
        activationHash: "c".repeat(64),
        acceptedDefinitionHash: null,
        acceptedActivationHash: null,
        state: "pending",
        drift: "new",
        contributionCounts: {
          permissions: 1,
          apis: 1,
          routes: 1,
          menus: 1,
          dataResources: 0,
          fields: 0,
          operationEvents: 0,
          importExportResources: 0,
          fileAttachments: 0,
          domainEvents: 0,
          notificationEvents: 0,
          i18nMessages: 0,
          dictionaryDependencies: 0,
          scheduledJobs: 0,
          errors: 0,
        },
        dependencyFailures: [],
        acceptedAt: null,
        acceptedBy: null,
      },
    ],
  };
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
