function normalizeBaseUrl(raw?: string): string {
  let base = (raw ?? '').trim();
  if (!base) return 'http://localhost:4000';
  if (base.endsWith('/')) base = base.slice(0, -1);
  if (!/^https?:\/\//i.test(base)) {
    base = `https://${base}`;
  }
  return base;
}

const API_BASE = normalizeBaseUrl(import.meta.env.VITE_API_URL);

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

export type ApiProject = {
  id: string; name: string; progress: number; autoProgress: boolean; tasks: ApiTask[];
};
export type ApiTask = {
  id: string; name: string; completed: boolean; projectId: string; assigneeId?: string | null;
};
export type ApiTeamMember = { id: string; name: string };

export const api = {
  listProjects: () => http<ApiProject[]>('/projects'),
  createProject: (name: string) =>
    http<ApiProject>('/projects', { method: 'POST', body: JSON.stringify({ name }) }),
  updateProject: (id: string, data: Partial<Pick<ApiProject, 'name' | 'progress' | 'autoProgress'>>) =>
    http<ApiProject>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProject: (id: string) => fetch(`${API_BASE}/projects/${id}`, { method: 'DELETE' }),
  listTasks: (projectId: string) => http<ApiTask[]>(`/projects/${projectId}/tasks`),
  createTask: (projectId: string, name: string, assigneeId?: string) =>
    http<ApiTask>(`/projects/${projectId}/tasks`, {
      method: 'POST',
      body: JSON.stringify({ name, assigneeId })
    }),
  updateTask: (projectId: string, taskId: string, data: Partial<Pick<ApiTask, 'name' | 'completed' | 'assigneeId'>>) =>
    http<ApiTask>(`/projects/${projectId}/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  deleteTask: (projectId: string, taskId: string) =>
    fetch(`${API_BASE}/projects/${projectId}/tasks/${taskId}`, { method: 'DELETE' }),
  listTeam: () => http<ApiTeamMember[]>('/team'),
  createMember: (name: string) => http<ApiTeamMember>('/team', { method: 'POST', body: JSON.stringify({ name }) })
};


