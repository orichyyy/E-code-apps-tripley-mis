import type { Context, MiddlewareHandler, Next } from "hono";

const requestIdHeader = "x-request-id";

function isValidRequestId(value: string): boolean {
  return /^[a-zA-Z0-9._:-]{8,128}$/.test(value);
}

function createRequestId(): string {
  return crypto.randomUUID();
}

export type RequestIdVariables = {
  requestId: string;
};

export const requestIdMiddleware: MiddlewareHandler<{
  Variables: RequestIdVariables;
}> = async (context: Context, next: Next) => {
  const incomingRequestId = context.req.header(requestIdHeader);
  const requestId =
    incomingRequestId && isValidRequestId(incomingRequestId) ? incomingRequestId : createRequestId();

  context.set("requestId", requestId);
  context.header(requestIdHeader, requestId);

  await next();
};
