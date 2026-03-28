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
  const [agent, setAgent] = useState<Agent | null>(null);
  const [events, setEvents] = useState<AgentEvent[]>([]);

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

      const { data: ag } = await supabase
        .from("agents")
        .select("*")
        .eq("workspace_id", ws.id)
        .single();

      if (!ag) { router.push("/agent"); return; }

      setAgent(ag);

      const { data: evs } = await supabase
        .from("events")
        .select("*")
        .eq("agent_id", ag.id)
        .order("created_at", { ascending: false })
        .limit(50);

      setEvents(evs ?? []);
      setLoading(false);
    }

    load();
  }, [router]);

  if (loading) return <FullPageLoader />;

  return (
    <DashboardLayout>
      <LiveRoom agent={agent!} initialEvents={events} />
    </DashboardLayout>
  );
}
