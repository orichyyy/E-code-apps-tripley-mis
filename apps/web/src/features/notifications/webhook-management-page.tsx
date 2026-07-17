import { useState } from "react";

import { Button } from "@/components/ui/button";
import { translate } from "@/i18n/messages";
import type { WebAdminRouteMetadata } from "@/route-metadata";
import { useLayoutStore } from "@/stores/layout.store";
import { WebhookDeliveriesPanel } from "./webhook-deliveries-panel";
import { WebhookSubscriptionsPanel } from "./webhook-subscriptions-page";

export function WebhookSubscriptionsPage({ route }: { route: WebAdminRouteMetadata }) {
  const language = useLayoutStore((state) => state.language);
  const [tab, setTab] = useState<"subscriptions" | "deliveries">("subscriptions");
  return (
    <div className="space-y-4">
      <div
        className="inline-flex rounded-md border bg-card p-1"
        role="tablist"
        aria-label="Webhook management views"
      >
        <Button
          aria-selected={tab === "subscriptions"}
          onClick={() => setTab("subscriptions")}
          role="tab"
          size="sm"
          variant={tab === "subscriptions" ? "default" : "ghost"}
        >
          {translate(language, "webhooks.subscriptions")}
        </Button>
        <Button
          aria-selected={tab === "deliveries"}
          onClick={() => setTab("deliveries")}
          role="tab"
          size="sm"
          variant={tab === "deliveries" ? "default" : "ghost"}
        >
          {translate(language, "webhooks.deliveries")}
        </Button>
      </div>
      {tab === "subscriptions" ? (
        <WebhookSubscriptionsPanel route={route} />
      ) : (
        <WebhookDeliveriesPanel />
      )}
    </div>
  );
}
