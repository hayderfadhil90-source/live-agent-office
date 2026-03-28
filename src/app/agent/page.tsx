import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { AgentSetup } from "./AgentSetup";
import type { Agent, Workspace, WebhookToken } from "@/lib/types";

export default async function AgentPage() {
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

  const { data: tokenRow } = await supabase
    .from("webhook_tokens")
    .select("*")
    .eq("workspace_id", workspace.id)
    .single();

  return (
    <DashboardLayout>
      <AgentSetup
        workspace={workspace as Workspace}
        agent={agent as Agent | null}
        token={tokenRow as WebhookToken | null}
      />
    </DashboardLayout>
  );
}
