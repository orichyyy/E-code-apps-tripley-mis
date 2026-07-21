import type {
  BusinessApiModuleRegistration,
  BusinessModuleDefinition,
  ModuleAsyncMessage,
  ModuleCsvTask,
  ModuleExecutionContext,
  ModuleFileReference,
  ModuleOperationEventInput,
} from "@web-admin-base/contracts";

export type ModuleManagedFile = {
  id: string;
  extension: string;
  sizeBytes: number;
  status: "active" | "invalid";
};

export type ModuleCapabilityBindings = {
  permissions: {
    has: (permissionCode: string, context: ModuleExecutionContext) => boolean | Promise<boolean>;
  };
  operationEvents: {
    record: (
      input: ModuleOperationEventInput & { context: ModuleExecutionContext },
    ) => Promise<void>;
  };
  files: {
    get: (fileId: string) => Promise<ModuleManagedFile | null>;
    attach: (input: {
      context: ModuleExecutionContext;
      fileId: string;
      resourceId: string;
      resourceType: string;
      attachmentCode: string;
      cardinality: "single" | "multiple";
    }) => Promise<ModuleFileReference>;
    detach: (input: {
      context: ModuleExecutionContext;
      fileId: string;
      resourceId: string;
      resourceType: string;
      attachmentCode: string;
    }) => Promise<void>;
  };
  csv: {
    createTask: (input: {
      message: ModuleAsyncMessage;
      taskType: "import" | "export";
      resourceType: string;
      fileId?: string;
      filters?: Record<string, unknown>;
      exportFields: string[];
    }) => Promise<ModuleCsvTask>;
  };
  domainEvents: {
    publish: (input: { eventType: string; message: ModuleAsyncMessage }) => Promise<void>;
  };
  notifications: {
    publish: (input: {
      eventType: string;
      message: ModuleAsyncMessage;
      recipientUserIds: string[];
      channels: Array<"in_app" | "email" | "webhook">;
      templateCodes: Partial<Record<"in_app" | "email" | "webhook", string>>;
    }) => Promise<void>;
  };
  jobs: {
    enqueue: (input: {
      jobType: string;
      message: ModuleAsyncMessage;
      timeoutSeconds: number;
      maxAttempts: number;
    }) => Promise<{ id: string }>;
  };
};

export type BusinessModuleCapabilityOptions = {
  definition: BusinessModuleDefinition;
  apiRegistration: BusinessApiModuleRegistration;
  context: ModuleExecutionContext;
  bindings: ModuleCapabilityBindings;
  now?: () => Date;
  nextId?: () => string;
};

export type ModuleCapabilityRuntime = ReturnType<
  typeof import("./runtime").createBusinessModuleCapabilities
>;
