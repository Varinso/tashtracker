

## Plan: 4 Feature Updates

### 1. Task-linked Documents in Documents Page
**What**: Each task appears as a section in the Documents page. Members can upload files linked to specific tasks (using the existing `task_id` column on the `files` table). The Documents page will show tasks as collapsible groups, with the ability to upload files directly into a task's section.

**Changes**:
- `src/pages/Documents.tsx`: Restructure the page to group by tasks first (fetching tasks + their assigned files), then show a general "Project Files" section for non-task files. Each task section is collapsible and has an upload button that auto-links the file to that task.

### 2. Task Visibility: Assigned Members + Leaders Only
**What**: In the Tasks page, regular members only see tasks they're assigned to. Leaders/admins see all tasks.

**Changes**:
- `src/pages/Tasks.tsx`: After fetching tasks, filter the list — if the user is not a leader, only show tasks where `task_assignments` includes their `user_id`.
- Same filter applied in `src/pages/CalendarView.tsx` for task events on the calendar.

### 3. Activity Timeline in Team Progress
**What**: Under each member's card in Team Progress, show a chronological activity timeline using the existing `activity_log` table. Shows actions like "Created task X", "Uploaded file Y", "Completed task Z".

**Changes**:
- `src/pages/TeamProgress.tsx`: Fetch `activity_log` entries for the project, group by user, and render a timeline under each member card showing their recent actions with timestamps.
- Ensure activity logs are being inserted when key actions happen (task create/update/complete, file upload). Add inserts in `Tasks.tsx` and `Documents.tsx` after successful mutations.

### 4. Notifications Page
**What**: A new Notifications page where members see updates relevant to them — task assignments, status changes, new files on their tasks, meeting updates.

**Database**: Create a `notifications` table:
```sql
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  title text NOT NULL,
  message text,
  type text NOT NULL DEFAULT 'info',
  read boolean NOT NULL DEFAULT false,
  entity_type text,
  entity_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Authenticated can insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
```

**Changes**:
- New `src/pages/Notifications.tsx`: List of notifications with read/unread state, mark as read, mark all as read.
- `src/components/AppSidebar.tsx`: Add Notifications nav item with unread badge.
- `src/App.tsx`: Add `/notifications` route.
- Insert notifications in key flows: task assignment (`Tasks.tsx`), task status change, file upload on a task, meeting creation.

### Files to Create/Edit
- **Create**: `src/pages/Notifications.tsx`
- **Edit**: `src/pages/Documents.tsx`, `src/pages/Tasks.tsx`, `src/pages/TeamProgress.tsx`, `src/pages/CalendarView.tsx`, `src/components/AppSidebar.tsx`, `src/App.tsx`
- **Migration**: Create `notifications` table

