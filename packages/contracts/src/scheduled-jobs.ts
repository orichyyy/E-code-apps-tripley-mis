export const baseScheduledJobTypes = {
  logRetention: "base.logs.retention",
  fileCleanup: "base.files.cleanup",
  importExportProcess: "base.import-export.process",
  importExportResultCleanup: "base.import-export.result-cleanup",
  webhookDeliveryCleanup: "webhook.delivery.cleanup",
  emailDeliveryCleanup: "email.delivery.cleanup",
} as const;

export const baseScheduledJobTypeCatalog = Object.values(baseScheduledJobTypes);
