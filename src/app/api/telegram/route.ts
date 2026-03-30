import { NextRequest, NextResponse } from "next/server";

// ─── POST /api/telegram ───────────────────────────────────────────────────────
// Receives Telegram webhook updates for the connected bot.
// When a user sends a message → fires message_received event automatically.
//
// Setup steps:
//   1. Add these env vars in Vercel: WEBHOOK_TOKEN, TELEGRAM_AGENT_ID
//   2. Run this command to register the webhook with Telegram:
//      curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://live-agent-office.vercel.app/api/telegram"
//
// Note: Telegram only sends webhook updates for INCOMING user messages.
//       Bot replies going back to users don't trigger webhooks.
//       The auto-idle cron (/api/cron/auto-idle) resets status to idle
//       after 2 minutes of no activity.
// ─────────────────────────────────────────────────────────────────────────────

const EVENTS_URL = "https://live-agent-office.vercel.app/api/events";
const WEBHOOK_TOKEN = process.env.WEBHOOK_TOKEN ?? "";
const AGENT_ID = process.env.TELEGRAM_AGENT_ID ?? "";

async function fireEvent(event: string, message?: string) {
  if (!WEBHOOK_TOKEN || !AGENT_ID) {
    console.warn("[telegram] WEBHOOK_TOKEN or TELEGRAM_AGENT_ID not configured");
    return;
  }
  await fetch(EVENTS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${WEBHOOK_TOKEN}`,
    },
    body: JSON.stringify({
      agentId: AGENT_ID,
      event,
      message: message ?? null,
    }),
  });
}

export async function POST(req: NextRequest) {
  let update: TelegramUpdate;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const msg = update.message ?? update.edited_message;
  if (!msg) {
    return NextResponse.json({ ok: true }); // Non-message update — ignore
  }

  // Skip bot messages (shouldn't happen via webhook, but just in case)
  if (msg.from?.is_bot) {
    return NextResponse.json({ ok: true });
  }

  const text = msg.text ?? msg.caption ?? "";

  // User sent a message → agent starts working
  await fireEvent("message_received", text.slice(0, 200) || undefined);

  return NextResponse.json({ ok: true });
}

// Health check
export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "POST /api/telegram",
    configured: !!(WEBHOOK_TOKEN && AGENT_ID),
    agentId: AGENT_ID || "(not set — add TELEGRAM_AGENT_ID env var)",
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
}

interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  date: number;
  text?: string;
  caption?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
}
