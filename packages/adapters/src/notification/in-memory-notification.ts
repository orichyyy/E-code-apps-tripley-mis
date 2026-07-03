import type { NotificationChannelAdapter, NotificationMessage } from ".";

export function createInMemoryNotificationChannelAdapter(): NotificationChannelAdapter & {
  listMessages: () => NotificationMessage[];
} {
  const messages: NotificationMessage[] = [];

  return {
    async healthCheck() {
      return { ok: true };
    },
    async send(message) {
      messages.push({ ...message, metadata: message.metadata ? { ...message.metadata } : undefined });
    },
    listMessages() {
      return messages.map((message) => ({
        ...message,
        metadata: message.metadata ? { ...message.metadata } : undefined
      }));
    }
  };
}
