

## Plan: Discord Webhook Notifications per Project

### Overview
Add a settings section in the Notifications page where project leaders can configure Discord webhook URLs per project. Support multiple channels (webhooks). When in-app notifications are created, also send them to all configured Discord webhooks for that project via an edge function.

### 1. Database: `discord_webhooks` table
Create a new table to store webhook configurations per project:
```sql
CREATE TABLE public.discord_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  channel_name text NOT NULL,
  webhook_url text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  notify_tasks boolean NOT NULL DEFAULT true,
  notify_meetings boolean NOT NULL DEFAULT true,
  notify_files boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
```
RLS: Only project leaders can insert/update/delete. Project members can view.

### 2. Edge Function: `send-discord-notification`
A backend function that:
- Receives `{ project_id, title, message, type }` 
- Fetches all enabled webhooks for that project from the database
- Sends a formatted embed to each Discord webhook URL
- No API key needed -- Discord webhooks are simple POST requests

### 3. UI: Discord Settings in Notifications Page
Add a "Discord Settings" tab/section (visible to leaders only) at the top of the Notifications page:
- List of configured webhooks with channel name, URL (masked), enabled toggle
- "Add Webhook" dialog: channel name + webhook URL + notification type toggles
- Edit/delete existing webhooks
- "Test" button to send a test message

### 4. Trigger Discord on Notification Insert
Update the notification insertion logic in `Tasks.tsx` (and other places that create notifications) to also call the edge function, passing the notification details. This sends to all configured Discord channels for the project.

### Files
- **Create**: `supabase/functions/send-discord-notification/index.ts`
- **Create**: `src/components/DiscordWebhookSettings.tsx`
- **Edit**: `src/pages/Notifications.tsx` (add Discord settings section)
- **Edit**: `src/pages/Tasks.tsx` (call edge function on notification events)
- **Migration**: Create `discord_webhooks` table with RLS

### Technical Details
- Discord webhook format: POST to URL with `{ embeds: [{ title, description, color }] }`
- Edge function uses service role key to read webhooks, no user auth needed for the webhook call
- Webhook URLs are stored encrypted-at-rest in the database
- The edge function filters webhooks by notification type (tasks/meetings/files)

