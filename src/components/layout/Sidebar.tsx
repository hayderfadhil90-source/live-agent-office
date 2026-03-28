"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Bot,
  Monitor,
  LogOut,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { createClient } from "@/lib/supabase/client";

const NAV_ITEMS = [
  { label: "Workspace", href: "/workspace", icon: LayoutDashboard },
  { label: "Agent", href: "/agent", icon: Bot },
  { label: "Live Room", href: "/room", icon: Monitor },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <aside className="fixed inset-y-0 left-0 w-56 bg-surface-900 border-r border-surface-200/10 flex flex-col z-20">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-surface-200/10">
        <div className="w-7 h-7 rounded-lg bg-brand-500 flex items-center justify-center flex-shrink-0">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-surface-50 text-sm">
          Agent Office
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-brand-500/15 text-brand-500"
                  : "text-surface-200/60 hover:text-surface-50 hover:bg-surface-200/5"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-surface-200/10">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-surface-200/50 hover:text-surface-50 hover:bg-surface-200/5 transition-colors w-full"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
