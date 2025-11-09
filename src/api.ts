const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
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
  // health/seed
  seed: () => http<{ ok: boolean; seeded: boolean }>('/seed', { method: 'POST' }),

  // projects
  listProjects: () => http<ApiProject[]>('/projects'),
  createProject: (name: string) =>
    http<ApiProject>('/projects', { method: 'POST', body: JSON.stringify({ name }) }),
  updateProject: (id: string, data: Partial<Pick<ApiProject, 'name' | 'progress' | 'autoProgress'>>) =>
    http<ApiProject>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProject: (id: string) => fetch(`${API_URL}/projects/${id}`, { method: 'DELETE' }),

  // tasks
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
    fetch(`${API_URL}/projects/${projectId}/tasks/${taskId}`, { method: 'DELETE' }),

  // team
  listTeam: () => http<ApiTeamMember[]>('/team'),
  createMember: (name: string) => http<ApiTeamMember>('/team', { method: 'POST', body: JSON.stringify({ name }) })
};


