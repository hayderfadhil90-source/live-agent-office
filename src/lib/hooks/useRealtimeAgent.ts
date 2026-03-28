"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Agent, AgentEvent } from "@/lib/types";

interface UseRealtimeAgentReturn {
  agent: Agent | null;
  events: AgentEvent[];
  isConnected: boolean;
}

export function useRealtimeAgent(
  agentId: string | null,
  initialAgent: Agent | null,
  initialEvents: AgentEvent[]
): UseRealtimeAgentReturn {
  const [agent, setAgent] = useState<Agent | null>(initialAgent);
  const [events, setEvents] = useState<AgentEvent[]>(initialEvents);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!agentId) return;

    const supabase = createClient();

    // Subscribe to agent row changes (status updates)
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
          setEvents((prev) => [payload.new as AgentEvent, ...prev].slice(0, 50));
        }
      )
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(agentChannel);
    };
  }, [agentId]);

  return { agent, events, isConnected };
}
