import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ─── GET /api/cron/auto-idle ──────────────────────────────────────────────────
// Called by Vercel Cron every minute.
// If an agent has been in "working" or "replying" status for more than 2 minutes
// with no new event, it automatically resets to "idle".
// This acts as a reliable fallback when reply_sent / task_completed never fires.
// ─────────────────────────────────────────────────────────────────────────────

const STALE_MINUTES = 2;

export async function GET(req: NextRequest) {
  // Verify cron secret so this endpoint isn't callable publicly
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const staleThreshold = new Date(Date.now() - STALE_MINUTES * 60 * 1000).toISOString();

  // Find agents stuck in working/replying with no recent update
  const { data: staleAgents, error } = await supabase
    .from("agents")
    .select("id, status, updated_at")
    .in("status", ["working", "replying"])
    .lt("updated_at", staleThreshold);

  if (error) {
    console.error("[auto-idle] query error:", error);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  if (!staleAgents?.length) {
    return NextResponse.json({ ok: true, reset: 0 });
  }

  const ids = staleAgents.map((a) => a.id);

  // Reset to idle
  const { error: updateErr } = await supabase
    .from("agents")
    .update({ status: "idle", updated_at: new Date().toISOString() })
    .in("id", ids);

  if (updateErr) {
    console.error("[auto-idle] update error:", updateErr);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  // Log events for audit trail
  const eventsToInsert = ids.map((id) => ({
    agent_id: id,
    event_type: "task_completed" as const,
    status: "idle" as const,
    message: "Auto-reset to idle (no activity for 2 minutes)",
    metadata: { source: "auto-idle-cron" },
  }));

  await supabase.from("events").insert(eventsToInsert);

  console.log(`[auto-idle] reset ${ids.length} agent(s) to idle:`, ids);
  return NextResponse.json({ ok: true, reset: ids.length, agents: ids });
}
