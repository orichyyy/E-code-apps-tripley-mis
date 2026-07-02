export type AlertSeverity = "info" | "warning" | "error" | "critical";

export type AlertEvent = {
  severity: AlertSeverity;
  code: string;
  message: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type AlertIntegration = {
  notify(event: AlertEvent): Promise<void>;
};

export function createAlertIntegrationPlaceholder(): AlertIntegration {
  return {
    async notify() {
      // Reserved extension point for production alert integrations.
    }
  };
}
