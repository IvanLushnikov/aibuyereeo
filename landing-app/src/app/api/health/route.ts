import { NextResponse } from "next/server";
import { writeHealthCheck } from "@/lib/log-service";

export async function GET() {
  await writeHealthCheck();
  return NextResponse.json({ status: "ok", timestamp: new Date().toISOString() });
}

