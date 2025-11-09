import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAppState } from '../store';
import { useEffect, useMemo, useState } from 'react';
import { ProgressBar } from '../components/ProgressBar';
import { StatusBadge } from '../components/StatusBadge';

export function ProjectPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { state, methods, loading } = useAppState();
  const project = useMemo(() => (state.projects ?? []).find(p => p.id === projectId), [state.projects, projectId]);
  const [taskName, setTaskName] = useState('');
  const [assigneeId, setAssigneeId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!projectId) return;
    const needsTasks = project && (!project.tasks || project.tasks.length === 0);
    if (needsTasks) {
      void methods.loadProjectTasks(project.id);
    }
  }, [projectId, project]);

  if (!project) {
    return (
      <div className="container">
        <div className="card">
          <div className="row">
            <div className="title">Project not found</div>
            <button className="btn" onClick={() => navigate('/')}>Back to Projects</button>
          </div>
        </div>
      </div>
    );
  }

  const completedCount = (project.tasks ?? []).filter(t => t.completed).length;
  const status = project.progress >= 100 ? 'Completed' : (project.tasks ?? []).length > 0 || project.progress > 0 ? 'In Progress' : 'Not Started';

  return (
    <div className="container" style={{ display: 'grid', gap: 16 }}>
      <div className="row">
        <Link className="btn" to="/">← Back</Link>
      </div>

      <div className="card" style={{ display: 'grid', gap: 10 }}>
        <div className="space-between">
          <div className="title">{project.name}</div>
          <StatusBadge status={status} />
        </div>
        <div className="row muted">{completedCount} / {(project.tasks ?? []).length} tasks complete</div>
        <ProgressBar percent={project.progress} />
        <div className="row">
          <label className="row" style={{ gap: 6 }}>
            <input
              type="checkbox"
              checked={project.autoProgress}
              onChange={e => methods.toggleProjectAuto(project.id, e.target.checked)}
            />
            Auto progress from tasks
          </label>
        </div>
        {!project.autoProgress && (
          <div className="row">
            <input
              type="range"
              min={0}
              max={100}
              value={project.progress}
              onChange={e => methods.setProjectProgress(project.id, Number(e.target.value))}
              style={{ width: '100%' }}
              disabled={loading}
            />
            <div style={{ width: 44, textAlign: 'right' }}>{project.progress}%</div>
          </div>
        )}
      </div>

      <div className="card" style={{ display: 'grid', gap: 12 }}>
        <div className="title">Tasks</div>
        <div className="row wrap">
          <input
            className="input"
            placeholder="Task name"
            value={taskName}
            onChange={e => setTaskName(e.target.value)}
            style={{ maxWidth: 360 }}
          />
          <select
            className="select"
            value={assigneeId ?? ''}
            onChange={e => setAssigneeId(e.target.value || undefined)}
            style={{ maxWidth: 220 }}
            disabled={loading}
          >
            <option value="">Unassigned</option>
            {(state.team ?? []).map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <button
            className="btn primary"
            onClick={() => {
              if (!taskName.trim()) return;
              methods.addTask(project.id, taskName, assigneeId);
              setTaskName('');
              setAssigneeId(undefined);
            }}
            disabled={loading}
          >
            Add Task
          </button>
        </div>

        <div className="list">
          {(project?.tasks ?? []).map(t => {
            const member = (state.team ?? []).find(m => m.id === t.assigneeId);
            return (
              <div className="list-item" key={t.id}>
                <div className="row" style={{ minWidth: 0 }}>
                  <input
                    type="checkbox"
                    checked={t.completed}
                    onChange={() => methods.toggleTask(project.id, t.id)}
                    disabled={loading}
                  />
                  <div className={t.completed ? 'strike' : ''} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.name}
                  </div>
                  <span className="muted">•</span>
                  <select
                    className="select"
                    value={t.assigneeId ?? ''}
                    onChange={e => methods.assignTask(project.id, t.id, e.target.value || undefined)}
                    style={{ width: 180 }}
                    disabled={loading}
                  >
                    <option value="">Unassigned</option>
                    {(state.team ?? []).map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                  {member && <span className="muted">({member.name})</span>}
                </div>
                <button
                  className="btn"
                  onClick={() => methods.deleteTask(project.id, t.id)}
                  title="Delete task"
                  disabled={loading}
                >
                  Remove
                </button>
              </div>
            );
          })}
          {project?.tasks?.length === 0 && <div className="muted">No tasks yet. Add your first task above.</div>}
        </div>
      </div>
    </div>
  );
}

