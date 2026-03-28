"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, Bot, Monitor, ArrowRight, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { AvatarCircle } from "@/components/ui/AvatarCircle";
import type { Workspace, Agent } from "@/lib/types";

interface Props {
  userId: string;
  workspace: Workspace | null;
  agent: Agent | null;
}

const TEMPLATES = [{ id: "office", label: "Office", emoji: "🏢" }];

export function WorkspaceSetup({ userId, workspace, agent }: Props) {
  const router = useRouter();
  const [name, setName] = useState(workspace?.name ?? "");
  const [template, setTemplate] = useState(
    workspace?.template_name ?? "office"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const hasWorkspace = !!workspace;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError("");

    const supabase = createClient();

    if (hasWorkspace) {
      // Update
      const { error: err } = await supabase
        .from("workspaces")
        .update({ name: name.trim(), template_name: template })
        .eq("id", workspace.id);
      if (err) { setError(err.message); setLoading(false); return; }
    } else {
      // Create workspace
      const { error: err } = await supabase
        .from("workspaces")
        .insert({ user_id: userId, name: name.trim(), template_name: template });
      if (err) { setError(err.message); setLoading(false); return; }
    }

    router.push("/agent");
    router.refresh();
  };

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">
          {hasWorkspace ? "Your Workspace" : "Create your workspace"}
        </h1>
        <p className="text-surface-200/50 text-sm">
          {hasWorkspace
            ? "Your space is live. Continue to set up your agent."
            : "Give your virtual space a name and choose a template."}
        </p>
      </div>

      {/* Progress steps */}
      <div className="flex items-center gap-2 mb-8">
        {[
          { icon: Building2, label: "Workspace", step: 1 },
          { icon: Bot, label: "Agent", step: 2 },
          { icon: Monitor, label: "Live Room", step: 3 },
        ].map(({ icon: Icon, label, step }, i) => {
          const done =
            (step === 1 && hasWorkspace) ||
            (step === 2 && !!agent) ||
            (step === 3 && !!agent);
          const current = step === 1;
          return (
            <div key={step} className="flex items-center">
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${
                  done
                    ? "text-emerald-400"
                    : current
                    ? "bg-brand-500/15 text-brand-500"
                    : "text-surface-200/30"
                }`}
              >
                {done ? (
                  <CheckCircle className="w-3.5 h-3.5" />
                ) : (
                  <Icon className="w-3.5 h-3.5" />
                )}
                {label}
              </div>
              {i < 2 && (
                <div className="w-8 h-px bg-surface-200/10 mx-1" />
              )}
            </div>
          );
        })}
      </div>

      {/* Form */}
      <div className="card p-6">
        {error && (
          <div className="mb-4 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="label">Workspace name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My AI Office"
              required
              className="input-field"
            />
          </div>

          <div>
            <label className="label">Template</label>
            <div className="grid grid-cols-3 gap-3">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTemplate(t.id)}
                  className={`p-4 rounded-lg border text-center transition-colors ${
                    template === t.id
                      ? "border-brand-500 bg-brand-500/10 text-brand-500"
                      : "border-surface-200/10 bg-surface-800 text-surface-200/50 hover:border-surface-200/20"
                  }`}
                >
                  <span className="text-2xl block mb-1">{t.emoji}</span>
                  <span className="text-xs font-medium">{t.label}</span>
                  {template === t.id && (
                    <span className="text-xs block mt-0.5 opacity-70">
                      Selected
                    </span>
                  )}
                </button>
              ))}
              {/* Placeholder coming-soon templates */}
              {["Studio", "Support Room"].map((label) => (
                <div
                  key={label}
                  className="p-4 rounded-lg border border-surface-200/5 bg-surface-800/30 text-center opacity-30 cursor-not-allowed"
                >
                  <span className="text-2xl block mb-1">🔒</span>
                  <span className="text-xs font-medium text-surface-200/40">
                    {label}
                  </span>
                  <span className="text-xs block mt-0.5 text-surface-200/30">
                    Soon
                  </span>
                </div>
              ))}
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? (
              <LoadingSpinner size="sm" />
            ) : (
              <>
                {hasWorkspace ? "Save changes" : "Create workspace"}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>

      {/* If workspace exists, show quick next steps */}
      {hasWorkspace && (
        <div className="mt-6 grid grid-cols-2 gap-4">
          <Link
            href="/agent"
            className="card p-4 flex items-start gap-3 hover:border-surface-200/20 transition-colors"
          >
            <Bot className="w-5 h-5 text-brand-500 mt-0.5" />
            <div>
              <p className="text-sm font-medium mb-0.5">
                {agent ? "View agent" : "Set up agent"}
              </p>
              <p className="text-xs text-surface-200/40">
                {agent ? `${agent.name} · ${agent.role}` : "Create your first AI agent"}
              </p>
            </div>
          </Link>

          {agent && (
            <Link
              href="/room"
              className="card p-4 flex items-start gap-3 hover:border-surface-200/20 transition-colors"
            >
              <Monitor className="w-5 h-5 text-emerald-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium mb-0.5">Open live room</p>
                <p className="text-xs text-surface-200/40">
                  Watch {agent.name} in action
                </p>
              </div>
            </Link>
          )}
        </div>
      )}

      {/* Agent preview if exists */}
      {agent && (
        <div className="mt-4 card p-4 flex items-center gap-3">
          <AvatarCircle name={agent.name} style={agent.avatar_style} size="sm" />
          <div>
            <p className="text-sm font-medium">{agent.name}</p>
            <p className="text-xs text-surface-200/40 capitalize">{agent.role}</p>
          </div>
          <span className="ml-auto text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
            Active
          </span>
        </div>
      )}
    </div>
  );
}
