import { AlertCircle, Loader2 } from "lucide-react";

import { translate } from "@/i18n/messages";
import {
  type WebhookDelivery,
  type WebhookDeliveryStatus,
  fetchWebhookDelivery,
} from "./webhook-delivery-api";

type Language = "en" | "zh";

export function DeliveryTable({
  error,
  language,
  loading,
  onSelect,
  rows,
}: {
  error: boolean;
  language: Language;
  loading: boolean;
  onSelect: (record: WebhookDelivery) => void;
  rows: WebhookDelivery[];
}) {
  if (loading)
    return <State icon="loading" text={translate(language, "webhooks.loadingDeliveries")} />;
  if (error) return <State icon="error" text={translate(language, "webhooks.deliveryError")} />;
  if (rows.length === 0)
    return (
      <div className="p-8 text-sm text-muted-foreground">
        {translate(language, "webhooks.noDeliveries")}
      </div>
    );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="border-b px-4 py-3">{translate(language, "webhooks.event")}</th>
            <th className="border-b px-4 py-3">{translate(language, "webhooks.target")}</th>
            <th className="border-b px-4 py-3">{translate(language, "webhooks.status")}</th>
            <th className="border-b px-4 py-3">{translate(language, "webhooks.attempts")}</th>
            <th className="border-b px-4 py-3">{translate(language, "webhooks.created")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              className="cursor-pointer hover:bg-muted/40"
              key={row.id}
              onClick={() => onSelect(row)}
            >
              <td className="border-b px-4 py-3 font-medium">{row.eventType}</td>
              <td className="border-b px-4 py-3">{row.targetHost}</td>
              <td className="border-b px-4 py-3">
                <StatusBadge status={row.status} />
              </td>
              <td className="border-b px-4 py-3">
                {row.attempt}/{row.maxAttempts}
              </td>
              <td className="border-b px-4 py-3 text-muted-foreground">
                {formatTime(row.createdAt, language)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DeliveryDetail({
  error,
  language,
  loading,
  record,
}: {
  error: boolean;
  language: Language;
  loading: boolean;
  record?: Awaited<ReturnType<typeof fetchWebhookDelivery>>;
}) {
  if (loading)
    return (
      <aside className="rounded-lg border bg-card">
        <State icon="loading" text={translate(language, "webhooks.loadingDetail")} />
      </aside>
    );
  if (error)
    return (
      <aside className="rounded-lg border bg-card">
        <State icon="error" text={translate(language, "webhooks.detailError")} />
      </aside>
    );
  if (!record)
    return (
      <aside className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
        {translate(language, "webhooks.selectDelivery")}
      </aside>
    );
  return (
    <aside className="rounded-lg border bg-card p-4 shadow-sm">
      <h3 className="text-sm font-semibold">
        {translate(language, "webhooks.delivery")} {record.id}
      </h3>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
        <dt>{translate(language, "webhooks.eventId")}</dt>
        <dd className="break-all">{record.eventId}</dd>
        <dt>{translate(language, "webhooks.target")}</dt>
        <dd>{record.targetHost}</dd>
        <dt>{translate(language, "webhooks.status")}</dt>
        <dd>
          <StatusBadge status={record.status} />
        </dd>
      </dl>
      <h4 className="mt-5 text-xs font-semibold uppercase text-muted-foreground">
        {translate(language, "webhooks.attempts")}
      </h4>
      <div className="mt-2 space-y-2">
        {record.attempts.length ? (
          record.attempts.map((attempt) => (
            <div className="rounded-md border p-3 text-xs" key={attempt.id}>
              <div className="flex justify-between">
                <strong>
                  {translate(language, "webhooks.attempt")} {attempt.attemptNumber}
                </strong>
                <span>{attempt.status}</span>
              </div>
              <p className="mt-1 text-muted-foreground">
                HTTP {attempt.httpStatus ?? "-"} · {attempt.durationMs} ms
              </p>
              {attempt.errorCode ? (
                <p className="mt-1 break-words text-destructive">
                  {attempt.errorCode}: {attempt.errorMessage}
                </p>
              ) : null}
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            {translate(language, "webhooks.noAttempts")}
          </p>
        )}
      </div>
    </aside>
  );
}

function StatusBadge({ status }: { status: WebhookDeliveryStatus }) {
  const tone =
    status === "succeeded"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : status === "failed"
        ? "bg-destructive/10 text-destructive"
        : "bg-muted text-muted-foreground";
  return <span className={`inline-flex rounded-md px-2 py-1 text-xs ${tone}`}>{status}</span>;
}

function State({ icon, text }: { icon: "loading" | "error"; text: string }) {
  return (
    <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
      {icon === "loading" ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <AlertCircle className="size-4 text-destructive" aria-hidden="true" />
      )}
      {text}
    </div>
  );
}

function formatTime(value: string, language: Language): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en", {
        dateStyle: "short",
        timeStyle: "medium",
      }).format(date);
}
