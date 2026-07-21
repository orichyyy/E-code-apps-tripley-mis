import { AlertCircle, Loader2 } from "lucide-react";

import { StatusBadge } from "@/features/operations/status-badge";
import { translate } from "@/i18n/messages";
import type { EmailDelivery, EmailDeliveryDetail } from "./email-delivery-api";

type Language = "en" | "zh";

export function EmailDeliveryTable(props: {
  rows: EmailDelivery[];
  loading: boolean;
  error: boolean;
  language: Language;
  onSelect: (row: EmailDelivery) => void;
}) {
  if (props.loading) return <State loading text={translate(props.language, "email.loading")} />;
  if (props.error) return <State text={translate(props.language, "email.error")} />;
  if (props.rows.length === 0)
    return (
      <div className="p-8 text-sm text-muted-foreground">
        {translate(props.language, "email.empty")}
      </div>
    );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="border-b px-4 py-3">{translate(props.language, "email.template")}</th>
            <th className="border-b px-4 py-3">{translate(props.language, "email.recipient")}</th>
            <th className="border-b px-4 py-3">{translate(props.language, "email.status")}</th>
            <th className="border-b px-4 py-3">{translate(props.language, "email.attempts")}</th>
            <th className="border-b px-4 py-3">{translate(props.language, "email.created")}</th>
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row) => (
            <tr
              className="cursor-pointer hover:bg-muted/40"
              key={row.id}
              onClick={() => props.onSelect(row)}
            >
              <td className="border-b px-4 py-3 font-medium">
                {row.templateCode} · {row.locale}
              </td>
              <td className="border-b px-4 py-3">{row.maskedRecipient}</td>
              <td className="border-b px-4 py-3">
                <StatusBadge>{row.status}</StatusBadge>
              </td>
              <td className="border-b px-4 py-3">
                {row.attempt}/{row.maxAttempts}
              </td>
              <td className="border-b px-4 py-3 text-muted-foreground">
                {formatTime(row.createdAt, props.language)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EmailDeliveryDetailPanel(props: {
  record?: EmailDeliveryDetail;
  loading: boolean;
  error: boolean;
  language: Language;
}) {
  if (props.loading)
    return (
      <aside className="rounded-lg border bg-card">
        <State loading text={translate(props.language, "email.loadingDetail")} />
      </aside>
    );
  if (props.error)
    return (
      <aside className="rounded-lg border bg-card">
        <State text={translate(props.language, "email.detailError")} />
      </aside>
    );
  if (!props.record)
    return (
      <aside className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
        {translate(props.language, "email.select")}
      </aside>
    );
  const record = props.record;
  return (
    <aside className="rounded-lg border bg-card p-4 shadow-sm">
      <h3 className="text-sm font-semibold">
        {translate(props.language, "email.delivery")} {record.id}
      </h3>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
        <dt>{translate(props.language, "email.requestKey")}</dt>
        <dd className="break-all">{record.requestKey}</dd>
        <dt>{translate(props.language, "email.user")}</dt>
        <dd>{record.userId}</dd>
        <dt>{translate(props.language, "email.recipient")}</dt>
        <dd>{record.maskedRecipient}</dd>
        <dt>{translate(props.language, "email.status")}</dt>
        <dd>
          <StatusBadge>{record.status}</StatusBadge>
        </dd>
        <dt>{translate(props.language, "email.lastError")}</dt>
        <dd className="break-words">{record.lastErrorCode ?? "-"}</dd>
      </dl>
      <h4 className="mt-5 text-xs font-semibold uppercase text-muted-foreground">
        {translate(props.language, "email.attempts")}
      </h4>
      <div className="mt-2 space-y-2">
        {record.attempts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {translate(props.language, "email.noAttempts")}
          </p>
        ) : (
          record.attempts.map((attempt) => (
            <div className="rounded-md border p-3 text-xs" key={attempt.id}>
              <div className="flex justify-between">
                <strong>#{attempt.attemptNumber}</strong>
                <span>{attempt.status}</span>
              </div>
              <p className="mt-1 text-muted-foreground">
                SMTP {attempt.smtpCode ?? "-"} · {attempt.durationMs} ms
              </p>
              {attempt.errorCode ? (
                <p className="mt-1 break-words text-destructive">
                  {attempt.errorCode}: {attempt.errorMessage}
                </p>
              ) : null}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

function State({ loading = false, text }: { loading?: boolean; text: string }) {
  return (
    <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <AlertCircle className="size-4 text-destructive" />
      )}
      {text}
    </div>
  );
}
function formatTime(value: string, language: Language) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en", {
        dateStyle: "short",
        timeStyle: "medium",
      }).format(date);
}
