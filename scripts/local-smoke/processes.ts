import { spawn, type ChildProcess } from "node:child_process";
import { appendFile, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";

import { dataDir, pnpmCommand, pnpmPrefixArgs, rootDir, serviceEnv, tmpDir } from "./config";

export type ManagedProcess = {
  name: string;
  process: ChildProcess;
  logPath: string;
};

const services: ManagedProcess[] = [];
let stoppingServices = false;

export async function prepareSmokeWorkspace(): Promise<void> {
  await mkdir(tmpDir, { recursive: true });
  await mkdir(dataDir, { recursive: true });
  await cleanupDefaultSmokeArtifacts();
}

export async function runPnpm(args: string[], label: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(pnpmCommand, [...pnpmPrefixArgs, ...args], {
      cwd: rootDir,
      env: serviceEnv,
      shell: false,
      stdio: "pipe"
    });
    let output = "";

    child.stdout?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${label} failed with exit code ${code ?? "unknown"}.\n${output}`));
    });
  });
}

export function startService(name: string, args: string[]): ManagedProcess {
  const logPath = path.join(tmpDir, `local-smoke-${name}.log`);
  const child = spawn(pnpmCommand, [...pnpmPrefixArgs, ...args], {
    cwd: rootDir,
    env: serviceEnv,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"]
  });

  const chunks: string[] = [];
  const append = (chunk: Buffer) => {
    chunks.push(chunk.toString());
    void appendFile(logPath, chunk);
  };

  child.stdout?.on("data", append);
  child.stderr?.on("data", append);
  child.on("exit", (code) => {
    if (!stoppingServices && code && code !== 0) {
      console.error(`${name} exited with code ${code}. Log: ${chunks.join("").slice(-2000)}`);
    }
  });

  const managed = { name, process: child, logPath };
  services.push(managed);
  return managed;
}

export async function stopServices(): Promise<void> {
  stoppingServices = true;
  await Promise.all(services.map((service) => stopProcessTree(service.process)));
}

export async function serviceLogSummary(): Promise<string> {
  const summaries = await Promise.all(
    services.map(async (service) => {
      try {
        const log = await readFile(service.logPath, "utf8");
        return `--- ${service.name} ---\n${log.slice(-2000)}`;
      } catch {
        return `--- ${service.name} ---\n(no log)`;
      }
    })
  );
  return summaries.join("\n");
}

export async function cleanupDefaultSmokeArtifacts(): Promise<void> {
  if (process.env.SMOKE_DATABASE_URL || process.env.SMOKE_KEEP_DATA) return;

  await rm(path.join(dataDir, "local-smoke.sqlite"), { force: true });
  await rm(path.join(dataDir, "local-smoke.sqlite-shm"), { force: true });
  await rm(path.join(dataDir, "local-smoke.sqlite-wal"), { force: true });
  await rm(path.join(dataDir, "local-smoke-files"), { force: true, recursive: true });
  await rm(path.join(tmpDir, "local-smoke-api.log"), { force: true });
  await rm(path.join(tmpDir, "local-smoke-web.log"), { force: true });
  await rm(path.join(tmpDir, "local-smoke-worker.log"), { force: true });
}

async function stopProcessTree(child: ChildProcess): Promise<void> {
  if (!child.pid || child.exitCode !== null) return;

  if (process.platform === "win32") {
    await new Promise<void>((resolve) => {
      const killer = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      killer.on("exit", () => resolve());
      killer.on("error", () => resolve());
    });
    return;
  }

  child.kill("SIGTERM");
  await sleep(500);
  if (child.exitCode === null) child.kill("SIGKILL");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
