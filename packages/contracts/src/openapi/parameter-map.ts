import type { OpenApiOperation } from "./types";

type OperationParameters = NonNullable<OpenApiOperation["parameters"]>;

export const queryParametersByOperationCode: Record<string, OperationParameters> = {
  "api.announcements.list": [
    query("status", { type: "string", enum: ["draft", "published", "deleted"] }),
    query("scopeType", { type: "string", enum: ["system", "organization"] }),
    query("publishedFrom", { type: "string", format: "date-time" }),
    query("publishedTo", { type: "string", format: "date-time" }),
    query("page", { type: "integer", minimum: 1 }),
    query("pageSize", { type: "integer", minimum: 1, maximum: 100 }),
  ],
  "api.announcements.current": [
    query("page", { type: "integer", minimum: 1 }),
    query("pageSize", { type: "integer", minimum: 1, maximum: 100 }),
  ],
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
  "api.email-deliveries.list": [
    query("userId", { type: "string", pattern: "^\\d+$" }),
    query("templateCode", { type: "string" }),
    query("locale", { type: "string" }),
    query("status", {
      type: "string",
      enum: ["pending", "running", "succeeded", "failed", "canceled"],
    }),
    query("from", { type: "string", format: "date-time" }),
    query("to", { type: "string", format: "date-time" }),
    query("page", { type: "integer", minimum: 1 }),
    query("pageSize", { type: "integer", minimum: 1, maximum: 100 }),
  ],
};

function query(
  name: string,
  schema: OperationParameters[number]["schema"],
): OperationParameters[number] {
  return { name, in: "query", required: false, schema };
}
