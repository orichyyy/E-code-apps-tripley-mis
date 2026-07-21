import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import type { EventBusAdapter, QueueAdapter } from "@web-admin-base/adapters";
import {
  businessModuleCsvProcessJobType,
  businessModuleOperationLogJobType,
  type ModuleExecutionContext,
} from "@web-admin-base/contracts";
import type { ModuleCapabilityBindings } from "@web-admin-base/module-sdk";

import type { InfrastructureServices } from "../../modules/infrastructure/infrastructure.service";
import { DatabaseBusinessModuleCapabilityRepository } from "./database-capability.repository";

export type BusinessModuleNotificationDelivery = (input: {
  eventType: string;
  recipientUserIds: string[];
  channel: "in_app" | "email";
  templateCode: string;
  messageId: string;
  idempotencyKey: string;
  payload: unknown;
  context: ModuleExecutionContext;
}) => Promise<void>;

export type DatabaseCapabilityBindingOptions = {
  repository: DatabaseBusinessModuleCapabilityRepository;
  infrastructure: InfrastructureServices;
  queue: QueueAdapter;
  eventBus: EventBusAdapter;
  hasPermission: ModuleCapabilityBindings["permissions"]["has"];
  deliverNotification?: BusinessModuleNotificationDelivery;
  operationLogFallbackPath?: string;
};

export function createDatabaseBusinessModuleCapabilityBindings(
  options: DatabaseCapabilityBindingOptions,
): ModuleCapabilityBindings {
  return {
    permissions: { has: options.hasPermission },
    operationEvents: {
      async record(input) {
        const { context, ...event } = input;
        try {
          await options.queue.enqueue(businessModuleOperationLogJobType, { context, event });
        } catch {
          await appendOperationFallback(
            options.operationLogFallbackPath ?? ".tmp/module-operation-fallback.jsonl",
            { context, event },
          );
        }
      },
    },
    files: {
      async get(fileId) {
        const file = await options.infrastructure.getFile(fileId);
        if (!file) return null;
        return {
          id: file.id,
          extension: file.extension,
          sizeBytes: file.sizeBytes,
          status: file.status === "active" ? "active" : "invalid",
        };
      },
      attach: (input) => options.repository.attachFile(input),
      detach: (input) => options.repository.detachFile(input),
    },
    csv: {
      async createTask(input) {
        const task = await options.repository.createCsvTask(input);
        await options.queue.enqueue(businessModuleCsvProcessJobType, {
          taskId: task.id,
          message: input.message,
        });
        return task;
      },
    },
    domainEvents: {
      publish: ({ eventType, message }) =>
        options.eventBus.publish({
          id: eventKey(eventType, message.context, message.idempotencyKey),
          type: eventType,
          payload: message,
          occurredAt: message.createdAt,
        }),
    },
    notifications: {
      async publish(input) {
        for (const channel of input.channels) {
          if (channel === "webhook") {
            await options.eventBus.publish({
              id: eventKey(input.eventType, input.message.context, input.message.idempotencyKey),
              type: input.eventType,
              payload: { ...input.message, recipientUserIds: input.recipientUserIds },
              occurredAt: input.message.createdAt,
            });
            continue;
          }
          const templateCode = input.templateCodes[channel];
          if (!templateCode || !options.deliverNotification) {
            throw new Error(`Notification delivery binding for ${channel} is unavailable.`);
          }
          await options.deliverNotification({
            eventType: input.eventType,
            recipientUserIds: input.recipientUserIds,
            channel,
            templateCode,
            messageId: input.message.messageId,
            idempotencyKey: input.message.idempotencyKey,
            payload: input.message.payload,
            context: input.message.context,
          });
        }
      },
    },
    jobs: {
      async enqueue(input) {
        const job = await options.queue.enqueue(input.jobType, input.message, {
          maxAttempts: input.maxAttempts,
        });
        return { id: job.id };
      },
    },
  };
}

function eventKey(
  eventType: string,
  context: ModuleExecutionContext,
  idempotencyKey: string,
): string {
  return `${context.moduleCode}:${eventType}:${idempotencyKey}`;
}

async function appendOperationFallback(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(value)}\n`, { encoding: "utf8" });
}
