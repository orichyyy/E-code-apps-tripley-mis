import type {
  CreateAnnouncementRequest,
  ListAnnouncementsQuery,
  ListCurrentAnnouncementsQuery,
  UpdateAnnouncementRequest,
} from "@web-admin-base/contracts";

export type AnnouncementScopeType = "system" | "organization";
export type AnnouncementStatus = "draft" | "published" | "deleted";

export type AnnouncementRecord = {
  id: string;
  tenantId: string | null;
  title: string;
  content: string;
  scopeType: AnnouncementScopeType;
  targetOrganizationIds: string[];
  status: AnnouncementStatus;
  publishedAt: string | null;
  expiresAt: string | null;
  isDeleted: boolean;
  deletedAt: string | null;
  deletedBy: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
};

export type AnnouncementOrganization = {
  id: string;
  path: string;
  level: number;
  status: "enabled" | "disabled";
  isDeleted: boolean;
};

export type AnnouncementPage = {
  items: AnnouncementRecord[];
  page: number;
  pageSize: number;
  total: number;
};

export type AnnouncementOperations = {
  listCatalog(query: ListAnnouncementsQuery): Promise<AnnouncementPage>;
  listCurrent(
    query: ListCurrentAnnouncementsQuery,
    currentOrganizationId: string,
  ): Promise<AnnouncementPage>;
  create(input: CreateAnnouncementRequest, actorId: string | null): Promise<AnnouncementRecord>;
  update(
    id: string,
    input: UpdateAnnouncementRequest,
    actorId: string | null,
  ): Promise<AnnouncementRecord>;
  publish(id: string, actorId: string | null): Promise<AnnouncementRecord>;
  unpublish(id: string, actorId: string | null): Promise<AnnouncementRecord>;
  delete(id: string, actorId: string | null): Promise<AnnouncementRecord>;
};
