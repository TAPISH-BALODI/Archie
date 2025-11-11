import { useMemo, useState } from 'react';
import { useAppState } from '../store';

export function TeamPage() {
  const { state, methods, loading } = useAppState();
  const [name, setName] = useState('');

  const memberStats = useMemo(() => {
    const taskCountByMember = new Map<string, number>();
    const completedCountByMember = new Map<string, number>();
    const projectCountByMember = new Map<string, Set<string>>();
    
    for (const p of (state.projects ?? [])) {
      for (const t of (p.tasks ?? [])) {
        if (!t.assigneeId) continue;
        taskCountByMember.set(t.assigneeId, (taskCountByMember.get(t.assigneeId) ?? 0) + 1);
        if (t.completed) {
          completedCountByMember.set(t.assigneeId, (completedCountByMember.get(t.assigneeId) ?? 0) + 1);
        }
        if (!projectCountByMember.has(t.assigneeId)) {
          projectCountByMember.set(t.assigneeId, new Set());
        }
        projectCountByMember.get(t.assigneeId)!.add(p.id);
      }
    }
    
    return state.team.map(member => {
      const taskCount = taskCountByMember.get(member.id) ?? 0;
      const completedCount = completedCountByMember.get(member.id) ?? 0;
      const projectCount = projectCountByMember.get(member.id)?.size ?? 0;
      const percent = Math.min(100, Math.round((taskCount / 5) * 100)); // 5 tasks = 100% capacity
      const completionRate = taskCount > 0 ? Math.round((completedCount / taskCount) * 100) : 0;
      
      return {
        ...member,
        taskCount,
        completedCount,
        projectCount,
        percent,
        completionRate
      };
    });
  }, [state.projects, state.team]);

  function capacityColor(percent: number): string {
    if (percent <= 50) return 'cap-green';
    if (percent <= 80) return 'cap-orange';
    return 'cap-red';
  }

  const totalTasks = memberStats.reduce((sum, m) => sum + m.taskCount, 0);
  const avgCapacity = memberStats.length > 0 
    ? Math.round(memberStats.reduce((sum, m) => sum + m.percent, 0) / memberStats.length)
    : 0;

  return (
    <div className="container" style={{ display: 'grid', gap: 16 }}>
      {state.team.length > 0 && (
        <div className="card" style={{ display: 'grid', gap: 12 }}>
          <div className="title">Team Overview</div>
          <div className="grid grid-3" style={{ gap: 12 }}>
            <div className="stat-card">
              <div className="stat-value">{state.team.length}</div>
              <div className="stat-label">Team Members</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{totalTasks}</div>
              <div className="stat-label">Total Tasks</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{avgCapacity}%</div>
              <div className="stat-label">Avg Capacity</div>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ display: 'grid', gap: 10 }}>
        <div className="title">Team</div>
        <div className="row wrap">
          <input
            className="input"
            placeholder="New team member name"
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ maxWidth: 360 }}
            onKeyDown={e => {
              if (e.key === 'Enter' && name.trim()) {
                methods.addTeamMember(name);
                setName('');
              }
            }}
          />
          <button
            className="btn primary"
            onClick={() => {
              if (!name.trim()) return;
              methods.addTeamMember(name);
              setName('');
            }}
            disabled={loading}
          >
            Add Member
          </button>
        </div>
      </div>

      <div className="grid grid-3">
        {memberStats.map(member => {
          const barColor = capacityColor(member.percent);
          return (
            <div className="card" key={member.id} style={{ display: 'grid', gap: 10 }}>
              <div className="space-between">
                <div className="title">{member.name}</div>
                <div className="subtitle">{member.taskCount} task{member.taskCount !== 1 ? 's' : ''}</div>
              </div>
              <div className="capacity">
                <span className={barColor} style={{ width: `${member.percent}%` }} />
              </div>
              <div className="row" style={{ justifyContent: 'space-between', fontSize: 12 }}>
                <span className="muted">Capacity: {member.percent}%</span>
                {member.taskCount > 0 && (
                  <span className="muted">{member.completionRate}% complete</span>
                )}
              </div>
              {member.projectCount > 0 && (
                <div className="subtitle" style={{ fontSize: 11 }}>
                  Working on {member.projectCount} project{member.projectCount !== 1 ? 's' : ''}
                </div>
              )}
              {member.taskCount === 0 && (
                <div className="muted" style={{ fontSize: 11 }}>No tasks assigned</div>
              )}
            </div>
          );
        })}
      </div>
      {state.team.length === 0 && <div className="card muted">No team members yet. Add someone above.</div>}
    </div>
  );
}

