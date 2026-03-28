import { cn } from "@/lib/utils/cn";

interface Props {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function LoadingSpinner({ size = "md", className }: Props) {
  const sizeClasses = {
    sm: "w-4 h-4 border-2",
    md: "w-6 h-6 border-2",
    lg: "w-8 h-8 border-3",
  };

  return (
    <div
      className={cn(
        "rounded-full border-surface-200/20 border-t-brand-500 animate-spin",
        sizeClasses[size],
        className
      )}
    />
  );
}

export function FullPageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-950">
      <LoadingSpinner size="lg" />
    </div>
  );
}
