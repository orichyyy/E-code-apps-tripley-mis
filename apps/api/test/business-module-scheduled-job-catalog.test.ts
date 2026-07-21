import { describe, expect, it } from "vitest";

import { InfrastructureServices } from "../src/modules/infrastructure/infrastructure.service";

describe("Business Module Scheduled Job catalog", () => {
  it("persists and enables schedules only while their handler type is active", async () => {
    let active: ReadonlySet<string> = new Set(["fixture-jobs.reconcile"]);
    const services = InfrastructureServices.inMemory({
      scheduledJobTypeSource: async () => active,
    });

    await expect(
      services.createScheduledTask({
        code: "fixture-reconcile",
        cronExpression: "0 * * * *",
        handlerType: "fixture-jobs.reconcile",
        payload: {},
        enabled: true,
      }),
    ).resolves.toMatchObject({ handlerType: "fixture-jobs.reconcile", status: "enabled" });
    await expect(
      services.createScheduledTask({
        code: "unknown",
        cronExpression: "0 * * * *",
        handlerType: "fixture-jobs.unknown",
        payload: {},
        enabled: true,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_INVALID_REQUEST" });

    active = new Set();
    await expect(services.setScheduledTaskStatus("1", false)).resolves.toMatchObject({
      status: "disabled",
    });
    await expect(services.setScheduledTaskStatus("1", true)).rejects.toMatchObject({
      code: "VALIDATION_INVALID_REQUEST",
    });
    await expect(services.enqueueScheduledTaskRun("1")).rejects.toMatchObject({
      code: "VALIDATION_INVALID_REQUEST",
    });
  });
});
