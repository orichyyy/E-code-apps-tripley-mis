import { Hono } from "hono";

export function createSyntheticBusinessRouter() {
  return new Hono().get("/api/modules/fixture-orders/orders", (context) =>
    context.json({ data: [] as Array<{ id: string }> }),
  );
}
