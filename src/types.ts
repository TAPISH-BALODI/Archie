export type TaskStatus = 'incomplete' | 'complete';

export interface Task {
  id: string;
  name: string;
  completed: boolean;
  assigneeId?: string;
}

export interface Project {
  id: string;
  name: string;
  tasks: Task[];
  progress: number; // 0..100
  autoProgress: boolean; // if true, progress mirrors task completion ratio
}

export interface TeamMember {
  id: string;
  name: string;
}

export interface AppState {
  projects: Project[];
  team: TeamMember[];
}


