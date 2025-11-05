import { mkdir, stat, writeFile } from "fs/promises";
import { appendFileSync } from "node:fs";
import path from "node:path";

type LogType = "chat" | "events";

const LOGS_ROOT = process.env.LOGS_ROOT ?? path.join(process.cwd(), "logs");

const ensureDirCache = new Set<string>();

async function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (ensureDirCache.has(dir)) return;
  try {
    await stat(dir);
  } catch {
    await mkdir(dir, { recursive: true });
  }
  ensureDirCache.add(dir);
}

function getFilePath(type: LogType, date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const dir = path.join(LOGS_ROOT, String(year), month);
  return path.join(dir, `${type}-${year}-${month}-${day}.csv`);
}

function toCsvValue(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value).replace(/"/g, '""');
  return `"${text}"`;
}

function composeLine(values: Array<string | number | boolean | null | undefined>) {
  return values.map(toCsvValue).join(",") + "\n";
}

export async function appendChatLog(args: {
  timestamp: string;
  clientId: string;
  direction: "user" | "agent";
  message: string;
  latencyMs?: number;
  status: "ok" | "error" | "fallback";
  meta?: Record<string, unknown>;
}) {
  const filePath = getFilePath("chat", new Date(args.timestamp));
  await ensureDir(filePath);
  const line = composeLine([
    args.timestamp,
    args.clientId,
    args.direction,
    args.message,
    args.latencyMs ?? "",
    args.status,
    args.meta ? JSON.stringify(args.meta) : "",
  ]);
  appendFileSync(filePath, line, { encoding: "utf-8" });
}

export async function appendEventLog(args: {
  timestamp: string;
  clientId?: string;
  sessionId?: string;
  event: string;
  payload?: Record<string, unknown>;
}) {
  const filePath = getFilePath("events", new Date(args.timestamp));
  await ensureDir(filePath);
  const line = composeLine([
    args.timestamp,
    args.clientId ?? "",
    args.sessionId ?? "",
    args.event,
    args.payload ? JSON.stringify(args.payload) : "",
  ]);
  appendFileSync(filePath, line, { encoding: "utf-8" });
}

export async function writeHealthCheck() {
  const filePath = path.join(LOGS_ROOT, "healthcheck.txt");
  await ensureDir(filePath);
  await writeFile(filePath, `last access: ${new Date().toISOString()}`);
}

