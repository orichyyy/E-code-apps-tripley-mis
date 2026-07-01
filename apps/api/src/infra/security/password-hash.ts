import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const keyLength = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("base64url");
  const derivedKey = (await scrypt(password, salt, keyLength)) as Buffer;

  return `scrypt$${salt}$${derivedKey.toString("base64url")}`;
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  const [algorithm, salt, encodedKey] = passwordHash.split("$");

  if (algorithm !== "scrypt" || !salt || !encodedKey) {
    return false;
  }

  const expected = Buffer.from(encodedKey, "base64url");
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
