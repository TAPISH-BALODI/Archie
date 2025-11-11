export type TaskStatus = 'incomplete' | 'complete';
export type TaskWorkStatus = 'draft' | 'version' | 'active';
export type ProjectPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface TaskComment {
  id: string;
  text: string;
  createdAt: string;
  authorId?: string;
}

export interface Task {
  id: string;
  name: string;
  completed: boolean;
  assigneeId?: string;
  status?: TaskWorkStatus;
  description?: string;
  comments?: TaskComment[];
}

export interface Project {
  id: string;
  name: string;
  tasks: Task[];
  progress: number; 
  autoProgress: boolean; // if true, progress mirrors task completion ratio
  tags?: string[];
  priority?: ProjectPriority;
  deadline?: string; // ISO date string
}

export interface TeamMember {
  id: string;
  name: string;
}

export interface AppState {
  projects: Project[];
  team: TeamMember[];
}

