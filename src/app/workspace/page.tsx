"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { WorkspaceSetup } from "./WorkspaceSetup";
import { FullPageLoader } from "@/components/ui/LoadingSpinner";
import type { Workspace, Agent } from "@/lib/types";

export default function WorkspacePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [agent, setAgent] = useState<Agent | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setUserId(user.id);

      const { data: ws } = await supabase
        .from("workspaces")
        .select("*")
        .eq("user_id", user.id)
        .single();

      setWorkspace(ws);

      if (ws) {
        const { data: ag } = await supabase
          .from("agents")
          .select("*")
          .eq("workspace_id", ws.id)
          .single();
        setAgent(ag);
      }

      setLoading(false);
    }

    load();
  }, [router]);

  if (loading) return <FullPageLoader />;

  return (
    <DashboardLayout>
      <WorkspaceSetup
        userId={userId!}
        workspace={workspace}
        agent={agent}
      />
    </DashboardLayout>
  );
}
