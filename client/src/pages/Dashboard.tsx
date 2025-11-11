import { useNavigate } from 'react-router-dom';
import { useAppState, getProjectStatus } from '../store';
import { ProgressBar } from '../components/ProgressBar';
import { StatusBadge } from '../components/StatusBadge';
import { useState, useMemo } from 'react';

export function Dashboard() {
  const { state, methods, loading, error } = useAppState();
  const [name, setName] = useState('');
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [projectForm, setProjectForm] = useState({
    name: '',
    tags: [] as string[],
    tagInput: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    deadline: ''
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Completed' | 'In Progress' | 'Not Started'>('all');
  const navigate = useNavigate();

  const filteredProjects = useMemo(() => {
    let filtered = state.projects ?? [];
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(query) ||
        (p.tasks ?? []).some(t => t.name.toLowerCase().includes(query))
      );
    }
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => getProjectStatus(p) === statusFilter);
    }
    
    return filtered;
  }, [state.projects, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    const total = state.projects.length;
    const completed = state.projects.filter(p => getProjectStatus(p) === 'Completed').length;
    const inProgress = state.projects.filter(p => getProjectStatus(p) === 'In Progress').length;
    const notStarted = state.projects.filter(p => getProjectStatus(p) === 'Not Started').length;
    const totalTasks = state.projects.reduce((sum, p) => sum + (p.tasks?.length ?? 0), 0);
    const completedTasks = state.projects.reduce((sum, p) => 
      sum + (p.tasks?.filter(t => t.completed).length ?? 0), 0);
    return { total, completed, inProgress, notStarted, totalTasks, completedTasks };
  }, [state.projects]);

  return (
    <div className="container" style={{ display: 'grid', gap: 16 }}>
      <div className="card" style={{ display: 'grid', gap: 12 }}>
        <div className="title">Overview</div>
        <div className="grid grid-4" style={{ gap: 12 }}>
          <div className="stat-card">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Projects</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.completed}</div>
            <div className="stat-label">Completed</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.inProgress}</div>
            <div className="stat-label">In Progress</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0}%</div>
            <div className="stat-label">Tasks Complete</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ display: 'grid', gap: 10 }}>
        <div className="space-between">
          <div className="title">Projects</div>
          <div className="row" style={{ gap: 8 }}>
            <input
              className="input"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ maxWidth: 240 }}
              onKeyDown={e => {
                if (e.key === 'Escape') setSearchQuery('');
              }}
            />
            <select
              className="select"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              style={{ maxWidth: 160 }}
            >
              <option value="all">All Status</option>
              <option value="Not Started">Not Started</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
        </div>
        {loading && <div className="muted">Loading...</div>}
        {error && <div className="muted">Error: {error}</div>}
        {!showProjectForm ? (
          <div className="row wrap">
            <input
              className="input"
              placeholder="New project name"
              value={name}
              onChange={e => setName(e.target.value)}
              style={{ maxWidth: 360 }}
              disabled={loading}
              onKeyDown={e => {
                if (e.key === 'Enter' && name.trim()) {
                  methods.addProject(name);
                  setName('');
                }
              }}
            />
            <button
              className="btn primary"
              onClick={() => {
                if (!name.trim()) return;
                methods.addProject(name);
                setName('');
              }}
              disabled={loading}
            >
              Add Project
            </button>
            <button
              className="btn"
              onClick={() => {
                setShowProjectForm(true);
                setProjectForm({ name: '', tags: [], tagInput: '', priority: 'medium', deadline: '' });
              }}
              disabled={loading}
            >
              Create with Details
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12, padding: 12, background: '#f8fafc', borderRadius: 8 }}>
            <div className="row wrap" style={{ gap: 12 }}>
              <input
                className="input"
                placeholder="Project name *"
                value={projectForm.name}
                onChange={e => setProjectForm({ ...projectForm, name: e.target.value })}
                style={{ flex: 1, minWidth: 200 }}
              />
              <select
                className="select"
                value={projectForm.priority}
                onChange={e => setProjectForm({ ...projectForm, priority: e.target.value as any })}
                style={{ width: 140 }}
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
                <option value="urgent">Urgent</option>
              </select>
              <input
                type="date"
                className="input"
                placeholder="Deadline"
                value={projectForm.deadline}
                onChange={e => setProjectForm({ ...projectForm, deadline: e.target.value })}
                style={{ width: 160 }}
              />
            </div>
            <div className="row wrap" style={{ gap: 8 }}>
              <input
                className="input"
                placeholder="Add tag (press Enter)"
                value={projectForm.tagInput}
                onChange={e => setProjectForm({ ...projectForm, tagInput: e.target.value })}
                onKeyDown={e => {
                  if (e.key === 'Enter' && projectForm.tagInput.trim()) {
                    if (!projectForm.tags.includes(projectForm.tagInput.trim())) {
                      setProjectForm({
                        ...projectForm,
                        tags: [...projectForm.tags, projectForm.tagInput.trim()],
                        tagInput: ''
                      });
                    }
                  }
                }}
                style={{ flex: 1, minWidth: 200 }}
              />
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                {projectForm.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="tag-badge"
                    onClick={() => {
                      setProjectForm({
                        ...projectForm,
                        tags: projectForm.tags.filter((_, idx) => idx !== i)
                      });
                    }}
                  >
                    {tag} ×
                  </span>
                ))}
              </div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button
                className="btn primary"
                onClick={() => {
                  if (!projectForm.name.trim()) return;
                  methods.addProjectWithDetails({
                    name: projectForm.name,
                    tags: projectForm.tags,
                    priority: projectForm.priority,
                    deadline: projectForm.deadline || undefined
                  });
                  setShowProjectForm(false);
                  setProjectForm({ name: '', tags: [], tagInput: '', priority: 'medium', deadline: '' });
                }}
                disabled={loading || !projectForm.name.trim()}
              >
                Create Project
              </button>
              <button
                className="btn"
                onClick={() => {
                  setShowProjectForm(false);
                  setProjectForm({ name: '', tags: [], tagInput: '', priority: 'medium', deadline: '' });
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-3">
        {filteredProjects.map(p => {
          const status = getProjectStatus(p);
          return (
            <div
              className="card project-card"
              key={p.id}
              style={{ display: 'grid', gap: 10, cursor: 'pointer' }}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/projects/${p.id}`)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate(`/projects/${p.id}`);
                }
              }}
            >
              <div className="space-between">
                <div style={{ display: 'grid', gap: 4, minWidth: 0, flex: 1 }}>
                  <div className="title" title={p.name} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.name}
                  </div>
                  <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                    {p.priority && (
                      <span className={`priority-badge priority-${p.priority}`}>
                        {p.priority}
                      </span>
                    )}
                    {p.tags && p.tags.length > 0 && p.tags.slice(0, 2).map((tag, i) => (
                      <span key={i} className="tag-badge-small">{tag}</span>
                    ))}
                    {p.deadline && (
                      <span className="muted" style={{ fontSize: 11 }}>
                        {new Date(p.deadline).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <StatusBadge status={status} />
              </div>
              <div style={{ display: 'grid', gap: 4 }}>
                <ProgressBar percent={p.progress} />
                <div className="row muted" style={{ fontSize: 11 }}>
                  {(p.tasks ?? []).length} task{(p.tasks ?? []).length !== 1 ? 's' : ''}
                  {(p.tasks ?? []).length > 0 && (
                    <> • {p.tasks.filter(t => t.completed).length} complete</>
                  )}
                </div>
              </div>
              <div className="row">
                <label className="row" style={{ gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={p.autoProgress}
                    onChange={e => methods.toggleProjectAuto(p.id, e.target.checked)}
                    onClick={e => e.stopPropagation()}
                  />
                  Auto progress from tasks
                </label>
              </div>
              {!p.autoProgress && (
                <div className="row">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={p.progress}
                    onChange={e => methods.setProjectProgress(p.id, Number(e.target.value))}
                    style={{ width: '100%' }}
                    onClick={e => e.stopPropagation()}
                  />
                  <div style={{ width: 44, textAlign: 'right' }}>{p.progress}%</div>
                </div>
              )}
              <div className="space-between">
                <button
                  className="btn danger"
                  onClick={e => {
                    e.stopPropagation();
                    methods.deleteProject(p.id);
                  }}
                  title="Delete project"
                  disabled={loading}
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {state.projects.length === 0 && (
        <div className="card muted">No projects yet. Create your first project above.</div>
      )}
      {state.projects.length > 0 && filteredProjects.length === 0 && (
        <div className="card muted">No projects match your search criteria.</div>
      )}
    </div>
  );
}

