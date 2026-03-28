-- ============================================================
-- Seed data for local development / testing
-- Replace <USER_ID> with your actual Supabase auth user ID
-- ============================================================

-- Step 1: Create a test user via Supabase Auth dashboard or:
-- supabase auth signup --email test@example.com --password password123
-- Then get the user ID from auth.users table

DO $$
DECLARE
  v_user_id    uuid := '<USER_ID>'; -- Replace this
  v_workspace  uuid := gen_random_uuid();
  v_agent      uuid := gen_random_uuid();
BEGIN

  -- Profile (auto-created by trigger, but insert manually if needed)
  INSERT INTO profiles (id, email)
  VALUES (v_user_id, 'test@example.com')
  ON CONFLICT (id) DO NOTHING;

  -- Workspace
  INSERT INTO workspaces (id, user_id, name, template_name)
  VALUES (v_workspace, v_user_id, 'My Test Office', 'office')
  ON CONFLICT (user_id) DO NOTHING;

  -- Agent
  INSERT INTO agents (id, workspace_id, name, role, status, avatar_style, pos_x, pos_y)
  VALUES (v_agent, v_workspace, 'Atlas', 'support', 'idle', 'blue', 320, 280)
  ON CONFLICT (workspace_id) DO NOTHING;

  -- Webhook token
  INSERT INTO webhook_tokens (workspace_id)
  VALUES (v_workspace)
  ON CONFLICT (workspace_id) DO NOTHING;

  -- Sample events
  INSERT INTO events (agent_id, event_type, status, message) VALUES
    (v_agent, 'status_changed',  'idle',     'Agent started'),
    (v_agent, 'message_received','working',  'User: What are your hours?'),
    (v_agent, 'thinking_started','working',  'Analyzing request...'),
    (v_agent, 'reply_sent',      'replying', 'We are open Mon-Fri, 9am-6pm.'),
    (v_agent, 'task_completed',  'idle',     'Conversation closed'),
    (v_agent, 'message_received','working',  'User: Can I book an appointment?'),
    (v_agent, 'task_started',    'working',  'Booking flow initiated'),
    (v_agent, 'reply_sent',      'replying', 'Sure! Pick a time: tomorrow 2pm or 4pm?'),
    (v_agent, 'task_completed',  'idle',     'Appointment booked for tomorrow 2pm'),
    (v_agent, 'error_happened',  'error',    'API timeout — retrying...');

  RAISE NOTICE 'Seed complete. Workspace: %, Agent: %', v_workspace, v_agent;
END $$;
