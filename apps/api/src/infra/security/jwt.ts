import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type AccessTokenClaims = {
  sub: string;
  sid: string;
  username: string;
  currentOrganizationId: string;
  tokenVersion: number;
  exp: number;
  iat: number;
};

export type JwtConfig = {
  secret: string;
  issuer: string;
};

export function createRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string, secret: string): string {
  return createHmac("sha256", secret).update(token).digest("base64url");
}

export function signAccessToken(claims: AccessTokenClaims, config: JwtConfig): string {
  const header = encodeBase64Url({ alg: "HS256", typ: "JWT" });
  const payload = encodeBase64Url({
    sub: claims.sub,
    sid: claims.sid,
    username: claims.username,
    currentOrganizationId: claims.currentOrganizationId,
    token_version: claims.tokenVersion,
    exp: claims.exp,
    iat: claims.iat,
    iss: config.issuer
  });
  const signature = sign(`${header}.${payload}`, config.secret);

  return `${header}.${payload}.${signature}`;
}

export function verifyAccessToken(token: string, config: JwtConfig): AccessTokenClaims {
  const [header, payload, signature] = token.split(".");

  if (!header || !payload || !signature) {
    throw new Error("Invalid JWT format");
  }

  const expectedSignature = sign(`${header}.${payload}`, config.secret);
  const expected = Buffer.from(expectedSignature);
  const actual = Buffer.from(signature);

  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new Error("Invalid JWT signature");
  }

  const decodedPayload = decodeBase64Url(payload) as SerializedAccessTokenClaims & { iss?: string };
  if (decodedPayload.iss !== config.issuer) {
    throw new Error("Invalid JWT issuer");
  }

  assertAccessTokenClaims(decodedPayload);

  if (decodedPayload.exp <= Math.floor(Date.now() / 1000)) {
    throw new Error("JWT is expired");
  }

  return {
    sub: decodedPayload.sub,
    sid: decodedPayload.sid,
    username: decodedPayload.username,
    currentOrganizationId: decodedPayload.currentOrganizationId,
    tokenVersion: decodedPayload.token_version,
    exp: decodedPayload.exp,
    iat: decodedPayload.iat
  };
}

type SerializedAccessTokenClaims = Omit<AccessTokenClaims, "tokenVersion"> & {
  token_version: number;
};

function assertAccessTokenClaims(
  value: SerializedAccessTokenClaims & { iss?: string }
): asserts value is SerializedAccessTokenClaims & { iss: string } {
  if (
    !isNonEmptyString(value.sub) ||
    !isNonEmptyString(value.sid) ||
    !isNonEmptyString(value.username) ||
    !isNonEmptyString(value.currentOrganizationId) ||
    !Number.isInteger(value.token_version) ||
    !Number.isInteger(value.exp) ||
    !Number.isInteger(value.iat)
  ) {
    throw new Error("Invalid JWT claims");
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function encodeBase64Url(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decodeBase64Url(value: string): unknown {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
}
