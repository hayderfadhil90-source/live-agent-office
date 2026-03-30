"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bot, Monitor, ArrowRight, Key } from "lucide-react";
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

function buildNotifyScript(agentId: string, token: string, webhookUrl: string): string {
  return `#!/bin/bash
EVENT=\${1:-thinking_started}
curl -s -X POST ${webhookUrl} \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d "{\\"agentId\\":\\"${agentId}\\",\\"event\\":\\"$EVENT\\"}"

# Auto-reset to idle 10 seconds after reply
if [ "$EVENT" = "reply_sent" ]; then
  sleep 10
  curl -s -X POST ${webhookUrl} \\
    -H "Authorization: Bearer ${token}" \\
    -H "Content-Type: application/json" \\
    -d '{"agentId":"${agentId}","event":"task_completed"}'
fi`;
}

function buildAgentsMd(): string {
  return `## RULE #1 - Live Office Notifications (MANDATORY)

BEFORE processing any message:
bash /path/to/notify.sh thinking_started

AFTER sending your reply:
bash /path/to/notify.sh reply_sent

- Run silently, don't mention it to the user
- No exceptions`;
}

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

      {/* Connect guide — only show after agent created */}
      {agent && token && (
        <div className="space-y-4">

          {/* Step-by-step header */}
          <div className="flex items-center gap-2 pt-2">
            <div className="h-px flex-1 bg-surface-200/10" />
            <span className="text-xs text-surface-200/30 font-medium px-2">Connect your bot</span>
            <div className="h-px flex-1 bg-surface-200/10" />
          </div>

          {/* Step 1 — notify.sh */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-5 h-5 rounded-full bg-brand-500/20 text-brand-500 text-xs font-bold flex items-center justify-center">1</span>
              <h3 className="text-sm font-semibold">Save this script on your server</h3>
              <CopyButton text={buildNotifyScript(agent.id, token.token, webhookUrl)} className="ml-auto" />
            </div>
            <p className="text-xs text-surface-200/30 mb-3 ml-7">Save as <code className="text-surface-200/50">notify.sh</code> and run <code className="text-surface-200/50">chmod +x notify.sh</code></p>
            <pre className="text-xs text-emerald-400 font-mono bg-surface-800 rounded-lg p-4 overflow-x-auto leading-relaxed whitespace-pre">
              {buildNotifyScript(agent.id, token.token, webhookUrl)}
            </pre>
          </div>

          {/* Step 2 — AGENTS.md */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-5 h-5 rounded-full bg-brand-500/20 text-brand-500 text-xs font-bold flex items-center justify-center">2</span>
              <h3 className="text-sm font-semibold">Add this rule to your AGENTS.md</h3>
              <CopyButton text={buildAgentsMd()} className="ml-auto" />
            </div>
            <p className="text-xs text-surface-200/30 mb-3 ml-7">Replace <code className="text-surface-200/50">/path/to/notify.sh</code> with the actual path where you saved the script</p>
            <pre className="text-xs text-amber-400 font-mono bg-surface-800 rounded-lg p-4 overflow-x-auto leading-relaxed whitespace-pre">
              {buildAgentsMd()}
            </pre>
          </div>

          {/* Step 3 — Done */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center">3</span>
              <h3 className="text-sm font-semibold">Open the live room and chat with your bot</h3>
            </div>
            <p className="text-xs text-surface-200/40 ml-7">
              When anyone messages your bot:<br/>
              <span className="text-surface-200/60">Message → <span className="text-amber-400">Thinking</span> → <span className="text-blue-400">Replying</span> → <span className="text-emerald-400">Idle</span></span>
            </p>
          </div>

          {/* Credentials (collapsed, for advanced users) */}
          <details className="card p-5 group">
            <summary className="flex items-center gap-2 cursor-pointer list-none">
              <Key className="w-4 h-4 text-surface-200/30" />
              <span className="text-xs text-surface-200/40 font-medium">Advanced — raw credentials</span>
              <span className="ml-auto text-surface-200/20 text-xs group-open:hidden">Show</span>
              <span className="ml-auto text-surface-200/20 text-xs hidden group-open:block">Hide</span>
            </summary>
            <div className="mt-4 space-y-3">
              <div>
                <p className="text-xs text-surface-200/30 mb-1.5">Webhook URL</p>
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-800 border border-surface-200/10">
                  <code className="text-xs text-emerald-400 flex-1 font-mono truncate">POST {webhookUrl}</code>
                  <CopyButton text={webhookUrl} />
                </div>
              </div>
              <div>
                <p className="text-xs text-surface-200/30 mb-1.5">Bearer token</p>
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-800 border border-surface-200/10">
                  <code className="text-xs text-amber-400 flex-1 font-mono truncate">{token.token}</code>
                  <CopyButton text={token.token} />
                </div>
              </div>
              <div>
                <p className="text-xs text-surface-200/30 mb-1.5">Agent ID</p>
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-800 border border-surface-200/10">
                  <code className="text-xs text-surface-200/60 flex-1 font-mono">{agent.id}</code>
                  <CopyButton text={agent.id} />
                </div>
              </div>
            </div>
          </details>

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
