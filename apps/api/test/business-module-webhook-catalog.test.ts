import { describe, expect, it } from "vitest";

import { CommunicationsServices } from "../src/modules/communications/communications.service";

describe("Business Module webhook catalog", () => {
  it("accepts active module events and rejects events outside the controlled catalog", async () => {
    const service = CommunicationsServices.inMemory(undefined, async () => [
      { type: "fixture-events.changed", description: "Fixture changed" },
    ]);

    await expect(
      service.createWebhook(
        {
          name: "Fixture receiver",
          url: "https://example.com/events",
          eventTypes: ["fixture-events.changed"],
          status: "enabled",
          secret: null,
        },
        "1",
      ),
    ).resolves.toMatchObject({ eventTypes: ["fixture-events.changed"] });
    await expect(
      service.createWebhook(
        {
          name: "Unknown receiver",
          url: "https://example.com/events",
          eventTypes: ["fixture-events.removed"],
          status: "enabled",
          secret: null,
        },
        "1",
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_INVALID_REQUEST" });
  });
});
