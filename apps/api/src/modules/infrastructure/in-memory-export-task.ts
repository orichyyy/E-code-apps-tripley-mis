export function createInMemoryExportTask(
  resourceType: string,
  actorId: string | null,
  nextId: () => string,
) {
  const now = new Date().toISOString();
  return {
    id: nextId(),
    taskType: "export",
    resourceType,
    status: "pending",
    totalRows: 0,
    successRows: 0,
    failedRows: 0,
    errorPreview: [] as unknown[],
    resultExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: now,
    updatedAt: now,
    createdBy: actorId,
  };
}
