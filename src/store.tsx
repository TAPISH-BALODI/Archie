import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { AppState, Project, Task, TeamMember } from './types';
import { api, type ApiProject, type ApiTask } from './api';

type Methods = {
  reload: () => Promise<void>;
  addProject: (name: string) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  setProjectProgress: (projectId: string, progress: number) => Promise<void>;
  toggleProjectAuto: (projectId: string, auto: boolean) => Promise<void>;
  loadProjectTasks: (projectId: string) => Promise<void>;
  addTask: (projectId: string, name: string, assigneeId?: string) => Promise<void>;
  toggleTask: (projectId: string, taskId: string) => Promise<void>;
  deleteTask: (projectId: string, taskId: string) => Promise<void>;
  assignTask: (projectId: string, taskId: string, assigneeId?: string) => Promise<void>;
  addTeamMember: (name: string) => Promise<void>;
};

type Ctx = { state: AppState; methods: Methods; loading: boolean; error?: string };

const AppStateContext = createContext<Ctx | null>(null);

function toState(projects: ApiProject[], team: TeamMember[]): AppState {
  return { projects: projects as unknown as Project[], team };
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>({ projects: [], team: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const inFlight = useRef(0);
  const assignmentTimers = useRef<Map<string, any>>(new Map());
  const progressTimers = useRef<Map<string, any>>(new Map());
  const createTaskTimers = useRef<Map<string, any>>(new Map());

  function computeProgressFromTasks(tasks: Task[]): number {
    if (!tasks.length) return 0;
    const done = tasks.filter(t => t.completed).length;
    return Math.round((done / tasks.length) * 100);
  }

  const begin = () => {
    inFlight.current += 1;
    setLoading(true);
  };
  const end = () => {
    inFlight.current = Math.max(0, inFlight.current - 1);
    if (inFlight.current === 0) setLoading(false);
  };

  async function loadAll() {
    begin();
    setError(undefined);
    try {
      const [projects, team] = await Promise.all([api.listProjects(), api.listTeam()]);
      setState(toState(projects, team));
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load');
    } finally { end(); }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  const methods: Methods = {
    reload: loadAll,
    loadProjectTasks: async (projectId: string) => {
      begin();
      try {
        const tasks = await api.listTasks(projectId);
        setState(prev => ({
          ...prev,
          projects: prev.projects.map(p =>
            p.id === projectId ? { ...p, tasks: tasks as unknown as Task[] } : p
          )
        }));
      } finally { end(); }
    },
    addProject: async (name: string) => {
      begin(); try { await api.createProject(name); await loadAll(); } finally { end(); }
    },
    deleteProject: async (projectId: string) => {
      begin(); try { await api.deleteProject(projectId); await loadAll(); } finally { end(); }
    },
    setProjectProgress: async (projectId: string, progress: number) => {
      const clamped = Math.max(0, Math.min(100, Math.round(progress)));
      const prev = state.projects.find(p => p.id === projectId)?.progress;
      setState(prevState => ({
        ...prevState,
        projects: prevState.projects.map(p => (p.id === projectId ? { ...p, progress: clamped } : p))
      }));
      const existing = progressTimers.current.get(projectId);
      if (existing) clearTimeout(existing);
      const tid = setTimeout(async () => {
        try { await api.updateProject(projectId, { progress: clamped }); }
        catch {
          if (typeof prev === 'number') {
            setState(prevState => ({
              ...prevState,
              projects: prevState.projects.map(p => (p.id === projectId ? { ...p, progress: prev } : p))
            }));
          }
        } finally { progressTimers.current.delete(projectId); }
      }, 500);
      progressTimers.current.set(projectId, tid);
    },
    toggleProjectAuto: async (projectId: string, auto: boolean) => {
      begin(); try { await api.updateProject(projectId, { autoProgress: auto }); await loadAll(); } finally { end(); }
    },
    addTask: async (projectId: string, name: string, assigneeId?: string) => {
      const tempId = `temp_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
      const safeName = name.trim() || 'Untitled Task';
      setState(prev => ({
        ...prev,
        projects: prev.projects.map(p => {
          if (p.id !== projectId) return p;
          const tasks: Task[] = [{ id: tempId, name: safeName, completed: false, assigneeId }, ...p.tasks];
          const progress = p.autoProgress ? computeProgressFromTasks(tasks) : p.progress;
          return { ...p, tasks, progress };
        })
      }));
      const existing = createTaskTimers.current.get(tempId);
      if (existing) clearTimeout(existing);
      const tid = setTimeout(async () => {
        try {
          const created = await api.createTask(projectId, safeName, assigneeId);
          setState(prev => ({
            ...prev,
            projects: prev.projects.map(p => {
              if (p.id !== projectId) return p;
              const tasks = p.tasks.map(t =>
                t.id === tempId
                  ? ({
                      id: created.id,
                      name: created.name,
                      completed: created.completed,
                      assigneeId: created.assigneeId ?? undefined
                    } as unknown as Task)
                  : t
              );
              const progress = p.autoProgress ? computeProgressFromTasks(tasks as unknown as Task[]) : p.progress;
              return { ...p, tasks: tasks as unknown as Task[], progress };
            })
          }));
        } catch {
          setState(prev => ({
            ...prev,
            projects: prev.projects.map(p => {
              if (p.id !== projectId) return p;
              const tasks = p.tasks.filter(t => t.id !== tempId);
              const progress = p.autoProgress ? computeProgressFromTasks(tasks as unknown as Task[]) : p.progress;
              return { ...p, tasks: tasks as unknown as Task[], progress };
            })
          }));
        } finally {
          createTaskTimers.current.delete(tempId);
        }
      }, 400);
      createTaskTimers.current.set(tempId, tid);
    },
    toggleTask: async (projectId: string, taskId: string) => {
      // Optimistic update without global loading
      const project = state.projects.find(p => p.id === projectId);
      const task = project?.tasks.find(t => t.id === taskId);
      if (!project || !task) {
        // fallback: just fire request
        await api.updateTask(projectId, taskId, { completed: true });
        await methods.loadProjectTasks(projectId);
        return;
      }
      const nextCompleted = !task.completed;
      const prevState = state;
      // optimistic toggle and progress recompute
      setState(prev => ({
        ...prev,
        projects: prev.projects.map(p => {
          if (p.id !== projectId) return p;
          const tasks = p.tasks.map(t => (t.id === taskId ? { ...t, completed: nextCompleted } : t));
          const progress = p.autoProgress ? computeProgressFromTasks(tasks as unknown as Task[]) : p.progress;
          return { ...p, tasks: tasks as unknown as Task[], progress };
        })
      }));
      try {
        await api.updateTask(projectId, taskId, { completed: nextCompleted });
      } catch (e) {
        // revert on error
        setState(prevState);
      }
    },
    deleteTask: async (projectId: string, taskId: string) => {
      begin(); try { await api.deleteTask(projectId, taskId); await loadAll(); } finally { end(); }
    },
    assignTask: async (projectId: string, taskId: string, assigneeId?: string) => {
      setState(prev => ({
        ...prev,
        projects: prev.projects.map(p => {
          if (p.id !== projectId) return p;
          return { ...p, tasks: p.tasks.map(t => (t.id === taskId ? { ...t, assigneeId: assigneeId } : t)) };
        })
      }));
      const key = `${projectId}:${taskId}`;
      const existing = assignmentTimers.current.get(key);
      if (existing) clearTimeout(existing);
      const timeoutId = setTimeout(async () => {
        begin();
        try {
          const updated: ApiTask = await api.updateTask(projectId, taskId, { assigneeId: assigneeId ?? null });
          setState(prev => ({
            ...prev,
            projects: prev.projects.map(p => {
              if (p.id !== projectId) return p;
              return {
                ...p,
                tasks: p.tasks.map(t => (t.id === taskId ? ({
                  id: updated.id,
                  name: updated.name,
                  completed: updated.completed,
                  assigneeId: updated.assigneeId ?? undefined
                } as unknown as Task) : t))
              };
            })
          }));
        } finally {
          end();
          assignmentTimers.current.delete(key);
        }
      }, 500);
      assignmentTimers.current.set(key, timeoutId);
    },
    addTeamMember: async (name: string) => {
      begin(); try { await api.createMember(name); await loadAll(); } finally { end(); }
    }
  };

  const value: Ctx = useMemo(
    () => ({ state, methods, loading, error }),
    [state, methods, loading, error]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): Ctx {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}

export function getProjectStatus(p: Project): 'Completed' | 'In Progress' | 'Not Started' {
  if (p.progress >= 100) return 'Completed';
  if (p.tasks.length > 0 || p.progress > 0) return 'In Progress';
  return 'Not Started';
}


