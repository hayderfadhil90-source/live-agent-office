import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { IncomingEvent, AgentStatus } from "@/lib/types";

// ─── POST /api/events ─────────────────────────────────────────────────────────
// Accepts events from external bots/agents.
// Auth: Bearer token in Authorization header (matches webhook_tokens.token)
//
// Body: { agentId, event, status?, message?, timestamp?, metadata? }
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Auth — extract Bearer token
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;

  if (!token) {
    return NextResponse.json(
      { error: "Missing Authorization header" },
      { status: 401 }
    );
  }

  // 2. Parse body
  let body: Partial<IncomingEvent>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { agentId, event, status, message, metadata } = body;

  if (!agentId || !event) {
    return NextResponse.json(
      { error: "agentId and event are required" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // 3. Validate token → workspace → agent
  const { data: tokenRow, error: tokenErr } = await supabase
    .from("webhook_tokens")
    .select("workspace_id")
    .eq("token", token)
    .single();

  if (tokenErr || !tokenRow) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const { data: agent, error: agentErr } = await supabase
    .from("agents")
    .select("id, workspace_id, status")
    .eq("id", agentId)
    .single();

  if (agentErr || !agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  if (agent.workspace_id !== tokenRow.workspace_id) {
    return NextResponse.json(
      { error: "Agent does not belong to this workspace" },
      { status: 403 }
    );
  }

  // 4. Determine new agent status
  const VALID_STATUSES: AgentStatus[] = ["idle", "working", "replying", "error"];
  const newStatus: AgentStatus =
    status && VALID_STATUSES.includes(status as AgentStatus)
      ? (status as AgentStatus)
      : deriveStatus(event);

  // 5. Store event
  const { error: insertErr } = await supabase.from("events").insert({
    agent_id: agentId,
    event_type: event,
    status: newStatus,
    message: message ?? null,
    metadata: metadata ?? null,
  });

  if (insertErr) {
    console.error("[events] insert error:", insertErr);
    return NextResponse.json({ error: "Failed to store event" }, { status: 500 });
  }

  // 6. Update agent status + updated_at
  const { error: updateErr } = await supabase
    .from("agents")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", agentId);

  if (updateErr) {
    console.error("[events] agent update error:", updateErr);
    // Non-fatal — event was stored
  }

  // Supabase Realtime will broadcast the DB changes to subscribed frontend clients.
  // No manual socket push needed for MVP — Supabase handles this via postgres_changes.

  return NextResponse.json(
    { ok: true, agentId, status: newStatus, event },
    { status: 200 }
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function deriveStatus(eventType: string): AgentStatus {
  const map: Record<string, AgentStatus> = {
    message_received: "working",
    thinking_started: "working",
    reply_sent: "replying",
    task_started: "working",
    task_completed: "idle",
    error_happened: "error",
    status_changed: "idle",
  };
  return map[eventType] ?? "idle";
}

// Health check
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "POST /api/events" });
}
