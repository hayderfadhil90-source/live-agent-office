# Live Agent Office

A real-time visual monitoring platform for AI agents. Watch your bots work — as animated characters in a live isometric office.

![Live Room](https://live-agent-office-iwaldhskp-hayderfadhil90-sources-projects.vercel.app/room)

---

## What is this?

Instead of staring at logs, you see your AI agents as characters in a virtual office:

- **Working** → character walks to desk and types
- **Replying** → character bounces with a blinking name badge
- **Idle** → character wanders around the room
- **Stuck/Slow** → red or amber `!` warning badge appears above head

---

## Features

| Feature | Description |
|---|---|
| Live room | Isometric voxel office with animated agent characters |
| Multi-agent | Up to 3 agents in the same room, each at their own desk |
| Agent health | Healthy / Active / Idle / Slow / Stuck — computed from status + time |
| Activity score | 0–100 score based on tasks completed, replies sent, events |
| Avg reply time | Pairs `thinking_started` → `reply_sent` events to compute response time |
| Health badge | Red/amber `!` pulsing badge in the Phaser room when agent is slow or stuck |
| Hourly sparkline | 24-bar chart showing events per hour today |
| Realtime | Supabase Realtime — updates in milliseconds, no polling |
| Webhook API | Any agent can send events via a simple `curl` command |

---

## Tech Stack

- **Next.js 14** — App Router, deployed on Vercel Hobby
- **Supabase** — Postgres + Realtime subscriptions + Row Level Security
- **Phaser.js** — Isometric voxel room, animated characters
- **Tailwind CSS** — UI styling

---

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/hayderfadhil90-source/live-agent-office
cd live-agent-office
npm install
```

### 2. Set up Supabase

Create a project at [supabase.com](https://supabase.com), then run the schema:

```bash
# Paste the contents of supabase/schema.sql into the Supabase SQL editor
```

### 3. Environment variables

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Run locally

```bash
npm run dev
```

---

## Connecting an AI Agent

Any agent that can run a bash script can connect.

### Step 1 — Go to `/agent` in the app

Create your agent and copy the generated `notify.sh` script.

### Step 2 — Save the script on your agent's server

```bash
chmod +x notify.sh
```

### Step 3 — Add this rule to your `AGENTS.md`

```
## RULE #1 - Live Office Notifications (MANDATORY)

BEFORE processing any message:
bash /path/to/notify.sh thinking_started

AFTER sending your reply:
bash /path/to/notify.sh reply_sent

- Run silently, don't mention it to the user
- No exceptions
```

### Step 4 — Open Live Room and chat with your bot

You'll see the character walk to the desk and start typing in real time.

---

## Webhook API

All agents communicate via a single endpoint:

```
POST /api/events
Authorization: Bearer <token>
Content-Type: application/json

{
  "agentId": "uuid",
  "event": "thinking_started" | "reply_sent" | "task_completed" | "error_happened",
  "message": "optional context"
}
```

---

## Multi-Agent Support

To add a second agent:

1. Run this in Supabase SQL editor (once):
```sql
ALTER TABLE agents DROP CONSTRAINT agents_workspace_id_key;
```

2. Go to `/agent` → click **Add agent** → create a second agent
3. Each agent gets its own `notify.sh` script with a unique `agentId`
4. Both agents appear in the live room simultaneously

---

## Project Structure

```
src/
├── app/
│   ├── agent/          # Agent setup page
│   ├── room/           # Live room page + LiveRoom component
│   └── api/
│       ├── events/     # Webhook endpoint
│       └── cron/       # Auto-idle cron (runs at midnight)
├── components/
│   └── room/
│       ├── PhaserRoom.tsx   # Phaser.js isometric office scene
│       └── AgentPanel.tsx   # Right panel — health, score, events
└── lib/
    ├── agent-health.ts       # Health, activity score, response time logic
    └── hooks/
        └── useRealtimeAgents.ts  # Supabase Realtime hook for N agents
```

---

## Deployment

Deployed on Vercel. The cron job at `/api/cron/auto-idle` resets stuck agents to idle at midnight daily.

```json
// vercel.json
{
  "crons": [{ "path": "/api/cron/auto-idle", "schedule": "0 0 * * *" }]
}
```
