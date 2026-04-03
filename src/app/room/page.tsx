"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { LiveRoom } from "./LiveRoom";
import { FullPageLoader } from "@/components/ui/LoadingSpinner";
import type { Agent, AgentEvent } from "@/lib/types";

export default function RoomPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [eventsMap, setEventsMap] = useState<Record<string, AgentEvent[]>>({});

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: ws } = await supabase
        .from("workspaces")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (!ws) { router.push("/workspace"); return; }

      const { data: ags } = await supabase
        .from("agents")
        .select("*")
        .eq("workspace_id", ws.id)
        .order("created_at", { ascending: true });

      if (!ags || ags.length === 0) { router.push("/agent"); return; }

      const map: Record<string, AgentEvent[]> = {};
      for (const ag of ags) {
        const { data: evs } = await supabase
          .from("events")
          .select("*")
          .eq("agent_id", ag.id)
          .order("created_at", { ascending: false })
          .limit(50);
        map[ag.id] = evs ?? [];
      }

      setAgents(ags as Agent[]);
      setEventsMap(map);
      setLoading(false);
    }

    load();
  }, [router]);

  if (loading) return <FullPageLoader />;

  return (
    <DashboardLayout>
      <LiveRoom agents={agents} initialEventsMap={eventsMap} />
    </DashboardLayout>
  );
}
