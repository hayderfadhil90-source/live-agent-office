"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  MessageSquare,
  Zap,
  CheckCircle,
  XCircle,
  RefreshCw,
  Bot,
  Activity,
  Clock,
} from "lucide-react";
import { AvatarCircle } from "@/components/ui/AvatarCircle";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getAgentHealth, getActivityScore, getResponseTime } from "@/lib/agent-health";
import type { AgentState } from "@/lib/hooks/useRealtimeAgents";
import type { Agent, AgentEvent, EventType } from "@/lib/types";

interface Props {
  agentStates: AgentState[];
}

const EVENT_ICON: Record<EventType, React.ReactNode> = {
  message_received: <MessageSquare className="w-3.5 h-3.5 text-blue-400" />,
  thinking_started: <RefreshCw className="w-3.5 h-3.5 text-amber-400" />,
  reply_sent: <Zap className="w-3.5 h-3.5 text-brand-500" />,
  task_started: <Activity className="w-3.5 h-3.5 text-amber-400" />,
  task_completed: <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />,
  error_happened: <XCircle className="w-3.5 h-3.5 text-red-400" />,
  status_changed: <RefreshCw className="w-3.5 h-3.5 text-surface-200/50" />,
};

const EVENT_LABEL: Record<EventType, string> = {
  message_received: "Message received",
  thinking_started: "Thinking...",
  reply_sent: "Reply sent",
  task_started: "Task started",
  task_completed: "Task completed",
  error_happened: "Error occurred",
  status_changed: "Status changed",
};

export function AgentPanel({ agentStates }: Props) {
  const [selectedId, setSelectedId] = useState<string>(agentStates[0]?.agent.id ?? "");

  // Keep selectedId in sync if agents change
  useEffect(() => {
    if (!agentStates.find((s) => s.agent.id === selectedId) && agentStates.length > 0) {
      setSelectedId(agentStates[0].agent.id);
    }
  }, [agentStates, selectedId]);

  const selected = agentStates.find((s) => s.agent.id === selectedId) ?? agentStates[0];
  if (!selected) return null;

  const { agent, events, todayCounts } = selected;

  return (
    <aside className="w-72 flex-shrink-0 border-l border-surface-200/10 bg-surface-900 flex flex-col overflow-hidden">
      {/* Fleet switcher — only shown when 2+ agents */}
      {agentStates.length > 1 && (
        <div className="px-3 pt-3 pb-2 border-b border-surface-200/10 flex gap-1.5 flex-wrap">
          {agentStates.map(({ agent: ag }) => {
            const h = getAgentHealth(ag, agentStates.find(s => s.agent.id === ag.id)?.events ?? []);
            return (
              <button
                key={ag.id}
                onClick={() => setSelectedId(ag.id)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-colors ${
                  selectedId === ag.id
                    ? "bg-brand-500/15 text-brand-400 border border-brand-500/20"
                    : "text-surface-200/40 hover:text-surface-200/60 border border-transparent"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  ag.status === "working" || ag.status === "replying"
                    ? "bg-amber-400"
                    : ag.status === "error"
                    ? "bg-red-400"
                    : "bg-emerald-400/60"
                }`} />
                {ag.name}
                <span className={`text-xs ${h.color} opacity-70`}>{h.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Selected agent info */}
      <AgentDetail agent={agent} events={events} todayCounts={todayCounts} />
    </aside>
  );
}

function AgentDetail({ agent, events, todayCounts }: { agent: Agent; events: AgentEvent[]; todayCounts: import("@/lib/hooks/useRealtimeAgents").TodayCounts }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const health = getAgentHealth(agent, events);
  const score = getActivityScore(agent, events, todayCounts);
  const responseTime = getResponseTime(events);
  const isActiveStatus = agent.status === "working" || agent.status === "replying";

  return (
    <>
      {/* Agent info */}
      <div className="p-5 border-b border-surface-200/10">
        <div className="flex items-center gap-3 mb-4">
          <AvatarCircle name={agent.name} style={agent.avatar_style} size="md" />
          <div>
            <p className="font-semibold text-sm">{agent.name}</p>
            <p className="text-xs text-surface-200/40 capitalize">{agent.role}</p>
          </div>
        </div>

        {/* Status row */}
        <div className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-surface-800">
          <span className="text-xs text-surface-200/50">Current status</span>
          <StatusBadge status={agent.status} />
        </div>

        {/* Health + live timer */}
        <div className="mt-2 flex items-center justify-between py-2.5 px-3 rounded-lg bg-surface-800">
          <span className="text-xs text-surface-200/50">Health</span>
          <div className="flex items-center gap-1.5">
            {isActiveStatus && health.minutesInStatus > 0 && (
              <span className="text-xs text-surface-200/35 flex items-center gap-0.5">
                <Clock className="w-3 h-3" />
                {health.minutesInStatus}m
              </span>
            )}
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${health.color} ${health.bgColor}`}
            >
              {health.label}
            </span>
          </div>
        </div>

        {/* Activity score */}
        <div className="mt-2 px-3 py-2.5 rounded-lg bg-surface-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-surface-200/50">Activity score</span>
            <span className="text-sm font-bold text-surface-50">
              {score.score}
              <span className="text-xs font-normal text-surface-200/30">/100</span>
            </span>
          </div>
          <div className="h-1 rounded-full bg-surface-700 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${score.score}%`,
                backgroundColor: scoreColor(score.score),
              }}
            />
          </div>
          <div className="mt-2 flex gap-3 text-xs text-surface-200/35">
            <span>{score.tasksCompleted} tasks</span>
            <span>{score.repliesSent} replies</span>
            <span>{score.otherEvents} events</span>
          </div>
        </div>

        {/* Meta */}
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-surface-200/40">Events today</span>
            <span className="text-xs text-surface-200/60">{todayCounts.total || events.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-surface-200/40">Avg reply time</span>
            <span className={`text-xs font-medium ${
              responseTime.samples === 0
                ? "text-surface-200/30"
                : responseTime.avgSeconds > 120
                ? "text-amber-400"
                : "text-emerald-400"
            }`}>
              {responseTime.label}
              {responseTime.samples > 0 && (
                <span className="text-surface-200/25 font-normal ml-1">
                  ({responseTime.samples} samples)
                </span>
              )}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-surface-200/40">Last active</span>
            <span className="text-xs text-surface-200/60">
              {events[0]
                ? formatDistanceToNow(new Date(events[0].created_at), { addSuffix: true })
                : "Never"}
            </span>
          </div>
        </div>
      </div>

      {/* Event log */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-200/5">
          <Bot className="w-3.5 h-3.5 text-surface-200/30" />
          <h3 className="text-xs font-semibold text-surface-200/50 uppercase tracking-wide">
            Event log
          </h3>
        </div>

        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center px-4">
            <p className="text-xs text-surface-200/30">No events yet</p>
            <p className="text-xs text-surface-200/20 mt-1">
              Send a webhook to see live activity
            </p>
          </div>
        ) : (
          <div className="divide-y divide-surface-200/5">
            {events.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function scoreColor(score: number): string {
  if (score >= 70) return "#34d399";
  if (score >= 40) return "#fbbf24";
  return "#f87171";
}

function EventRow({ event }: { event: AgentEvent }) {
  const icon = EVENT_ICON[event.event_type] ?? (
    <Zap className="w-3.5 h-3.5 text-surface-200/40" />
  );
  const label = EVENT_LABEL[event.event_type] ?? event.event_type;

  return (
    <div className="px-4 py-3 flex items-start gap-2.5 animate-fade-in hover:bg-surface-200/5 transition-colors">
      <div className="mt-0.5 flex-shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-surface-50/80 truncate">{label}</p>
        {event.message && (
          <p className="text-xs text-surface-200/40 mt-0.5 line-clamp-2 leading-relaxed">
            {event.message}
          </p>
        )}
        <p className="text-xs text-surface-200/25 mt-1">
          {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
        </p>
      </div>
    </div>
  );
}
