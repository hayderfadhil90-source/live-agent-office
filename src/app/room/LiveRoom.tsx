"use client";

import { useEffect, useState, useMemo } from "react";
import { useRealtimeAgents } from "@/lib/hooks/useRealtimeAgents";
import { getAgentHealth } from "@/lib/agent-health";
import { PhaserRoom } from "@/components/room/PhaserRoom";
import { AgentPanel } from "@/components/room/AgentPanel";
import type { Agent, AgentEvent } from "@/lib/types";

interface Props {
  agents: Agent[];
  initialEventsMap: Record<string, AgentEvent[]>;
}

export function LiveRoom({ agents: initialAgents, initialEventsMap }: Props) {
  const { agentStates, isConnected } = useRealtimeAgents(initialAgents, initialEventsMap);

  // Re-derive health every 30s so Phaser badges stay in sync
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const currentAgents = agentStates.map((s) => s.agent);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const healthMap = useMemo(
    () =>
      Object.fromEntries(
        agentStates.map(({ agent, events }) => [
          agent.id,
          getAgentHealth(agent, events).health,
        ])
      ),
    [agentStates, tick]
  );

  return (
    <div className="flex gap-0 h-[calc(100vh-4rem)] -mx-8 -mt-8">
      {/* Phaser room */}
      <div className="flex-1 relative overflow-hidden bg-surface-900">
        <PhaserRoom agents={currentAgents} healthMap={healthMap} />

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

        {/* Agent count badge */}
        {currentAgents.length > 1 && (
          <div className="absolute top-3 right-3 z-10">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-surface-800/80 text-surface-200/40 border border-surface-200/10 backdrop-blur-sm">
              {currentAgents.length} agents
            </div>
          </div>
        )}
      </div>

      {/* Right panel */}
      <AgentPanel agentStates={agentStates} />
    </div>
  );
}
