import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type ResolvedWebhookTarget = {
  url: URL;
  address: string;
  family: 4 | 6;
};

export type WebhookUrlPolicyOptions = {
  allowedHosts?: ReadonlySet<string>;
  allowInsecureLocalhost?: boolean;
  resolve?: typeof lookup;
};

export async function resolveWebhookTarget(
  rawUrl: string,
  options: WebhookUrlPolicyOptions = {},
): Promise<ResolvedWebhookTarget> {
  const url = validateWebhookUrl(rawUrl, options);
  const host = url.hostname.toLowerCase();
  const allowPrivate =
    options.allowedHosts?.has(host) || (options.allowInsecureLocalhost && isLocalhost(host));
  const literalFamily = isIP(host);
  const addresses = literalFamily
    ? [{ address: host, family: literalFamily as 4 | 6 }]
    : await (options.resolve ?? lookup)(host, { all: true, verbatim: true });
  if (addresses.length === 0) throw new Error("Webhook destination did not resolve.");
  for (const address of addresses) {
    if (!allowPrivate && isForbiddenAddress(address.address)) {
      throw new Error("Webhook destination resolves to a forbidden network address.");
    }
  }
  const selected = addresses[0];
  if (!selected) throw new Error("Webhook destination did not resolve.");
  return { url, address: selected.address, family: selected.family as 4 | 6 };
}

export function validateWebhookUrl(rawUrl: string, options: WebhookUrlPolicyOptions = {}): URL {
  const url = new URL(rawUrl);
  const host = url.hostname.toLowerCase();
  const insecureLocal = options.allowInsecureLocalhost && isLocalhost(host);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && insecureLocal)) {
    throw new Error("Webhook destinations require HTTPS.");
  }
  if (url.username || url.password || url.hash) {
    throw new Error("Webhook URL credentials and fragments are forbidden.");
  }
  if (
    isIP(host) &&
    isForbiddenAddress(host) &&
    !insecureLocal &&
    !options.allowedHosts?.has(host)
  ) {
    throw new Error("Webhook destination uses a forbidden network address.");
  }
  return url;
}

export function isForbiddenAddress(address: string): boolean {
  if (address.includes(":")) return isForbiddenIpv6(address);
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255))
    return true;
  const [a, b] = parts as [number, number, number, number];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isForbiddenIpv6(address: string): boolean {
  const normalized = address.toLowerCase().split("%")[0] ?? "";
  if (normalized === "::" || normalized === "::1") return true;
  if (
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("fec") ||
    normalized.startsWith("fed") ||
    normalized.startsWith("ff")
  )
    return true;
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (mapped) return isForbiddenAddress(mapped);
  const mappedHex = normalized.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (!mappedHex?.[1] || !mappedHex[2]) return false;
  const high = Number.parseInt(mappedHex[1], 16);
  const low = Number.parseInt(mappedHex[2], 16);
  return isForbiddenAddress(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
}

function isLocalhost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
}
