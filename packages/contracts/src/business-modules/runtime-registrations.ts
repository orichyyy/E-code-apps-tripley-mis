import type { z } from "zod";

import type { ModuleAsyncMessage, ModuleExecutionContext } from "./capabilities";
import type { ApiMethod } from "./types";
import type { DataPermissionOperatorHandler } from "../permissions/business-permissions";

export type BusinessApiRouteRegistration = {
  code: string;
  method: ApiMethod;
  path: string;
};

export type BusinessApiModuleRegistration = {
  moduleCode: string;
  routes: BusinessApiRouteRegistration[];
  schemas: Record<string, z.ZodType>;
  dataPermissionOperators: Record<string, DataPermissionOperatorHandler>;
  fileAttachmentAuthorizers: Record<string, BusinessFileAttachmentAuthorizer>;
  importExportResources: Record<string, BusinessImportExportApiRegistration>;
  notificationRecipientResolvers: Record<string, BusinessNotificationRecipientResolver>;
};

export type BusinessFileAttachmentAuthorizationInput = {
  context: ModuleExecutionContext;
  resourceId: string;
  fileId: string;
};

export type BusinessFileAttachmentAuthorizer = {
  canView: (input: BusinessFileAttachmentAuthorizationInput) => boolean | Promise<boolean>;
  canAttach: (input: BusinessFileAttachmentAuthorizationInput) => boolean | Promise<boolean>;
  canDetach: (input: BusinessFileAttachmentAuthorizationInput) => boolean | Promise<boolean>;
};

export type BusinessImportPreview = {
  valid: boolean;
  totalRows: number;
  errors: Array<{ row: number | null; field?: string; message: string }>;
};

export type BusinessImportExportApiRegistration = {
  normalizeExportFilters?: (
    input: unknown,
    context: ModuleExecutionContext,
  ) => Record<string, unknown> | Promise<Record<string, unknown>>;
  previewImport?: (
    fileId: string,
    context: ModuleExecutionContext,
  ) => BusinessImportPreview | Promise<BusinessImportPreview>;
};

export type BusinessNotificationRecipientResolver = (
  payload: unknown,
  context: ModuleExecutionContext,
) => string[] | Promise<string[]>;

export type BusinessWebRouteRegistration = {
  routeCode: string;
  path: string;
};

export type BusinessWebModuleRegistration = {
  moduleCode: string;
  routes: BusinessWebRouteRegistration[];
};

export type BusinessWorkerModuleRegistration = {
  moduleCode: string;
  schemas: Record<string, z.ZodType>;
  jobHandlers: Record<string, BusinessJobHandler>;
  importExportHandlers: Record<string, BusinessImportExportWorkerRegistration>;
};

export type BusinessWorkerHandlerContext = {
  context: ModuleExecutionContext;
  signal: AbortSignal;
};

export type BusinessJobHandler = (
  message: ModuleAsyncMessage,
  runtime: BusinessWorkerHandlerContext,
) => Promise<void>;

export type BusinessCsvExportResult = {
  rows: Array<Record<string, unknown>>;
};

export type BusinessCsvImportResult = {
  totalRows: number;
  successRows: number;
  errors: Array<{ row: number | null; field?: string; message: string }>;
};

export type BusinessImportExportWorkerRegistration = {
  export?: (
    message: ModuleAsyncMessage,
    runtime: BusinessWorkerHandlerContext,
  ) => Promise<BusinessCsvExportResult>;
  import?: (
    message: ModuleAsyncMessage,
    rows: Array<Record<string, string>>,
    runtime: BusinessWorkerHandlerContext,
  ) => Promise<BusinessCsvImportResult>;
};
