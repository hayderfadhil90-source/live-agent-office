import { cn } from "@/lib/utils/cn";

const AVATAR_COLORS: Record<string, string> = {
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  pink: "bg-pink-500",
  cyan: "bg-cyan-500",
  red: "bg-red-500",
  indigo: "bg-indigo-500",
};

interface Props {
  name: string;
  style: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function AvatarCircle({ name, style, size = "md", className }: Props) {
  const bg = AVATAR_COLORS[style] ?? "bg-brand-500";
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const sizeClasses = {
    sm: "w-7 h-7 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-14 h-14 text-lg",
  };

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0",
        bg,
        sizeClasses[size],
        className
      )}
    >
      {initials}
    </div>
  );
}
