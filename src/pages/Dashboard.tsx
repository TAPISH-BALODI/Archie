import { Link, useNavigate } from 'react-router-dom';
import { useAppState, getProjectStatus } from '../store';
import { ProgressBar } from '../components/ProgressBar';
import { StatusBadge } from '../components/StatusBadge';
import { useState } from 'react';

export function Dashboard() {
  const { state, methods, loading, error } = useAppState();
  const [name, setName] = useState('');
  const navigate = useNavigate();

  return (
    <div className="container" style={{ display: 'grid', gap: 16 }}>
      <div className="card" style={{ display: 'grid', gap: 10 }}>
        <div className="title">Projects</div>
        {loading && <div className="muted">Loading...</div>}
        {error && <div className="muted">Error: {error}</div>}
        <div className="row wrap">
          <input
            className="input"
            placeholder="New project name"
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ maxWidth: 360 }}
            disabled={loading}
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
        </div>
      </div>

      <div className="grid grid-3">
        {(state.projects ?? []).map(p => {
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
                <div className="title" title={p.name} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                  {p.name}
                </div>
                <StatusBadge status={status} />
              </div>
              <ProgressBar percent={p.progress} />
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
                  onClick={() => methods.deleteProject(p.id)}
                  title="Delete project"
                  disabled={loading}
                  onClickCapture={e => e.stopPropagation()}
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
    </div>
  );
}


