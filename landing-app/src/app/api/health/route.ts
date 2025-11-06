import { NextResponse } from "next/server";
import { writeHealthCheck } from "@/lib/log-service";

export async function GET() {
  try {
    // Не блокируем ответ /api/health из‑за ошибок файловой системы
  await writeHealthCheck();
  } catch (error) {
    console.warn("[health] writeHealthCheck failed:", error instanceof Error ? error.message : String(error));
  }
  return NextResponse.json({ status: "ok", timestamp: new Date().toISOString() });
}

