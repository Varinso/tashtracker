

## Plan: Kanban Board with Priority and Drag-and-Drop

### Database Change
Add a `priority` column to the `tasks` table:
- Migration: `ALTER TABLE public.tasks ADD COLUMN priority text DEFAULT 'medium';`
- Values: `low`, `medium`, `high`, `urgent`

### Frontend Changes (src/pages/Tasks.tsx)

**1. Add view toggle (List / Kanban)**
- Toggle button in the header to switch between current list view and new Kanban board view
- Persist selection in component state

**2. Kanban Board View**
- 4 columns: To Do, In Progress, Review, Done
- Use native HTML5 drag-and-drop (`onDragStart`, `onDragOver`, `onDrop`) -- no extra library needed
- Dropping a task card onto a different column calls `updateStatus()` to persist
- Each column shows its task cards with priority badge, assignees, deadline

**3. Priority Field**
- Add `priority` state to the create/edit form with a Select dropdown (Low / Medium / High / Urgent)
- Display priority as a colored badge on each task card:
  - Urgent: red, High: orange, Medium: yellow, Low: gray
- Include priority in `taskData` for insert/update

**4. Sorting: Done tasks pushed to bottom**
- Sort tasks within each view so `done` tasks appear last
- Secondary sort by priority weight (urgent > high > medium > low)
- Then by created_at descending

### Files Modified
- `supabase/migrations/` -- new migration for `priority` column
- `src/pages/Tasks.tsx` -- rewrite to include Kanban view, priority, sorting
- `src/integrations/supabase/types.ts` -- auto-updated

