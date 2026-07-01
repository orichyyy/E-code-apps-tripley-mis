export type AuthContext = {
  userId: string;
  username: string;
  currentOrganizationId: string;
  tokenVersion: number;
};

export type AuthContextVariables = {
  authContext: AuthContext | null;
};
