import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useLayoutStore } from "@/stores/layout.store";
import { DeliveryDetail, DeliveryTable } from "./webhook-delivery-display";
import { DeliveryFilters } from "./webhook-delivery-filters";
import {
  fetchWebhookDeliveries,
  fetchWebhookDelivery,
  type WebhookDeliveryFilters,
} from "./webhook-delivery-api";
import { fetchWebhookEventTypes, fetchWebhookSubscriptions } from "./webhook-subscription-api";

export function WebhookDeliveriesPanel() {
  const language = useLayoutStore((state) => state.language);
  const [filters, setFilters] = useState<WebhookDeliveryFilters>({});
  const [selected, setSelected] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ["webhook-deliveries", filters],
    queryFn: () => fetchWebhookDeliveries(filters),
  });
  const detail = useQuery({
    enabled: Boolean(selected),
    queryKey: ["webhook-delivery", selected],
    queryFn: () => fetchWebhookDelivery(selected as string),
  });
  const subscriptions = useQuery({
    queryKey: ["webhook-subscriptions"],
    queryFn: fetchWebhookSubscriptions,
  });
  const events = useQuery({ queryKey: ["webhook-event-types"], queryFn: fetchWebhookEventTypes });

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="rounded-lg border bg-card shadow-sm">
        <DeliveryFilters
          eventTypes={events.data ?? []}
          filters={filters}
          language={language}
          onChange={setFilters}
          onRefresh={() => void list.refetch()}
          subscriptions={subscriptions.data ?? []}
        />
        <DeliveryTable
          error={list.isError}
          language={language}
          loading={list.isLoading}
          onSelect={(delivery) => setSelected(delivery.id)}
          rows={list.data?.items ?? []}
        />
      </div>
      <DeliveryDetail
        error={detail.isError}
        language={language}
        loading={detail.isLoading}
        record={detail.data}
      />
    </section>
  );
}
