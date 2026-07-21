import { afterEach, describe, expect, it, vi } from "vitest";

import {
  applyModuleSync,
  fetchModuleRegistry,
  fetchModuleSyncPlan,
} from "../src/features/system/module-registry-api";

const hash = "a".repeat(64);

describe("module registry API client", () => {
  afterEach(() => vi.restoreAllMocks());

  it("reads the registry and plan and applies the reviewed registry hash", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: registryData() }))
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            registryHash: hash,
            acceptedRegistryHash: null,
            changes: [],
            dependencyFailures: [],
            canApply: true,
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            applied: true,
            registryHash: hash,
            acceptedAt: "2026-07-20T04:00:00.000Z",
            modules: [],
          },
        }),
      );

    expect((await fetchModuleRegistry()).registryHash).toBe(hash);
    expect((await fetchModuleSyncPlan()).canApply).toBe(true);
    expect((await applyModuleSync(hash)).applied).toBe(true);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/modules/sync/apply",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ expectedRegistryHash: hash, confirmed: true }),
      }),
    );
  });
});

function registryData() {
  return {
    registryHash: hash,
    acceptedRegistryHash: null,
    modules: [],
  };
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
