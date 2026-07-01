import { describe, expect, it } from "vitest";

import { createWorkerRuntime } from "../src/runners/worker-runtime";

describe("worker runtime", () => {
  it("uses the configured worker name", () => {
    const runtime = createWorkerRuntime({
      nodeEnv: "test",
      workerName: "test-worker"
    });

    expect(runtime.name).toBe("test-worker");
  });
});
