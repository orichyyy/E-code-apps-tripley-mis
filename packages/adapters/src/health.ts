export type AdapterHealth = {
  ok: boolean;
  message?: string;
};

export type HealthCheckableAdapter = {
  healthCheck: () => Promise<AdapterHealth>;
};
