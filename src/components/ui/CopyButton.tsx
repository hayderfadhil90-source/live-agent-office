"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface Props {
  text: string;
  className?: string;
}

export function CopyButton({ text, className }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium",
        "bg-surface-800 border border-surface-200/10 hover:bg-surface-200/10",
        "text-surface-200/70 hover:text-surface-50 transition-colors",
        className
      )}
    >
      {copied ? (
        <>
          <Check className="w-3 h-3 text-emerald-400" />
          Copied
        </>
      ) : (
        <>
          <Copy className="w-3 h-3" />
          Copy
        </>
      )}
    </button>
  );
}
