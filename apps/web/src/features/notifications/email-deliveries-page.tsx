import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { translate } from "@/i18n/messages";
import type { WebAdminRouteMetadata } from "@/route-metadata";
import { useLayoutStore } from "@/stores/layout.store";
import {
  fetchEmailDeliveries,
  fetchEmailDelivery,
  type EmailDeliveryFilters,
} from "./email-delivery-api";
import { EmailDeliveryDetailPanel, EmailDeliveryTable } from "./email-delivery-display";

const statuses = ["pending", "running", "succeeded", "failed", "canceled"] as const;

export function EmailDeliveriesPage({ route }: { route: WebAdminRouteMetadata }) {
  const language = useLayoutStore((state) => state.language);
  const [filters, setFilters] = useState<EmailDeliveryFilters>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ["email-deliveries", filters],
    queryFn: () => fetchEmailDeliveries(filters),
  });
  const detail = useQuery({
    enabled: Boolean(selectedId),
    queryKey: ["email-delivery", selectedId],
    queryFn: () => fetchEmailDelivery(selectedId as string),
  });
  const set = (key: keyof EmailDeliveryFilters, value: string) =>
    setFilters((current) => ({ ...current, [key]: value || undefined }));
  return (
    <section className="space-y-4" aria-label={translate(language, route.titleI18nKey)}>
      <header>
        <h2 className="text-lg font-semibold">{translate(language, route.titleI18nKey)}</h2>
      </header>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="rounded-lg border bg-card shadow-sm">
          <div className="grid gap-3 border-b p-4 md:grid-cols-2 xl:grid-cols-4">
            <Filter
              label={translate(language, "email.user")}
              value={filters.userId ?? ""}
              onChange={(value) => set("userId", value)}
            />
            <Filter
              label={translate(language, "email.template")}
              value={filters.templateCode ?? ""}
              onChange={(value) => set("templateCode", value)}
            />
            <Filter
              label={translate(language, "email.locale")}
              value={filters.locale ?? ""}
              onChange={(value) => set("locale", value)}
            />
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              {translate(language, "email.status")}
              <select
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={filters.status ?? ""}
                onChange={(event) => set("status", event.target.value)}
              >
                <option value="">{translate(language, "email.all")}</option>
                {statuses.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>
            <Filter
              label={translate(language, "email.from")}
              type="datetime-local"
              value={filters.from ?? ""}
              onChange={(value) => set("from", value)}
            />
            <Filter
              label={translate(language, "email.to")}
              type="datetime-local"
              value={filters.to ?? ""}
              onChange={(value) => set("to", value)}
            />
            <div className="flex items-end">
              <Button
                aria-label={translate(language, "actions.refresh")}
                onClick={() => void list.refetch()}
                size="icon"
                variant="outline"
              >
                <RefreshCw className="size-4" />
              </Button>
            </div>
          </div>
          <EmailDeliveryTable
            error={list.isError}
            language={language}
            loading={list.isLoading}
            onSelect={(row) => setSelectedId(row.id)}
            rows={list.data?.items ?? []}
          />
        </div>
        <EmailDeliveryDetailPanel
          error={detail.isError}
          language={language}
          loading={detail.isLoading}
          record={detail.data}
        />
      </div>
    </section>
  );
}

function Filter({
  label,
  type = "text",
  value,
  onChange,
}: {
  label: string;
  type?: "text" | "datetime-local";
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <input
        className="h-9 rounded-md border bg-background px-3 text-sm text-foreground"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
