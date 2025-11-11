import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAppState } from '../store';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ProgressBar } from '../components/ProgressBar';
import { StatusBadge } from '../components/StatusBadge';

export function ProjectPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { state, methods, loading } = useAppState();
  const project = useMemo(() => (state.projects ?? []).find(p => p.id === projectId), [state.projects, projectId]);
  const [taskName, setTaskName] = useState('');
  const [assigneeId, setAssigneeId] = useState<string | undefined>(undefined);
  const [taskStatus, setTaskStatus] = useState<'draft' | 'version' | 'active'>('active');
  const [taskDescription, setTaskDescription] = useState('');
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskSearch, setTaskSearch] = useState('');
  const [taskFilter, setTaskFilter] = useState<'all' | 'completed' | 'incomplete' | 'unassigned'>('all');
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [commentTexts, setCommentTexts] = useState<Map<string, string>>(new Map());
  const loadedProjectIdRef = useRef<string | null>(null);

  const assignmentSuggestions = useMemo(() => {
    if (!state.team.length || !project?.tasks) return [];
    
    const taskCountByMember = new Map<string, number>();
    for (const p of state.projects) {
      for (const t of (p.tasks ?? [])) {
        if (t.assigneeId && !t.completed) {
          taskCountByMember.set(t.assigneeId, (taskCountByMember.get(t.assigneeId) ?? 0) + 1);
        }
      }
    }
    
    const suggestions = state.team
      .map(m => ({
        id: m.id,
        name: m.name,
        taskCount: taskCountByMember.get(m.id) ?? 0
      }))
      .sort((a, b) => a.taskCount - b.taskCount)
      .slice(0, 3);
    
    return suggestions;
  }, [state.team, state.projects, project]);

  const projectHealth = useMemo(() => {
    if (!project) return null;
    const tasks = project.tasks ?? [];
    if (tasks.length === 0) return { level: 'good', message: 'No tasks yet' };
    
    const completed = tasks.filter(t => t.completed).length;
    const unassigned = tasks.filter(t => !t.assigneeId && !t.completed).length;
    const completionRate = completed / tasks.length;
    
    if (completionRate >= 0.8) {
      return { level: 'good', message: 'On track' };
    } else if (completionRate >= 0.5) {
      return { level: 'warning', message: unassigned > 0 ? `${unassigned} unassigned tasks` : 'Needs attention' };
    } else {
      return { level: 'critical', message: unassigned > 0 ? `${unassigned} unassigned, ${Math.round((1 - completionRate) * 100)}% incomplete` : 'Behind schedule' };
    }
  }, [project]);


  const filteredTasks = useMemo(() => {
    if (!project?.tasks) return [];
    let filtered = project.tasks;
    
    if (taskSearch.trim()) {
      const query = taskSearch.toLowerCase();
      filtered = filtered.filter(t => t.name.toLowerCase().includes(query));
    }
    
    if (taskFilter === 'completed') {
      filtered = filtered.filter(t => t.completed);
    } else if (taskFilter === 'incomplete') {
      filtered = filtered.filter(t => !t.completed);
    } else if (taskFilter === 'unassigned') {
      filtered = filtered.filter(t => !t.assigneeId);
    }
    
    return filtered;
  }, [project?.tasks, taskSearch, taskFilter]);

  useEffect(() => {
    if (!projectId || !project) return;
   
    const tasksNotLoaded = project.tasks === undefined || 
      (Array.isArray(project.tasks) && project.tasks.length === 0 && loadedProjectIdRef.current !== projectId);
    
    if (tasksNotLoaded) {
      loadedProjectIdRef.current = projectId;
      void methods.loadProjectTasks(project.id);
    }
  }, [projectId, project, methods]);

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
          <div className="row" style={{ gap: 8 }}>
            {projectHealth && (
              <span className={`health-indicator health-${projectHealth.level}`}>
                {projectHealth.message}
              </span>
            )}
            <StatusBadge status={status} />
          </div>
        </div>
        <div className="row muted">{completedCount} / {(project.tasks ?? []).length} tasks complete</div>
        <ProgressBar percent={project.progress} />
        {assignmentSuggestions.length > 0 && (
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <span className="muted" style={{ fontSize: 12 }}>Suggested assignees:</span>
            {assignmentSuggestions.map(s => (
              <span
                key={s.id}
                className="suggestion-badge"
                onClick={() => {
                  if (taskName.trim()) {
                    setAssigneeId(s.id);
                  }
                }}
                title={`${s.name} has ${s.taskCount} task${s.taskCount !== 1 ? 's' : ''}`}
              >
                {s.name} ({s.taskCount})
              </span>
            ))}
          </div>
        )}
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
        <div className="space-between">
          <div className="title">Tasks</div>
          <div className="row" style={{ gap: 8 }}>
            <input
              className="input"
              placeholder="Search tasks..."
              value={taskSearch}
              onChange={e => setTaskSearch(e.target.value)}
              style={{ maxWidth: 180 }}
              onKeyDown={e => {
                if (e.key === 'Escape') setTaskSearch('');
              }}
            />
            <select
              className="select"
              value={taskFilter}
              onChange={e => setTaskFilter(e.target.value as any)}
              style={{ maxWidth: 140 }}
            >
              <option value="all">All</option>
              <option value="incomplete">Incomplete</option>
              <option value="completed">Completed</option>
              <option value="unassigned">Unassigned</option>
            </select>
            <button
              className="btn"
              onClick={() => {
                setBulkMode(!bulkMode);
                setSelectedTasks(new Set());
              }}
              style={{ fontSize: 12 }}
            >
              {bulkMode ? 'Cancel' : 'Bulk Select'}
            </button>
          </div>
        </div>
        {bulkMode && selectedTasks.size > 0 && (
          <div className="row" style={{ gap: 8, padding: 8, background: '#f8fafc', borderRadius: 8 }}>
            <span className="muted" style={{ fontSize: 12 }}>
              {selectedTasks.size} task{selectedTasks.size !== 1 ? 's' : ''} selected
            </span>
            <button
              className="btn"
              onClick={async () => {
                for (const taskId of selectedTasks) {
                  const task = project?.tasks?.find(t => t.id === taskId);
                  if (task && !task.completed) {
                    await methods.toggleTask(project.id, taskId);
                  }
                }
                setSelectedTasks(new Set());
                setBulkMode(false);
              }}
              style={{ fontSize: 12 }}
            >
              Complete Selected
            </button>
            <button
              className="btn danger"
              onClick={async () => {
                if (confirm(`Delete ${selectedTasks.size} task${selectedTasks.size !== 1 ? 's' : ''}?`)) {
                  for (const taskId of selectedTasks) {
                    await methods.deleteTask(project.id, taskId);
                  }
                  setSelectedTasks(new Set());
                  setBulkMode(false);
                }
              }}
              style={{ fontSize: 12 }}
            >
              Delete Selected
            </button>
          </div>
        )}
        {!showTaskForm ? (
          <div className="row wrap">
            <input
              className="input"
              placeholder="Task name"
              value={taskName}
              onChange={e => setTaskName(e.target.value)}
              style={{ maxWidth: 360 }}
              onKeyDown={e => {
                if (e.key === 'Enter' && taskName.trim()) {
                  methods.addTask(project.id, taskName, assigneeId);
                  setTaskName('');
                  setAssigneeId(undefined);
                }
              }}
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
            <button
              className="btn"
              onClick={() => {
                setShowTaskForm(true);
                setTaskName('');
                setTaskDescription('');
                setTaskStatus('active');
              }}
            >
              Add with Details
            </button>
          </div>
        ) : (
          <div className="task-editor">
            <div className="row wrap" style={{ gap: 12 }}>
              <input
                className="input"
                placeholder="Task name *"
                value={taskName}
                onChange={e => setTaskName(e.target.value)}
                style={{ flex: 1, minWidth: 200 }}
              />
              <select
                className="select"
                value={taskStatus}
                onChange={e => setTaskStatus(e.target.value as any)}
                style={{ width: 120 }}
              >
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="version">Version</option>
              </select>
              <select
                className="select"
                value={assigneeId ?? ''}
                onChange={e => setAssigneeId(e.target.value || undefined)}
                style={{ width: 180 }}
                disabled={loading}
              >
                <option value="">Unassigned</option>
                {(state.team ?? []).map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <textarea
              className="input task-description"
              placeholder="Task description (optional)"
              value={taskDescription}
              onChange={e => setTaskDescription(e.target.value)}
            />
            <div className="row" style={{ gap: 8 }}>
              <button
                className="btn primary"
                onClick={() => {
                  if (!taskName.trim()) return;
                  methods.addTask(project.id, taskName, assigneeId, taskStatus, taskDescription);
                  setTaskName('');
                  setTaskDescription('');
                  setAssigneeId(undefined);
                  setTaskStatus('active');
                  setShowTaskForm(false);
                }}
                disabled={loading || !taskName.trim()}
              >
                Create Task
              </button>
              <button
                className="btn"
                onClick={() => {
                  setShowTaskForm(false);
                  setTaskName('');
                  setTaskDescription('');
                  setTaskStatus('active');
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="list">
          {filteredTasks.map(t => {
            const member = (state.team ?? []).find(m => m.id === t.assigneeId);
            const isSelected = selectedTasks.has(t.id);
            if (!project) return null;
            return (
              <div key={t.id}>
                <div 
                  className="list-item" 
                  style={{
                    background: isSelected ? '#dbeafe' : undefined,
                    borderColor: isSelected ? '#3b82f6' : undefined
                  }}
                >
                <div className="row" style={{ minWidth: 0 }}>
                  {bulkMode ? (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {
                        const newSelected = new Set(selectedTasks);
                        if (isSelected) {
                          newSelected.delete(t.id);
                        } else {
                          newSelected.add(t.id);
                        }
                        setSelectedTasks(newSelected);
                      }}
                    />
                  ) : (
                    <input
                      type="checkbox"
                      checked={t.completed}
                      onChange={() => methods.toggleTask(project.id, t.id)}
                      disabled={loading}
                    />
                  )}
                  <div className={t.completed ? 'strike' : ''} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {t.name}
                  </div>
                  {t.status && t.status !== 'active' && (
                    <span className={`task-status-badge task-status-${t.status}`}>
                      {t.status}
                    </span>
                  )}
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
                <div className="row" style={{ gap: 8 }}>
                  <button
                    className="btn"
                    onClick={() => setExpandedTask(expandedTask === t.id ? null : t.id)}
                    title="View details"
                    style={{ fontSize: 12 }}
                  >
                    {expandedTask === t.id ? 'Hide' : 'Details'}
                  </button>
                  <button
                    className="btn"
                    onClick={() => methods.deleteTask(project.id, t.id)}
                    title="Delete task"
                    disabled={loading}
                  >
                    Remove
                  </button>
                </div>
              </div>
              {expandedTask === t.id && project && (
                <div style={{ padding: '12px 0', borderTop: '1px solid #e2e8f0', marginTop: '8px' }}>
                  <div style={{ display: 'grid', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4, display: 'block' }}>
                        Status
                      </label>
                      <select
                        className="select"
                        value={t.status || 'active'}
                        onChange={e => methods.updateTaskDetails(project.id, t.id, { status: e.target.value })}
                        style={{ width: 140 }}
                        disabled={loading}
                      >
                        <option value="active">Active</option>
                        <option value="draft">Draft</option>
                        <option value="version">Version</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4, display: 'block' }}>
                        Description
                      </label>
                      <textarea
                        className="input task-description"
                        placeholder="Add a description..."
                        value={t.description || ''}
                        onChange={e => methods.updateTaskDetails(project.id, t.id, { description: e.target.value })}
                        onBlur={e => {
                          if (e.target.value !== (t.description || '')) {
                            methods.updateTaskDetails(project.id, t.id, { description: e.target.value });
                          }
                        }}
                      />
                    </div>
                    <div className="comments-section">
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>
                        Comments ({t.comments?.length || 0})
                      </div>
                      {t.comments && t.comments.length > 0 && (
                        <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                          {t.comments.map(comment => (
                            <div key={comment.id} className="comment-item">
                              <div className="comment-header">
                                <span className="comment-date">
                                  {new Date(comment.createdAt).toLocaleString()}
                                </span>
                                <button
                                  className="btn"
                                  onClick={() => methods.deleteTaskComment(project.id, t.id, comment.id)}
                                  style={{ fontSize: 11, padding: '2px 6px' }}
                                  disabled={loading}
                                >
                                  Delete
                                </button>
                              </div>
                              <div className="comment-text">{comment.text}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="comment-input">
                        <textarea
                          className="input"
                          placeholder="Add a comment..."
                          value={commentTexts.get(t.id) || ''}
                          onChange={e => {
                            const newMap = new Map(commentTexts);
                            newMap.set(t.id, e.target.value);
                            setCommentTexts(newMap);
                          }}
                          style={{ minHeight: 60, resize: 'vertical', marginBottom: 8 }}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && e.ctrlKey && commentTexts.get(t.id)?.trim()) {
                              methods.addTaskComment(project.id, t.id, commentTexts.get(t.id)!);
                              const newMap = new Map(commentTexts);
                              newMap.set(t.id, '');
                              setCommentTexts(newMap);
                            }
                          }}
                        />
                        <button
                          className="btn primary"
                          onClick={() => {
                            const text = commentTexts.get(t.id);
                            if (text?.trim()) {
                              methods.addTaskComment(project.id, t.id, text);
                              const newMap = new Map(commentTexts);
                              newMap.set(t.id, '');
                              setCommentTexts(newMap);
                            }
                          }}
                          disabled={loading || !commentTexts.get(t.id)?.trim()}
                          style={{ fontSize: 12 }}
                        >
                          Add Comment (Ctrl+Enter)
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              </div>
            );
          })}
          {project?.tasks?.length === 0 && <div className="muted">No tasks yet. Add your first task above.</div>}
          {project?.tasks && project.tasks.length > 0 && filteredTasks.length === 0 && (
            <div className="muted">No tasks match your search criteria.</div>
          )}
        </div>
      </div>
    </div>
  );
}

