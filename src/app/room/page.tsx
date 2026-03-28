import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { LiveRoom } from "./LiveRoom";
import type { Agent, AgentEvent } from "@/lib/types";

export default async function RoomPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!workspace) redirect("/workspace");

  const { data: agent } = await supabase
    .from("agents")
    .select("*")
    .eq("workspace_id", workspace.id)
    .single();

  if (!agent) redirect("/agent");

  // Fetch recent events (last 50)
  const { data: events } = await supabase
    .from("events")
    .select("*")
    .eq("agent_id", agent.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <DashboardLayout>
      <LiveRoom
        agent={agent as Agent}
        initialEvents={(events ?? []) as AgentEvent[]}
      />
    </DashboardLayout>
  );
}
