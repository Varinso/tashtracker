
# Research Hub — Student Project Collaboration Platform

## Overview
A dashboard-heavy project collaboration tool for university teams, with full authentication, role-based access, file management, and a project calendar with daily/weekly/monthly views.

## Pages & Layout

### 1. Auth Pages
- **Login / Signup** with email/password
- Role assignment on invite (Admin, Project Leader, Member)

### 2. Dashboard (Home)
- **Project overview cards** showing completion % with progress bars
- **Upcoming deadlines** widget
- **Recent activity timeline** (file uploads, comments, task updates)
- **Quick stats**: total tasks, completed, overdue, team members online

### 3. Tasks & Events
- **Task list view** with filters (status, assignee, phase)
- **Create/edit task dialog**: title, description, deadline, assigned members, phase tag
- **Task detail page**: description, file uploads section, discussion thread, activity log
- Status workflow: To Do → In Progress → Review → Done

### 4. Project Calendar
- **Monthly view**: grid with event dots
- **Weekly view**: time-based layout
- **Daily view**: detailed schedule
- Events include tasks, deadlines, and meetings

### 5. Document Repository
- **File browser** with search and tag filtering
- Upload files (PDF, DOCX, XLSX, images) with metadata (uploader, date, description)
- Version history per file
- Organized by task/phase

### 6. Meeting Notes
- Create and browse meeting notes linked to dates
- Attach action items to tasks

### 7. Team Management
- Invite members via email
- Assign roles (Admin, Project Leader, Member)
- View team directory

## Database Structure (Supabase/Cloud)
- **projects**: id, name, description, created_by
- **user_roles**: id, user_id, role (admin/leader/member)
- **project_members**: project_id, user_id
- **tasks**: id, project_id, title, description, deadline, status, phase, created_by
- **task_assignments**: task_id, user_id
- **comments**: id, task_id, user_id, content, created_at
- **files**: id, task_id, project_id, uploaded_by, file_url, description, version, tags
- **meetings**: id, project_id, title, date, notes
- **activity_log**: id, project_id, user_id, action, entity_type, entity_id, created_at
- **Storage bucket** for document uploads

## Key UX Details
- Sidebar navigation with project switcher
- Dashboard-first layout with prominent charts (recharts) and progress indicators
- Toast notifications for deadline reminders
- Clean, modern design with card-based layouts
- Responsive for laptop and tablet use

## Implementation Phases
1. **Auth + Database setup** — login, signup, profiles, roles, project creation
2. **Dashboard + Task management** — CRUD tasks, assignments, status tracking, progress charts
3. **Calendar views** — daily/weekly/monthly with task deadlines
4. **File uploads + Document repository** — storage bucket, versioning, search/tags
5. **Comments + Activity feed** — discussion threads, activity timeline
6. **Meeting notes + Team management** — notes, invites, role management
