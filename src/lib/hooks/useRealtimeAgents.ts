"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Agent, AgentEvent, EventType } from "@/lib/types";

export interface TodayCounts {
  total: number;
  tasksCompleted: number;
  repliesSent: number;
}

export interface AgentState {
  agent: Agent;
  events: AgentEvent[];
  todayCounts: TodayCounts;
}

const ZERO_COUNTS: TodayCounts = { total: 0, tasksCompleted: 0, repliesSent: 0 };

function tally(rows: { event_type: EventType }[]): TodayCounts {
  return rows.reduce(
    (acc, { event_type }) => ({
      total: acc.total + 1,
      tasksCompleted: acc.tasksCompleted + (event_type === "task_completed" ? 1 : 0),
      repliesSent: acc.repliesSent + (event_type === "reply_sent" ? 1 : 0),
    }),
    ZERO_COUNTS
  );
}

export function useRealtimeAgents(
  initialAgents: Agent[],
  initialEventsMap: Record<string, AgentEvent[]>
): {
  agentStates: AgentState[];
  isConnected: boolean;
} {
  const [agentMap, setAgentMap] = useState<Map<string, Agent>>(
    () => new Map(initialAgents.map((a) => [a.id, a]))
  );
  const [eventsMap, setEventsMap] = useState<Map<string, AgentEvent[]>>(
    () => new Map(Object.entries(initialEventsMap))
  );
  const [countsMap, setCountsMap] = useState<Map<string, TodayCounts>>(
    () => new Map(initialAgents.map((a) => [a.id, ZERO_COUNTS]))
  );
  const [isConnected, setIsConnected] = useState(false);

  // Fetch today's full counts once per agent on mount
  useEffect(() => {
    if (initialAgents.length === 0) return;
    const supabase = createClient();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    for (const ag of initialAgents) {
      supabase
        .from("events")
        .select("event_type")
        .eq("agent_id", ag.id)
        .gte("created_at", todayStart.toISOString())
        .then(({ data }) => {
          if (!data) return;
          setCountsMap((prev) => {
            const next = new Map(prev);
            next.set(ag.id, tally(data as { event_type: EventType }[]));
            return next;
          });
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Subscribe to realtime updates for each agent
  useEffect(() => {
    if (initialAgents.length === 0) return;
    const supabase = createClient();
    const channels: ReturnType<typeof supabase.channel>[] = [];

    for (const ag of initialAgents) {
      const ch = supabase
        .channel(`agents-fleet:${ag.id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "agents",
            filter: `id=eq.${ag.id}`,
          },
          (payload) => {
            setAgentMap((prev) => {
              const next = new Map(prev);
              next.set(ag.id, payload.new as Agent);
              return next;
            });
          }
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "events",
            filter: `agent_id=eq.${ag.id}`,
          },
          (payload) => {
            const newEvent = payload.new as AgentEvent;
            setEventsMap((prev) => {
              const next = new Map(prev);
              const existing = next.get(ag.id) ?? [];
              next.set(ag.id, [newEvent, ...existing].slice(0, 50));
              return next;
            });
            setCountsMap((prev) => {
              const next = new Map(prev);
              const c = next.get(ag.id) ?? ZERO_COUNTS;
              next.set(ag.id, {
                total: c.total + 1,
                tasksCompleted:
                  c.tasksCompleted +
                  (newEvent.event_type === "task_completed" ? 1 : 0),
                repliesSent:
                  c.repliesSent +
                  (newEvent.event_type === "reply_sent" ? 1 : 0),
              });
              return next;
            });
          }
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") setIsConnected(true);
        });

      channels.push(ch);
    }

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const agentStates: AgentState[] = initialAgents.map((a) => ({
    agent: agentMap.get(a.id) ?? a,
    events: eventsMap.get(a.id) ?? [],
    todayCounts: countsMap.get(a.id) ?? ZERO_COUNTS,
  }));

  return { agentStates, isConnected };
}
