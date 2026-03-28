import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { WorkspaceSetup } from "./WorkspaceSetup";
import type { Workspace, Agent } from "@/lib/types";

export default async function WorkspacePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch existing workspace
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("*")
    .eq("user_id", user.id)
    .single();

  // If workspace exists, also fetch the agent
  let agent: Agent | null = null;
  if (workspace) {
    const { data } = await supabase
      .from("agents")
      .select("*")
      .eq("workspace_id", workspace.id)
      .single();
    agent = data;
  }

  return (
    <DashboardLayout>
      <WorkspaceSetup
        userId={user.id}
        workspace={workspace as Workspace | null}
        agent={agent}
      />
    </DashboardLayout>
  );
}
