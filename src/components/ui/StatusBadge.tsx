import { cn } from "@/lib/utils/cn";
import type { AgentStatus } from "@/lib/types";

const CONFIG: Record<
  AgentStatus,
  { label: string; dot: string; badge: string }
> = {
  idle: {
    label: "Idle",
    dot: "bg-surface-200/50",
    badge: "bg-surface-200/10 text-surface-200/70",
  },
  working: {
    label: "Working",
    dot: "bg-amber-400",
    badge: "bg-amber-400/10 text-amber-400",
  },
  replying: {
    label: "Replying",
    dot: "bg-brand-500",
    badge: "bg-brand-500/10 text-brand-500",
  },
  error: {
    label: "Error",
    dot: "bg-red-500",
    badge: "bg-red-500/10 text-red-400",
  },
};

interface Props {
  status: AgentStatus;
  pulse?: boolean;
  className?: string;
}

export function StatusBadge({ status, pulse = true, className }: Props) {
  const c = CONFIG[status];
  return (
    <span className={cn("status-badge", c.badge, className)}>
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          c.dot,
          pulse && status !== "idle" && "animate-pulse"
        )}
      />
      {c.label}
    </span>
  );
}
