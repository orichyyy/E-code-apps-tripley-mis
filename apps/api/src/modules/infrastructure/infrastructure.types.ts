export type LogType =
  | "login"
  | "operation"
  | "access"
  | "api_call"
  | "exception"
  | "security"
  | "scheduler"
  | "file_operation";

export type InfrastructureRecord = Record<string, unknown> & { id: string };

export type ScheduledTaskInput = {
  code: string;
  cronExpression: string;
  handlerType: string;
  payload: Record<string, unknown>;
  enabled: boolean;
};
