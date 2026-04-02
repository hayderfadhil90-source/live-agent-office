"use client";

import { useEffect, useState } from "react";
import { useRealtimeAgent } from "@/lib/hooks/useRealtimeAgent";
import { getAgentHealth } from "@/lib/agent-health";
import { PhaserRoom } from "@/components/room/PhaserRoom";
import { AgentPanel } from "@/components/room/AgentPanel";
import type { Agent, AgentEvent } from "@/lib/types";

interface Props {
  agent: Agent;
  initialEvents: AgentEvent[];
}

export function LiveRoom({ agent: initialAgent, initialEvents }: Props) {
  const { agent, events, todayCounts, isConnected } = useRealtimeAgent(
    initialAgent.id,
    initialAgent,
    initialEvents
  );

  const currentAgent = agent ?? initialAgent;

  // Re-derive health every 30s so the Phaser badge stays in sync
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const health = getAgentHealth(currentAgent, events);

  return (
    <div className="flex gap-0 h-[calc(100vh-4rem)] -mx-8 -mt-8">
      {/* Phaser room */}
      <div className="flex-1 relative overflow-hidden bg-surface-900">
        <PhaserRoom agent={currentAgent} health={health.health} />

        {/* Connection indicator */}
        <div className="absolute top-3 left-3 z-10">
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium backdrop-blur-sm ${
              isConnected
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20"
                : "bg-surface-800/80 text-surface-200/40 border border-surface-200/10"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isConnected ? "bg-emerald-400 animate-pulse" : "bg-surface-200/30"
              }`}
            />
            {isConnected ? "Live" : "Connecting..."}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <AgentPanel agent={currentAgent} events={events} todayCounts={todayCounts} />
    </div>
  );
}
