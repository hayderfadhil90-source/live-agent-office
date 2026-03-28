# Live Agent Office — Architecture Reference

## Step 1: Project Architecture

```
src/
├── app/
│   ├── layout.tsx              # Root HTML shell
│   ├── page.tsx                # → redirects to /home
│   ├── home/page.tsx           # Landing page
│   ├── login/page.tsx          # Auth: login
│   ├── signup/page.tsx         # Auth: signup
│   ├── workspace/
│   │   ├── page.tsx            # Server component (fetches data)
│   │   └── WorkspaceSetup.tsx  # Client form
│   ├── agent/
│   │   ├── page.tsx            # Server component
│   │   └── AgentSetup.tsx      # Client form + webhook config
│   ├── room/
│   │   ├── page.tsx            # Server component (SSR data)
│   │   └── LiveRoom.tsx        # Client: realtime + Phaser
│   ├── auth/callback/route.ts  # Supabase email confirm callback
│   └── api/
│       └── events/route.ts     # POST /api/events (webhook)
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx         # App nav
│   │   └── DashboardLayout.tsx # Sidebar wrapper
│   ├── room/
│   │   ├── PhaserRoom.tsx      # Phaser.js canvas (dynamic import)
│   │   └── AgentPanel.tsx      # Right panel: status + event log
│   └── ui/
│       ├── AvatarCircle.tsx
│       ├── CopyButton.tsx
│       ├── LoadingSpinner.tsx
│       └── StatusBadge.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts           # Browser client
│   │   ├── server.ts           # Server component client
│   │   ├── admin.ts            # Service role (API routes only)
│   │   └── middleware.ts       # Session refresh + route guard
│   ├── hooks/
│   │   ├── useSupabase.ts
│   │   └── useRealtimeAgent.ts # Supabase Realtime subscription
│   ├── types/index.ts          # Shared TypeScript types
│   └── utils/
│       ├── cn.ts               # tailwind-merge helper
│       └── token.ts            # Webhook token generation
├── middleware.ts               # Next.js edge middleware
└── styles/globals.css
```

## Step 2: Database Schema

See `supabase/schema.sql` for the full SQL.

Key design decisions:
- `unique (user_id)` on workspaces → enforces 1 workspace per user
- `unique (workspace_id)` on agents → enforces 1 agent per workspace
- `unique (workspace_id)` on webhook_tokens → 1 token per workspace
- RLS enabled on all tables — users only see their own data
- `agents` and `events` added to `supabase_realtime` publication
- Trigger auto-creates `profiles` row on auth.users insert

## Step 3: Auth Flow

1. User signs up via `/signup` → `supabase.auth.signUp()`
2. Email confirmation (if enabled) → `/auth/callback` exchanges code for session
3. Login via `/login` → `supabase.auth.signInWithPassword()`
4. Middleware in `src/middleware.ts` protects `/workspace`, `/agent`, `/room`
5. Session refreshed on every request via `updateSession()`

## Step 6: Webhook Endpoint

```
POST /api/events
Authorization: Bearer <token>
Content-Type: application/json

{
  "agentId": "uuid",
  "event": "reply_sent",
  "status": "replying",
  "message": "Replied to user",
  "timestamp": "2026-03-28T10:00:00Z"
}
```

Flow:
1. Extract Bearer token from Authorization header
2. Validate token → lookup in `webhook_tokens` → get `workspace_id`
3. Validate `agentId` belongs to that workspace
4. Insert row into `events`
5. Update `agents.status`
6. Supabase Realtime broadcasts the DB change to subscribed frontend clients

## Step 7: Live Event Feed (Realtime)

Uses Supabase Realtime `postgres_changes`:

```ts
supabase
  .channel(`agent:${agentId}`)
  .on('postgres_changes', { event: 'UPDATE', table: 'agents', filter: `id=eq.${agentId}` }, handler)
  .on('postgres_changes', { event: 'INSERT', table: 'events', filter: `agent_id=eq.${agentId}` }, handler)
  .subscribe()
```

No Socket.io server needed — Supabase handles WebSocket connections.
This keeps infra minimal for MVP.

## Step 8: Phaser Office Room

- `PhaserRoom.tsx` dynamically imports Phaser (client-only, no SSR)
- `OfficeScene extends Phaser.Scene`:
  - `create()` draws floor, desk, monitor, sofa with `Graphics` API
  - `createAvatar()` builds agent as `Container` with body + head + face
  - `applyStatusEffect(status)` applies tweens per state:
    - `idle` → gentle scale breathe
    - `working` → bounce up/down
    - `replying` → quick bounce + indicator pulse
    - `error` → shake + alpha flash
- `useEffect` watches `agent.status` prop and calls `scene.updateStatus()`

## Step 9: Realtime Updates

Flow: External bot → POST /api/events → Supabase DB update →
      Supabase Realtime → useRealtimeAgent hook →
      LiveRoom re-renders → PhaserRoom.updateStatus() called

## Step 10: MVP Checklist

- [x] Landing page with CTAs
- [x] Supabase Auth (signup + login)
- [x] Email callback handler
- [x] Middleware route protection
- [x] Workspace creation (1 per user)
- [x] Agent creation (1 per workspace) with role + avatar
- [x] Webhook token generation
- [x] POST /api/events endpoint with token auth
- [x] Event storage in DB
- [x] Agent status updates
- [x] Supabase Realtime subscription
- [x] Phaser.js office room with agent avatar
- [x] Status visual effects (idle/working/replying/error)
- [x] Right-side panel with agent info + event log
- [x] Clean sidebar layout
- [x] Database schema with RLS
- [x] Seed data for testing
