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

function getAuthToken(): string | null {
  return localStorage.getItem('auth_token');
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    headers,
    ...init
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

export type ApiProject = {
  id: string; 
  name: string; 
  progress: number; 
  autoProgress: boolean; 
  tasks: ApiTask[];
  tags?: string[];
  priority?: string;
  deadline?: string;
};
export type ApiTask = {
  id: string; 
  name: string; 
  completed: boolean; 
  projectId: string; 
  assigneeId?: string | null;
  status?: string;
  description?: string;
  comments?: ApiTaskComment[];
};
export type ApiTaskComment = {
  id: string;
  text: string;
  createdAt: string;
  authorId?: string;
};
export type ApiTeamMember = { id: string; name: string };

export const api = {
  listProjects: () => http<ApiProject[]>('/projects'),
  createProject: (data: { name: string; tags?: string[]; priority?: string; deadline?: string }) =>
    http<ApiProject>('/projects', { method: 'POST', body: JSON.stringify(data) }),
  updateProject: (id: string, data: Partial<Pick<ApiProject, 'name' | 'progress' | 'autoProgress' | 'tags' | 'priority' | 'deadline'>>) =>
    http<ApiProject>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProject: (id: string) => fetch(`${API_BASE}/projects/${id}`, { method: 'DELETE' }),
  listTasks: (projectId: string) => http<ApiTask[]>(`/projects/${projectId}/tasks`),
  createTask: (projectId: string, data: { name: string; assigneeId?: string; status?: string; description?: string }) =>
    http<ApiTask>(`/projects/${projectId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updateTask: (projectId: string, taskId: string, data: Partial<Pick<ApiTask, 'name' | 'completed' | 'assigneeId' | 'status' | 'description'>>) =>
    http<ApiTask>(`/projects/${projectId}/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  deleteTask: (projectId: string, taskId: string) =>
    fetch(`${API_BASE}/projects/${projectId}/tasks/${taskId}`, { method: 'DELETE' }),
  addTaskComment: (projectId: string, taskId: string, text: string) =>
    http<ApiTaskComment>(`/projects/${projectId}/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ text })
    }),
  deleteTaskComment: (projectId: string, taskId: string, commentId: string) =>
    fetch(`${API_BASE}/projects/${projectId}/tasks/${taskId}/comments/${commentId}`, { method: 'DELETE' }),
  listTeam: () => http<ApiTeamMember[]>('/team'),
  createMember: (name: string) => http<ApiTeamMember>('/team', { method: 'POST', body: JSON.stringify({ name }) })
};

