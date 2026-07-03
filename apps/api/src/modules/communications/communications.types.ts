export type AnnouncementScopeType = "system" | "organization";
export type AnnouncementStatus = "draft" | "published" | "deleted";
export type WebhookSubscriptionStatus = "enabled" | "disabled";

export type AnnouncementRecord = {
  id: string;
  tenantId: string | null;
  title: string;
  content: string;
  scopeType: AnnouncementScopeType;
  status: AnnouncementStatus;
  publishedAt: string | null;
  isDeleted: boolean;
  deletedAt: string | null;
  deletedBy: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
};

export type WebhookSubscriptionRecord = {
  id: string;
  tenantId: string | null;
  name: string;
  url: string;
  eventTypes: string[];
  secretConfigured: boolean;
  status: WebhookSubscriptionStatus;
  isDeleted: boolean;
  deletedAt: string | null;
  deletedBy: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
};
