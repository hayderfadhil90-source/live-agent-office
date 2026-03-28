"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { AgentSetup } from "./AgentSetup";
import { FullPageLoader } from "@/components/ui/LoadingSpinner";
import type { Agent, Workspace, WebhookToken } from "@/lib/types";

export default function AgentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [token, setToken] = useState<WebhookToken | null>(null);

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

      setWorkspace(ws);

      const { data: ag } = await supabase
        .from("agents")
        .select("*")
        .eq("workspace_id", ws.id)
        .single();

      setAgent(ag);

      const { data: tk } = await supabase
        .from("webhook_tokens")
        .select("*")
        .eq("workspace_id", ws.id)
        .single();

      setToken(tk);
      setLoading(false);
    }

    load();
  }, [router]);

  if (loading) return <FullPageLoader />;

  return (
    <DashboardLayout>
      <AgentSetup
        workspace={workspace!}
        agent={agent}
        token={token}
      />
    </DashboardLayout>
  );
}
