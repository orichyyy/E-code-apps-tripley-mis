import { computeNextCronRun } from "@web-admin-base/adapters";
import type {
  CreateScheduledTaskRequest,
  UpdateScheduledTaskRequest,
} from "@web-admin-base/contracts";

import { createKnownError } from "../../core/errors/error-codes";
import type { InfrastructureRepository } from "./infrastructure.repository";
import type { ScheduledTaskInput } from "./infrastructure.types";

export type InMemoryScheduledTask = Record<string, unknown> & {
  id: string;
  code: string;
  handlerType: string;
  enabled: boolean;
};

export class InfrastructureSchedulerService {
  constructor(
    private readonly repository: InfrastructureRepository | undefined,
    private readonly memory: InMemoryScheduledTask[],
    private readonly nextId: () => string,
    private readonly registeredTypeSource?: () => Promise<ReadonlySet<string>>,
  ) {}

  list() {
    return this.repository?.listScheduledTasks() ?? Promise.resolve(this.memory);
  }

  async create(input: CreateScheduledTaskRequest) {
    await this.assertRegistered(input.handlerType);
    const normalized: ScheduledTaskInput = {
      code: input.code,
      cronExpression: input.cronExpression,
      handlerType: input.handlerType,
      payload: input.payload,
      enabled: input.enabled,
    };
    if (this.repository) return this.repository.createScheduledTask(normalized);
    const timestamp = new Date().toISOString();
    const task: InMemoryScheduledTask = {
      id: this.nextId(),
      ...normalized,
      status: normalized.enabled ? "enabled" : "disabled",
      nextRunAt: normalized.enabled
        ? nextScheduledRunOrThrow(normalized.cronExpression, timestamp)
        : null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.memory.unshift(task);
    return task;
  }

  async update(id: string, input: UpdateScheduledTaskRequest) {
    if (input.handlerType) {
      await this.assertRegistered(input.handlerType);
    } else if (input.enabled) {
      const task = await this.find(id);
      if (task) await this.assertRegistered(String(task.handlerType));
    }
    if (this.repository) return this.repository.updateScheduledTask(id, input);
    const task = this.memory.find((item) => item.id === id);
    if (!task) return null;
    const timestamp = new Date().toISOString();
    const next = { ...task, ...input };
    Object.assign(task, input, {
      nextRunAt: next.enabled
        ? nextScheduledRunOrThrow(String(next.cronExpression), timestamp)
        : null,
      updatedAt: timestamp,
    });
    return task;
  }

  async setStatus(id: string, enabled: boolean) {
    const task = await this.find(id);
    if (enabled && task) await this.assertRegistered(String(task.handlerType));
    if (this.repository) return this.repository.setScheduledTaskStatus(id, enabled);
    if (!task) return null;
    const timestamp = new Date().toISOString();
    task.enabled = enabled;
    task.status = enabled ? "enabled" : "disabled";
    task.nextRunAt = enabled
      ? nextScheduledRunOrThrow(String(task.cronExpression), timestamp)
      : null;
    return task;
  }

  async enqueueRun(id: string) {
    const task = await this.find(id);
    if (!task) return null;
    await this.assertRegistered(String(task.handlerType));
    return this.repository?.enqueueScheduledTaskRun(id) ?? task;
  }

  private async find(id: string) {
    return (await this.list()).find((item) => item.id === id) ?? null;
  }

  private async assertRegistered(handlerType: string): Promise<void> {
    if (!this.registeredTypeSource) return;
    const registered = await this.registeredTypeSource();
    if (registered.has(handlerType)) return;
    throw createKnownError("VALIDATION_INVALID_REQUEST", {
      field: "handlerType",
      reason: `Scheduled Job handler ${handlerType} is not registered by the Base System or an active Business Module.`,
    });
  }
}

function nextScheduledRunOrThrow(cronExpression: string, timestamp: string): string {
  try {
    return computeNextCronRun(cronExpression, new Date(timestamp));
  } catch (error) {
    throw createKnownError("VALIDATION_INVALID_REQUEST", {
      field: "cronExpression",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
