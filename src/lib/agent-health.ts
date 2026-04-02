import type { Agent, AgentEvent } from "@/lib/types/index";

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
  events: AgentEvent[]
): ScoreResult {
  // Only count today's events
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayEvents = events.filter(
    (e) => new Date(e.created_at) >= todayStart
  );

  const tasksCompleted = todayEvents.filter(
    (e) => e.event_type === "task_completed"
  ).length;

  const repliesSent = todayEvents.filter(
    (e) => e.event_type === "reply_sent"
  ).length;

  const otherEvents = todayEvents.filter(
    (e) => e.event_type !== "task_completed" && e.event_type !== "reply_sent"
  ).length;

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
