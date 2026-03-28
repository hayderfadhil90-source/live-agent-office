// ─── Database Entity Types ────────────────────────────────────────────────────

export type AgentStatus = "idle" | "working" | "replying" | "error";
export type AgentRole = "support" | "content" | "booking" | "assistant";
export type EventType =
  | "message_received"
  | "thinking_started"
  | "reply_sent"
  | "task_started"
  | "task_completed"
  | "error_happened"
  | "status_changed";

export interface Profile {
  id: string;
  email: string;
  created_at: string;
}

export interface Workspace {
  id: string;
  user_id: string;
  name: string;
  template_name: string;
  created_at: string;
}

export interface Agent {
  id: string;
  workspace_id: string;
  name: string;
  role: AgentRole;
  status: AgentStatus;
  avatar_style: string;
  pos_x: number;
  pos_y: number;
  created_at: string;
  updated_at: string;
}

export interface AgentEvent {
  id: string;
  agent_id: string;
  event_type: EventType;
  status: AgentStatus | null;
  message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface WebhookToken {
  id: string;
  workspace_id: string;
  token: string;
  created_at: string;
}

// ─── API / Webhook ────────────────────────────────────────────────────────────

export interface IncomingEvent {
  agentId: string;
  event: EventType;
  status?: AgentStatus;
  message?: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

// ─── Realtime ─────────────────────────────────────────────────────────────────

export interface LiveEvent {
  type: "agent_status" | "new_event";
  agentId: string;
  status?: AgentStatus;
  event?: AgentEvent;
}
