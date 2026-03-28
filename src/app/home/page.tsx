import Link from "next/link";
import { Zap, Monitor, Webhook, Activity, Bot, ArrowRight } from "lucide-react";

const FEATURES = [
  {
    icon: Bot,
    title: "Connect Any Agent",
    description:
      "Plug in your AI bot via a webhook. No SDK required — just POST JSON events.",
  },
  {
    icon: Monitor,
    title: "Live Visual Room",
    description:
      "Watch your agent move and react inside a beautiful virtual office in real time.",
  },
  {
    icon: Webhook,
    title: "Simple Webhook API",
    description:
      "One endpoint. Send events like message_received, reply_sent, or task_completed.",
  },
  {
    icon: Activity,
    title: "Real-Time Status",
    description:
      "See idle, working, replying, and error states update instantly as events arrive.",
  },
];

const EVENT_EXAMPLE = `POST /api/events
Authorization: Bearer <your-token>

{
  "agentId": "agent_123",
  "event": "reply_sent",
  "status": "replying",
  "message": "Replied to Telegram user",
  "timestamp": "2026-03-28T10:00:00Z"
}`;

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-surface-950 text-surface-50">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-30 border-b border-surface-200/5 bg-surface-950/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-brand-500 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-sm">Agent Office</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-surface-200/70 hover:text-surface-50 transition-colors px-3 py-1.5"
            >
              Log in
            </Link>
            <Link href="/signup" className="btn-primary py-1.5 text-xs">
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-40 pb-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-500 text-xs font-medium mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
            MVP — Now in open preview
          </div>

          <h1 className="text-5xl font-bold tracking-tight text-surface-50 mb-6 leading-tight">
            Watch your AI agents{" "}
            <span className="text-brand-500">work live</span>
            <br />
            inside a virtual office
          </h1>

          <p className="text-lg text-surface-200/60 mb-10 max-w-xl mx-auto leading-relaxed">
            Connect your bot via webhook and see it come to life — moving,
            thinking, replying — inside a visual room you control.
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link href="/signup" className="btn-primary gap-2 px-6 py-3 text-sm">
              Create your workspace
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/login" className="btn-secondary px-6 py-3 text-sm">
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="py-20 px-6 border-t border-surface-200/5">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-semibold text-center mb-12 text-surface-50/90">
            Everything you need for the first version
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div key={title} className="card p-5">
                <div className="w-9 h-9 rounded-lg bg-brand-500/10 flex items-center justify-center mb-4">
                  <Icon className="w-4.5 h-4.5 text-brand-500 w-[18px] h-[18px]" />
                </div>
                <h3 className="font-semibold text-sm mb-2">{title}</h3>
                <p className="text-xs text-surface-200/50 leading-relaxed">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Code example */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-semibold mb-3">
              One endpoint. Real-time results.
            </h2>
            <p className="text-surface-200/50 text-sm">
              Send an event from your agent — watch it appear in the live room
              instantly.
            </p>
          </div>

          <div className="card overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-200/10 bg-surface-800/50">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-amber-500/60" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
              </div>
              <span className="text-xs text-surface-200/40 ml-2">
                webhook request
              </span>
            </div>
            <pre className="p-5 text-xs text-emerald-400 font-mono leading-relaxed overflow-x-auto">
              {EVENT_EXAMPLE}
            </pre>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 border-t border-surface-200/5">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to see your agent live?
          </h2>
          <p className="text-surface-200/50 mb-8 text-sm">
            Create a free workspace in under a minute.
          </p>
          <Link href="/signup" className="btn-primary px-8 py-3 text-sm">
            Start building →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-surface-200/5 text-center text-xs text-surface-200/30">
        © 2026 Agent Office — MVP v0.1
      </footer>
    </div>
  );
}
