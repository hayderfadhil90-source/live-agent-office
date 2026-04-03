import type { Agent, AgentEvent } from "@/lib/types/index";
import type { TodayCounts } from "@/lib/hooks/useRealtimeAgents";

// ─── Agent Health ─────────────────────────────────────────────────────────────
//
// Derived from: agent.status + agent.updated_at + recent events
// No API calls — computed entirely client-side on each render.
//
// Health states and what they mean to a founder watching the dashboard:
//   Healthy  → idle, was active recently (< 30 min)
//   Active   → currently working/replying, within normal time
//   Idle     → idle with no recent events (> 30 min)
//   Slow     → working 2–5 min without completing
//   Stuck    → working/error > 5 min — needs attention

export type AgentHealth = "healthy" | "active" | "idle" | "slow" | "stuck";

export interface HealthResult {
  health: AgentHealth;
  label: string;
  color: string;          // Tailwind text color class
  bgColor: string;        // Tailwind bg color class
  minutesInStatus: number;
}

export function getAgentHealth(
  agent: Agent,
  events: AgentEvent[]
): HealthResult {
  const now = Date.now();
  const statusSince = new Date(agent.updated_at).getTime();
  const minutesInStatus = Math.floor((now - statusSince) / 60_000);

  const lastEventTime = events[0]
    ? new Date(events[0].created_at).getTime()
    : 0;
  const minutesSinceLastEvent = Math.floor((now - lastEventTime) / 60_000);

  let health: AgentHealth;

  if (agent.status === "error") {
    health = "stuck";
  } else if (agent.status === "working" || agent.status === "replying") {
    if (minutesInStatus >= 5) health = "stuck";
    else if (minutesInStatus >= 2) health = "slow";
    else health = "active";
  } else {
    // idle
    health =
      lastEventTime === 0 || minutesSinceLastEvent > 30 ? "idle" : "healthy";
  }

  return { health, minutesInStatus, ...HEALTH_META[health] };
}

const HEALTH_META: Record<
  AgentHealth,
  { label: string; color: string; bgColor: string }
> = {
  healthy: {
    label: "Healthy",
    color: "text-emerald-400",
    bgColor: "bg-emerald-400/10",
  },
  active: {
    label: "Active",
    color: "text-brand-400",
    bgColor: "bg-brand-400/10",
  },
  idle: {
    label: "Idle",
    color: "text-surface-200/40",
    bgColor: "bg-surface-200/5",
  },
  slow: {
    label: "Slow",
    color: "text-amber-400",
    bgColor: "bg-amber-400/10",
  },
  stuck: {
    label: "Stuck",
    color: "text-red-400",
    bgColor: "bg-red-400/10",
  },
};

// ─── Activity Score ───────────────────────────────────────────────────────────
//
// A single 0–100 number answering: "How productive was this agent today?"
//
// Formula (explainable, no magic):
//   task_completed × 15  (capped at 45)
//   reply_sent     × 10  (capped at 30)
//   other events   ×  1  (capped at 15)
//   stuck penalty        (-10 if currently stuck)
//
// The score is clamped to [0, 100].

export interface ScoreResult {
  score: number;
  tasksCompleted: number;
  repliesSent: number;
  otherEvents: number;
}

export function getActivityScore(
  agent: Agent,
  events: AgentEvent[],
  todayCounts?: TodayCounts
): ScoreResult {
  let tasksCompleted: number;
  let repliesSent: number;
  let otherEvents: number;

  if (todayCounts) {
    // Use full-day counts from DB query (accurate)
    tasksCompleted = todayCounts.tasksCompleted;
    repliesSent = todayCounts.repliesSent;
    otherEvents = todayCounts.total - tasksCompleted - repliesSent;
  } else {
    // Fallback: count from in-memory events (last 50 only)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEvents = events.filter(
      (e) => new Date(e.created_at) >= todayStart
    );
    tasksCompleted = todayEvents.filter(
      (e) => e.event_type === "task_completed"
    ).length;
    repliesSent = todayEvents.filter(
      (e) => e.event_type === "reply_sent"
    ).length;
    otherEvents = todayEvents.filter(
      (e) => e.event_type !== "task_completed" && e.event_type !== "reply_sent"
    ).length;
  }

  const { health } = getAgentHealth(agent, events);
  const stuckPenalty = health === "stuck" ? 10 : 0;

  const raw =
    Math.min(tasksCompleted * 15, 45) +
    Math.min(repliesSent * 10, 30) +
    Math.min(otherEvents * 1, 15) -
    stuckPenalty;

  return {
    score: Math.max(0, Math.min(100, raw)),
    tasksCompleted,
    repliesSent,
    otherEvents,
  };
}

// ─── Response Time ────────────────────────────────────────────────────────────
//
// Average time between message_received → reply_sent pairs in the event log.
// Events are newest-first, so we reverse to walk chronologically.
// Returns null if no complete pairs exist.

export interface ResponseTimeResult {
  avgSeconds: number;       // average seconds per reply
  samples: number;          // how many message→reply pairs were found
  label: string;            // human-readable: "12s", "1m 4s", "—"
}

export function getResponseTime(events: AgentEvent[]): ResponseTimeResult {
  // Walk events oldest-first
  const chronological = [...events].reverse();

  const diffs: number[] = [];
  let pendingStartAt: number | null = null;

  for (const e of chronological) {
    // Accept either message_received or thinking_started as the start of a cycle
    if (
      e.event_type === "message_received" ||
      e.event_type === "thinking_started"
    ) {
      pendingStartAt = new Date(e.created_at).getTime();
    } else if (
      (e.event_type === "reply_sent" || e.event_type === "task_completed") &&
      pendingStartAt !== null
    ) {
      const diff = (new Date(e.created_at).getTime() - pendingStartAt) / 1000;
      if (diff > 0) diffs.push(diff);
      pendingStartAt = null;
    }
  }

  if (diffs.length === 0) {
    return { avgSeconds: 0, samples: 0, label: "—" };
  }

  const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  return {
    avgSeconds: Math.round(avg),
    samples: diffs.length,
    label: formatSeconds(Math.round(avg)),
  };
}

function formatSeconds(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}
