## VZNX Workspace Prototype

A concise, production‑shaped prototype for projects, tasks, and team capacity.

- Frontend: React + TypeScript (Vite)
- Backend: Node + Express + MySQL (mysql2)
- Data flow: thin `api.ts` + a single app‑state provider with optimistic updates and debounced writes

## Backend

### Endpoints
- `GET /health`
- `GET /projects` → project summaries (no tasks)
- `POST /projects`
- `PUT /projects/:id` (name | progress | autoProgress)
- `DELETE /projects/:id`
- `GET /projects/:id/tasks`
- `POST /projects/:id/tasks`
- `PUT /projects/:id/tasks/:taskId` (name | completed | assigneeId) — transactional
- `DELETE /projects/:id/tasks/:taskId`
- `GET /team`
- `POST /team`

### Database (MySQL)
Tables:
- `projects(id, name, progress, auto_progress)`
- `tasks(id, name, completed, project_id, assignee_id)`
- `team_members(id, name)`

Indexes:
```sql
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_project_completed ON tasks(project_id, completed);
```

### Performance
- `compression()` enabled to shrink payloads.
- Dashboard fetches summaries only; tasks are fetched on the project page.
- DB pool via `mysql2/promise` with Keep‑Alive.


## Frontend

### Structure
- `src/store.tsx`: global app state (Context) holding projects/team + methods. Handles loading flags, optimistic updates, and debounced writes.
- `src/api.ts`: fetch wrapper and typed endpoints.
- Pages: `Dashboard` (summaries), `ProjectPage` (tasks), `TeamPage` (capacity).
- Components: `Header`, `ProgressBar`, `StatusBadge`, `LoadingOverlay`.

## Getting started

Frontend:
```bash
npm install
npm run dev
```
Open `http://localhost:5173`.

Backend:
```bash
cd server
npm install
# set DATABASE_URL in server/.env
npm run dev   # http://localhost:4000
```



## Notes

- Status: Completed (100), In Progress (tasks exist or progress > 0), Not Started (no tasks & progress = 0).
- “Auto progress from tasks” keeps project progress synced to the completion ratio.


