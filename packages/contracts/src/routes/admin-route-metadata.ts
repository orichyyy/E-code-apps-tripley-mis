export type AdminRouteMetadata = {
  routeCode: string;
  path: string;
  titleI18nKey: string;
  requiredPermission?: string;
  menuVisible: boolean;
  icon?: string;
  sortOrder?: number;
};
