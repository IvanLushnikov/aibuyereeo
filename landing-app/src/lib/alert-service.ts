type ChatAlertPayload = {
  title: string;
  message: string;
  clientId?: string;
  requestId?: string;
  context?: Record<string, unknown>;
};

const ALERT_WEBHOOK_URL = process.env.CHAT_ALERT_WEBHOOK_URL;

let alertWarningLogged = false;

export async function sendChatAlert(payload: ChatAlertPayload) {
  if (!ALERT_WEBHOOK_URL) {
    if (!alertWarningLogged) {
      console.warn("[Alert] CHAT_ALERT_WEBHOOK_URL is not configured. Alerts are disabled.");
      alertWarningLogged = true;
    }
    return;
  }

  try {
    const response = await fetch(ALERT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "chat_alert",
        timestamp: new Date().toISOString(),
        ...payload,
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error("[Alert] Failed to deliver alert", {
        status: response.status,
        body: text?.slice(0, 200),
      });
    }
  } catch (error) {
    console.error("[Alert] Error sending alert", error instanceof Error ? error.message : String(error));
  }
}


