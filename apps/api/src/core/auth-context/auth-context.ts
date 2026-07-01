export type AuthContext = {
  userId: string;
  username: string;
  currentOrganizationId: string;
  tokenVersion: number;
  passwordChangeRequired: boolean;
};

export type AuthContextVariables = {
  authContext: AuthContext | null;
};
