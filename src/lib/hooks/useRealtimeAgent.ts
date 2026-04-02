"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Agent, AgentEvent, EventType } from "@/lib/types";

export interface TodayCounts {
  total: number;
  tasksCompleted: number;
  repliesSent: number;
}

interface UseRealtimeAgentReturn {
  agent: Agent | null;
  events: AgentEvent[];
  todayCounts: TodayCounts;
  isConnected: boolean;
}

const ZERO_COUNTS: TodayCounts = { total: 0, tasksCompleted: 0, repliesSent: 0 };

export function useRealtimeAgent(
  agentId: string | null,
  initialAgent: Agent | null,
  initialEvents: AgentEvent[]
): UseRealtimeAgentReturn {
  const [agent, setAgent] = useState<Agent | null>(initialAgent);
  const [events, setEvents] = useState<AgentEvent[]>(initialEvents);
  const [todayCounts, setTodayCounts] = useState<TodayCounts>(ZERO_COUNTS);
  const [isConnected, setIsConnected] = useState(false);

  // Fetch today's full event counts once on mount
  useEffect(() => {
    if (!agentId) return;
    const supabase = createClient();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    supabase
      .from("events")
      .select("event_type")
      .eq("agent_id", agentId)
      .gte("created_at", todayStart.toISOString())
      .then(({ data }) => {
        if (!data) return;
        setTodayCounts(tally(data as { event_type: EventType }[]));
      });
  }, [agentId]);

  useEffect(() => {
    if (!agentId) return;

    const supabase = createClient();

    const agentChannel = supabase
      .channel(`agent:${agentId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "agents",
          filter: `id=eq.${agentId}`,
        },
        (payload) => {
          setAgent(payload.new as Agent);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "events",
          filter: `agent_id=eq.${agentId}`,
        },
        (payload) => {
          const newEvent = payload.new as AgentEvent;

          // Prepend to in-memory log (capped at 50 for display)
          setEvents((prev) => [newEvent, ...prev].slice(0, 50));

          // Increment today's counts in real-time
          setTodayCounts((prev) => ({
            total: prev.total + 1,
            tasksCompleted:
              prev.tasksCompleted +
              (newEvent.event_type === "task_completed" ? 1 : 0),
            repliesSent:
              prev.repliesSent +
              (newEvent.event_type === "reply_sent" ? 1 : 0),
          }));
        }
      )
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(agentChannel);
    };
  }, [agentId]);

  return { agent, events, todayCounts, isConnected };
}

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
