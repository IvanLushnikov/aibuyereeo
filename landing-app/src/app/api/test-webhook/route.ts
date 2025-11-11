import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const testMessage = body?.message || "тестовое сообщение";
    
    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    const secret = process.env.N8N_SECRET;

    if (!webhookUrl) {
      return NextResponse.json(
        {
          error: "N8N_WEBHOOK_URL не настроен",
          webhookUrl: null,
          hasSecret: !!secret,
        },
        { status: 500 }
      );
    }

    // Валидация URL
    let isValidUrl = false;
    try {
      new URL(webhookUrl);
      isValidUrl = true;
    } catch {
      return NextResponse.json(
        {
          error: "Некорректный N8N_WEBHOOK_URL",
          webhookUrl: webhookUrl.replace(/\/[^\/]*$/, '/***'),
          hasSecret: !!secret,
        },
        { status: 500 }
      );
    }

    const testPayload = {
      clientId: "test-client-" + Date.now(),
      message: testMessage,
      history: [],
      meta: { source: "test", isInitial: false },
      receivedAt: new Date().toISOString(),
    };

    const startedAt = Date.now();
    const timeoutMs = 30000; // 30 секунд для теста

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(secret ? { "x-n8n-secret": secret } : {}),
        },
        body: JSON.stringify(testPayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startedAt;

      const responseText = await response.text();
      let responseData;
      
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = { _rawText: responseText.slice(0, 500) };
      }

      return NextResponse.json(
        {
          success: response.ok,
          status: response.status,
          statusText: response.statusText,
          latencyMs,
          webhookUrl: webhookUrl.replace(/\/[^\/]*$/, '/***'),
          hasSecret: !!secret,
          response: responseData,
          headers: Object.fromEntries(response.headers.entries()),
        },
        { status: 200 }
      );
    } catch (error) {
      const latencyMs = Date.now() - startedAt;
      const isAbortError = error instanceof Error && error.name === "AbortError";
      
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : String(error),
          isAbortError,
          isTimeout: isAbortError,
          latencyMs,
          webhookUrl: webhookUrl.replace(/\/[^\/]*$/, '/***'),
          hasSecret: !!secret,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 400 }
    );
  }
}

export async function GET() {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  const secret = process.env.N8N_SECRET;
  
  let isValidUrl = false;
  let urlError = null;
  
  if (webhookUrl) {
    try {
      new URL(webhookUrl);
      isValidUrl = true;
    } catch (e) {
      urlError = e instanceof Error ? e.message : String(e);
    }
  }

  return NextResponse.json({
    hasWebhookUrl: !!webhookUrl,
    hasSecret: !!secret,
    isValidUrl,
    urlError,
    webhookUrl: webhookUrl ? webhookUrl.replace(/\/[^\/]*$/, '/***') : null,
    env: {
      CHAT_TIMEOUT_MS: process.env.CHAT_TIMEOUT_MS || "25000 (default)",
      RATE_LIMIT_WINDOW_SEC: process.env.RATE_LIMIT_WINDOW_SEC || "3600 (default)",
      RATE_LIMIT_MAX_REQUESTS: process.env.RATE_LIMIT_MAX_REQUESTS || "20 (default)",
    },
  });
}


