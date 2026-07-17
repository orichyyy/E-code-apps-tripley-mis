export const disabledEmailRuntimeConfig = {
  emailDelivery: {
    enabled: false,
    concurrency: 4,
    maxAttempts: 5,
    retentionDays: 90,
    staleSeconds: 900,
    contentKeys: new Map(),
    activeKeyId: null,
  },
  smtp: {
    enabled: false,
    host: null,
    port: 587,
    secure: false,
    allowInsecureLocalhost: false,
    username: null,
    password: null,
    from: null,
    timeoutMs: 10_000,
  },
};
