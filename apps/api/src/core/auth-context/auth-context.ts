export type AuthContext = {
  userId: string;
  sessionId: string;
  username: string;
  currentOrganizationId: string;
  tokenVersion: number;
  passwordChangeRequired: boolean;
};

export type AuthContextVariables = {
  authContext: AuthContext | null;
};
