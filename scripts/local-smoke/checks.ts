import { createRequire } from "node:module";

import { adminPassword, adminUsername, apiChecks, requiredMenuCodes, webPort } from "./config";
import { serviceLogSummary } from "./processes";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright") as typeof import("playwright");

type LoginResponse = {
  data: {
    accessToken: string;
    menus: Array<{ code: string }>;
  };
};

export async function waitForHttp(url: string, label: string): Promise<void> {
  const deadline = Date.now() + 45_000;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`${label} returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(500);
  }

  throw new Error(`${label} did not become ready. ${String(lastError)}\n${await serviceLogSummary()}`);
}

export async function runAuthenticatedChecks(): Promise<void> {
  const { accessToken, menus } = await loginThroughWebProxy();
  assertRequiredMenus(menus.map((menu) => menu.code));
  await runApiChecks(accessToken);
}

export async function runBrowserSmoke(): Promise<void> {
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  try {
    await page.goto(`http://localhost:${webPort}/login`, { waitUntil: "networkidle" });
    await page.getByLabel("Username", { exact: true }).fill(adminUsername);
    await page.getByLabel("Password", { exact: true }).fill(adminPassword);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(`http://localhost:${webPort}/`, { timeout: 15_000 });
    await page.getByRole("navigation", { name: "Primary" }).waitFor({ state: "visible" });

    for (const label of [
      "System configuration",
      "Dictionary management",
      "Task scheduler",
      "API call logs",
      "Personal settings"
    ]) {
      const count = await page.getByRole("link", { name: label }).count();
      if (count < 1) throw new Error(`Expected visible menu link: ${label}`);
    }

    await page.getByRole("link", { name: "System configuration" }).click();
    await page.getByRole("heading", { name: "System configuration", level: 1 }).waitFor({ state: "visible" });
    await assertSingleActiveSidebarLink();
  } finally {
    await browser.close();
  }

  async function assertSingleActiveSidebarLink(): Promise<void> {
    const activeSidebarLinks = await page.locator("nav[aria-label='Primary'] a.active").evaluateAll((links) =>
      links.map((link) => link.textContent?.trim()).filter(Boolean)
    );
    if (activeSidebarLinks.length !== 1 || activeSidebarLinks[0] !== "System configuration") {
      throw new Error(`Expected only System configuration active, got ${activeSidebarLinks.join(", ")}`);
    }
  }
}

async function loginThroughWebProxy(): Promise<LoginResponse["data"]> {
  const response = await fetch(`http://localhost:${webPort}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: adminUsername, password: adminPassword })
  });
  if (!response.ok) {
    throw new Error(`Login failed with HTTP ${response.status}: ${await response.text()}`);
  }

  const body = await response.json() as LoginResponse;
  if (!body.data.accessToken) {
    throw new Error("Login response did not include an access token.");
  }
  return body.data;
}

function assertRequiredMenus(menuCodes: string[]): void {
  const missing = requiredMenuCodes.filter((code) => !menuCodes.includes(code));
  if (missing.length > 0) {
    throw new Error(`Login menu context is missing required menus: ${missing.join(", ")}`);
  }
}

async function runApiChecks(accessToken: string): Promise<void> {
  const failures: string[] = [];
  for (const endpoint of apiChecks) {
    const response = await fetch(`http://localhost:${webPort}/api${endpoint}`, {
      headers: { authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok) failures.push(`${endpoint} -> HTTP ${response.status}`);
  }

  if (failures.length > 0) {
    throw new Error(`API smoke checks failed:\n${failures.join("\n")}`);
  }
}

async function launchBrowser(): Promise<import("playwright").Browser> {
  const configuredChannel = process.env.SMOKE_BROWSER_CHANNEL;
  const attempts = configuredChannel ? [{ channel: configuredChannel }] : [{ channel: "chrome" }, { channel: "msedge" }, {}];
  const errors: string[] = [];

  for (const attempt of attempts) {
    try {
      return await chromium.launch({ ...attempt, headless: true });
    } catch (error) {
      errors.push(`${attempt.channel ?? "bundled chromium"}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(
    "Browser smoke could not launch a browser. Install Chrome/Edge, set SMOKE_BROWSER_CHANNEL, " +
    "or run `pnpm exec playwright install chromium`.\n" +
    errors.join("\n")
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
