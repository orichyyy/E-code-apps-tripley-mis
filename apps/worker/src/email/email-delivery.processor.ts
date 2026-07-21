import {
  decryptEmailContent,
  SmtpDeliveryError,
  type AlertIntegration,
  type EmailDeliveryConfig,
  type NotificationChannelAdapter,
  type SmtpRuntimeConfig,
} from "@web-admin-base/adapters";

import {
  WorkerEmailDeliveryRepository,
  type ClaimedEmailDelivery,
  type EmailAttemptResult,
} from "./email-delivery.repository";

export type EmailDeliveryProcessor = {
  processReady: () => Promise<number>;
  health: () => Promise<{ ok: boolean; missingKeyIds: string[] }>;
};

export function createEmailDeliveryProcessor(options: {
  repository: WorkerEmailDeliveryRepository;
  config: EmailDeliveryConfig;
  smtp: SmtpRuntimeConfig;
  channel: NotificationChannelAdapter;
  workerId: string;
  log?: (entry: Record<string, unknown>) => void;
  alert?: AlertIntegration;
}): EmailDeliveryProcessor {
  const keyIds = [...options.config.contentKeys.keys()];
  let lastMissingKeyAlert = "";
  const health = async () => {
    const missingKeyIds = await options.repository.unavailableKeyIds(keyIds);
    return { ok: missingKeyIds.length === 0, missingKeyIds };
  };
  return {
    health,
    async processReady() {
      if (!options.config.enabled || !options.smtp.enabled) return 0;
      await recoverStaleDeliveries(options);
      await options.repository.cancelDeletedUsers();
      lastMissingKeyAlert = await reportKeyHealth(options, await health(), lastMissingKeyAlert);
      const deliveries = await options.repository.claimReady(
        options.workerId,
        options.config.concurrency,
        keyIds,
      );
      const results = await Promise.all(
        deliveries.map(async (delivery) => ({
          delivery,
          result: await deliverOne(delivery, options.config, options.channel),
        })),
      );
      await persistDeliveryResults(options, results);
      return deliveries.length;
    },
  };
}

type ProcessorOptions = Parameters<typeof createEmailDeliveryProcessor>[0];

async function recoverStaleDeliveries(options: ProcessorOptions): Promise<void> {
  const failures = await options.repository.recoverStaleRunning(options.config.staleSeconds);
  for (const failure of failures) {
    await options.alert?.notify({
      severity: "error",
      code: "EMAIL_DELIVERY_WORKER_TIMEOUT",
      message: "Email delivery exhausted its attempts after stale Worker recovery.",
      metadata: failure,
      createdAt: new Date().toISOString(),
    });
  }
}

async function reportKeyHealth(
  options: ProcessorOptions,
  health: { ok: boolean; missingKeyIds: string[] },
  previousSignature: string,
): Promise<string> {
  if (health.ok) return "";
  options.log?.({ type: "email.delivery.health", missingKeyIds: health.missingKeyIds });
  const signature = health.missingKeyIds.join(",");
  if (signature === previousSignature) return signature;
  await options.alert?.notify({
    severity: "warning",
    code: "EMAIL_CONTENT_KEY_UNAVAILABLE",
    message: "Unfinished email deliveries reference unavailable content keys.",
    metadata: { missingKeyIds: health.missingKeyIds },
    createdAt: new Date().toISOString(),
  });
  return signature;
}

async function persistDeliveryResults(
  options: ProcessorOptions,
  results: Array<{ delivery: ClaimedEmailDelivery; result: EmailAttemptResult }>,
): Promise<void> {
  for (const { delivery, result } of results) {
    await options.repository.recordAttempt(result);
    const log = safeLog(delivery, result);
    options.log?.(log);
    if (result.status === "failed" && !result.retry) {
      await options.alert?.notify({
        severity: "error",
        code: result.errorCode ?? "EMAIL_DELIVERY_FAILED",
        message: "Email delivery reached a terminal failure.",
        metadata: log,
        createdAt: result.finishedAt,
      });
    }
  }
}

async function deliverOne(
  delivery: ClaimedEmailDelivery,
  config: EmailDeliveryConfig,
  channel: NotificationChannelAdapter,
): Promise<EmailAttemptResult> {
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  let snapshot: ReturnType<typeof decryptEmailContent>;
  try {
    snapshot = decryptEmailContent(delivery.contentEnvelope, config.contentKeys);
  } catch {
    return result(
      delivery,
      startedAt,
      startedMs,
      "failed",
      false,
      null,
      "CONTENT_DECRYPTION_FAILED",
      "Encrypted email content could not be authenticated.",
    );
  }
  try {
    await channel.send({
      channel: "email",
      recipient: snapshot.recipient,
      subject: snapshot.subject,
      body: snapshot.body,
      messageId: delivery.messageId,
    });
    return result(delivery, startedAt, startedMs, "succeeded", false, null, null, null);
  } catch (error) {
    const smtp = error instanceof SmtpDeliveryError ? error : null;
    const retry = Boolean(smtp?.retryable && delivery.attempt < delivery.maxAttempts);
    return result(
      delivery,
      startedAt,
      startedMs,
      "failed",
      retry,
      smtp?.smtpCode ?? null,
      smtp?.code ?? "SMTP_DELIVERY_FAILED",
      smtp?.message ?? "SMTP delivery failed.",
    );
  }
}

function result(
  delivery: ClaimedEmailDelivery,
  startedAt: string,
  startedMs: number,
  status: "succeeded" | "failed",
  retry: boolean,
  smtpCode: number | null,
  errorCode: string | null,
  errorMessage: string | null,
): EmailAttemptResult {
  const finishedAt = new Date().toISOString();
  return {
    delivery,
    status,
    retry,
    startedAt,
    finishedAt,
    durationMs: Math.max(0, Date.now() - startedMs),
    smtpCode,
    errorCode,
    errorMessage: errorMessage?.slice(0, 500) ?? null,
    nextAttemptAt: retry ? nextEmailAttemptAt(delivery.attempt) : null,
  };
}

export function nextEmailAttemptAt(attempt: number, now = Date.now()): string {
  const delays = [30, 120, 600, 1800];
  const seconds = delays[Math.min(Math.max(attempt - 1, 0), delays.length - 1)] ?? 1800;
  return new Date(now + seconds * 1000).toISOString();
}

function safeLog(delivery: ClaimedEmailDelivery, result: EmailAttemptResult) {
  return {
    type: "email.delivery",
    deliveryId: delivery.id,
    userId: delivery.userId,
    templateCode: delivery.templateCode,
    locale: delivery.locale,
    maskedRecipient: delivery.maskedRecipient,
    attempt: delivery.attempt,
    outcome: result.status,
    smtpCode: result.smtpCode,
    errorCode: result.errorCode,
    durationMs: result.durationMs,
    finishedAt: result.finishedAt,
  };
}
