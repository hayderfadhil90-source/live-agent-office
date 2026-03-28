"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bot, Monitor, ArrowRight, Key, Webhook, Code2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { AvatarCircle } from "@/components/ui/AvatarCircle";
import { CopyButton } from "@/components/ui/CopyButton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { Workspace, Agent, WebhookToken } from "@/lib/types";

interface Props {
  workspace: Workspace;
  agent: Agent | null;
  token: WebhookToken | null;
}

const ROLES = ["support", "content", "booking", "assistant"] as const;
const AVATAR_COLORS = [
  { id: "blue", label: "Blue", cls: "bg-blue-500" },
  { id: "purple", label: "Purple", cls: "bg-purple-500" },
  { id: "green", label: "Green", cls: "bg-emerald-500" },
  { id: "amber", label: "Amber", cls: "bg-amber-500" },
  { id: "pink", label: "Pink", cls: "bg-pink-500" },
  { id: "cyan", label: "Cyan", cls: "bg-cyan-500" },
];

function buildExamplePayload(agentId: string): string {
  return JSON.stringify(
    {
      agentId,
      event: "reply_sent",
      status: "replying",
      message: "Replied to Telegram user",
      timestamp: new Date().toISOString(),
    },
    null,
    2
  );
}

export function AgentSetup({ workspace, agent: initialAgent, token: initialToken }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialAgent?.name ?? "");
  const [role, setRole] = useState<string>(initialAgent?.role ?? "support");
  const [avatarStyle, setAvatarStyle] = useState(
    initialAgent?.avatar_style ?? "blue"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [agent, setAgent] = useState<Agent | null>(initialAgent);
  const [token, setToken] = useState<WebhookToken | null>(initialToken);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const webhookUrl = `${appUrl}/api/events`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();

    let savedAgent: Agent;

    if (agent) {
      // Update existing agent
      const { data, error: err } = await supabase
        .from("agents")
        .update({
          name: name.trim(),
          role,
          avatar_style: avatarStyle,
        })
        .eq("id", agent.id)
        .select()
        .single();
      if (err) { setError(err.message); setLoading(false); return; }
      savedAgent = data as Agent;
    } else {
      // Create agent
      const { data, error: err } = await supabase
        .from("agents")
        .insert({
          workspace_id: workspace.id,
          name: name.trim(),
          role,
          avatar_style: avatarStyle,
        })
        .select()
        .single();
      if (err) { setError(err.message); setLoading(false); return; }
      savedAgent = data as Agent;
    }

    // Generate webhook token if it doesn't exist
    if (!token) {
      const { data: tokenData } = await supabase
        .from("webhook_tokens")
        .insert({ workspace_id: workspace.id })
        .select()
        .single();
      if (tokenData) setToken(tokenData as WebhookToken);
    }

    setAgent(savedAgent);
    setLoading(false);
    router.refresh();
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">
          {agent ? "Your agent" : "Create your agent"}
        </h1>
        <p className="text-surface-200/50 text-sm">
          {agent
            ? "Manage your agent settings and webhook connection."
            : "Define your AI agent's identity inside the office."}
        </p>
      </div>

      <div className="card p-6 mb-6">
        {error && (
          <div className="mb-4 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Preview */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-800/60">
            <AvatarCircle
              name={name || "?"}
              style={avatarStyle}
              size="md"
            />
            <div>
              <p className="text-sm font-medium">
                {name || <span className="text-surface-200/30">Agent name</span>}
              </p>
              <p className="text-xs text-surface-200/40 capitalize">{role}</p>
            </div>
            {agent && (
              <div className="ml-auto">
                <StatusBadge status={agent.status} />
              </div>
            )}
          </div>

          <div>
            <label className="label">Agent name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Atlas, Nova, Aria..."
              required
              className="input-field"
            />
          </div>

          <div>
            <label className="label">Role</label>
            <div className="grid grid-cols-4 gap-2">
              {ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`py-2 px-3 rounded-lg text-xs font-medium capitalize transition-colors border ${
                    role === r
                      ? "border-brand-500 bg-brand-500/10 text-brand-500"
                      : "border-surface-200/10 bg-surface-800 text-surface-200/50 hover:border-surface-200/20"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Avatar color</label>
            <div className="flex items-center gap-2 flex-wrap">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setAvatarStyle(c.id)}
                  className={`w-8 h-8 rounded-full ${c.cls} transition-all ${
                    avatarStyle === c.id
                      ? "ring-2 ring-offset-2 ring-offset-surface-900 ring-brand-500 scale-110"
                      : "opacity-60 hover:opacity-100"
                  }`}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? (
              <LoadingSpinner size="sm" />
            ) : (
              <>
                {agent ? "Save changes" : "Create agent"}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>

      {/* Webhook credentials — only show after agent created */}
      {agent && token && (
        <div className="space-y-4">
          {/* Webhook URL */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Webhook className="w-4 h-4 text-brand-500" />
              <h3 className="text-sm font-semibold">Webhook URL</h3>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-800 border border-surface-200/10">
              <code className="text-xs text-emerald-400 flex-1 font-mono truncate">
                POST {webhookUrl}
              </code>
              <CopyButton text={webhookUrl} />
            </div>
          </div>

          {/* Token */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Key className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-semibold">Bearer token</h3>
              <span className="text-xs text-surface-200/30 ml-auto">
                Add as Authorization header
              </span>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-800 border border-surface-200/10">
              <code className="text-xs text-amber-400 flex-1 font-mono truncate">
                Bearer {token.token}
              </code>
              <CopyButton text={`Bearer ${token.token}`} />
            </div>
            <p className="text-xs text-surface-200/30 mt-2">
              Keep this secret. It authenticates events to your workspace.
            </p>
          </div>

          {/* Agent ID */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Bot className="w-4 h-4 text-surface-200/50" />
              <h3 className="text-sm font-semibold">Agent ID</h3>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-800 border border-surface-200/10">
              <code className="text-xs text-surface-200/60 flex-1 font-mono">
                {agent.id}
              </code>
              <CopyButton text={agent.id} />
            </div>
          </div>

          {/* Example payload */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Code2 className="w-4 h-4 text-surface-200/50" />
              <h3 className="text-sm font-semibold">Example event payload</h3>
              <CopyButton
                text={buildExamplePayload(agent.id)}
                className="ml-auto"
              />
            </div>
            <pre className="text-xs text-emerald-400 font-mono bg-surface-800 rounded-lg p-4 overflow-x-auto leading-relaxed">
              {buildExamplePayload(agent.id)}
            </pre>
          </div>

          {/* cURL example */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Code2 className="w-4 h-4 text-surface-200/50" />
              <h3 className="text-sm font-semibold">cURL example</h3>
            </div>
            <pre className="text-xs text-sky-400 font-mono bg-surface-800 rounded-lg p-4 overflow-x-auto leading-relaxed whitespace-pre-wrap break-all">
{`curl -X POST ${webhookUrl} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${token.token}" \\
  -d '${JSON.stringify({ agentId: agent.id, event: "status_changed", status: "working", message: "Task started" })}'`}
            </pre>
          </div>

          {/* Go to live room */}
          <Link href="/room" className="btn-primary w-full justify-center">
            <Monitor className="w-4 h-4" />
            Open live room
          </Link>
        </div>
      )}
    </div>
  );
}
