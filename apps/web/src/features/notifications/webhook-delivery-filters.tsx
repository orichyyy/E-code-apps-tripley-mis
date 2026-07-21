import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { translate } from "@/i18n/messages";
import type { WebhookDeliveryFilters } from "./webhook-delivery-api";
import type { fetchWebhookEventTypes, fetchWebhookSubscriptions } from "./webhook-subscription-api";

const statuses = ["pending", "running", "succeeded", "failed", "canceled"] as const;

type Language = "en" | "zh";

export function DeliveryFilters({
  eventTypes,
  filters,
  language,
  onChange,
  onRefresh,
  subscriptions,
}: {
  eventTypes: Awaited<ReturnType<typeof fetchWebhookEventTypes>>;
  filters: WebhookDeliveryFilters;
  language: Language;
  onChange: (filters: WebhookDeliveryFilters) => void;
  onRefresh: () => void;
  subscriptions: Awaited<ReturnType<typeof fetchWebhookSubscriptions>>;
}) {
  const set = (key: keyof WebhookDeliveryFilters, value: string) =>
    onChange({ ...filters, [key]: value || undefined });
  return (
    <div className="grid gap-3 border-b p-4 lg:grid-cols-2 2xl:grid-cols-5">
      <FilterSelect
        label={translate(language, "webhooks.subscription")}
        onChange={(value) => set("subscriptionId", value)}
        options={subscriptions.map((item) => ({ label: item.name, value: item.id }))}
        value={filters.subscriptionId ?? ""}
      />
      <FilterSelect
        label={translate(language, "webhooks.eventType")}
        onChange={(value) => set("eventType", value)}
        options={eventTypes.map((item) => ({ label: item.type, value: item.type }))}
        value={filters.eventType ?? ""}
      />
      <FilterSelect
        label={translate(language, "webhooks.status")}
        onChange={(value) => set("status", value)}
        options={statuses.map((status) => ({ label: status, value: status }))}
        value={filters.status ?? ""}
      />
      <DateFilter
        label={translate(language, "webhooks.from")}
        onChange={(value) => set("from", value)}
        value={filters.from ?? ""}
      />
      <div className="flex items-end gap-2">
        <DateFilter
          label={translate(language, "webhooks.to")}
          onChange={(value) => set("to", value)}
          value={filters.to ?? ""}
        />
        <Button
          aria-label={translate(language, "actions.refresh")}
          onClick={onRefresh}
          size="icon"
          variant="outline"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <select
        className="h-9 min-w-0 rounded-md border bg-background px-3 text-sm text-foreground"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="">{label}: All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function DateFilter({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="grid min-w-0 flex-1 gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <input
        className="h-9 min-w-0 rounded-md border bg-background px-2 text-sm text-foreground"
        onChange={(event) => onChange(event.target.value)}
        type="datetime-local"
        value={value}
      />
    </label>
  );
}
