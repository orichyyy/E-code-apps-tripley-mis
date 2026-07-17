import type { OpenApiOperation } from "./types";

type OperationParameters = NonNullable<OpenApiOperation["parameters"]>;

export const queryParametersByOperationCode: Record<string, OperationParameters> = {
  "api.webhook-deliveries.list": [
    query("subscriptionId", { type: "string" }),
    query("eventType", {
      type: "string",
      enum: ["user.created", "job.failed", "permission.changed", "notification.requested"],
    }),
    query("status", {
      type: "string",
      enum: ["pending", "running", "succeeded", "failed", "canceled"],
    }),
    query("from", { type: "string", format: "date-time" }),
    query("to", { type: "string", format: "date-time" }),
    query("page", { type: "integer" }),
    query("pageSize", { type: "integer" }),
  ],
};

function query(
  name: string,
  schema: OperationParameters[number]["schema"],
): OperationParameters[number] {
  return { name, in: "query", required: false, schema };
}
