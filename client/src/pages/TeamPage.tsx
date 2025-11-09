import { useMemo, useState } from 'react';
import { useAppState } from '../store';

export function TeamPage() {
  const { state, methods, loading } = useAppState();
  const [name, setName] = useState('');

  const taskCountByMember = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of (state.projects ?? [])) {
      for (const t of (p.tasks ?? [])) {
        if (!t.assigneeId) continue;
        map.set(t.assigneeId, (map.get(t.assigneeId) ?? 0) + 1);
      }
    }
    return map;
  }, [state.projects]);

  function capacityColor(percent: number): string {
    if (percent <= 50) return 'cap-green';
    if (percent <= 80) return 'cap-orange';
    return 'cap-red';
  }

  return (
    <div className="container" style={{ display: 'grid', gap: 16 }}>
      <div className="card" style={{ display: 'grid', gap: 10 }}>
        <div className="title">Team</div>
        <div className="row wrap">
          <input
            className="input"
            placeholder="New team member name"
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ maxWidth: 360 }}
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
        {(state.team ?? []).map(member => {
          const count = taskCountByMember.get(member.id) ?? 0;
          const percent = Math.min(100, Math.round((count / 5) * 100)); // 5 tasks = 100% capacity
          const barColor = capacityColor(percent);
          return (
            <div className="card" key={member.id} style={{ display: 'grid', gap: 10 }}>
              <div className="space-between">
                <div className="title">{member.name}</div>
                <div className="subtitle">{count} tasks</div>
              </div>
              <div className="capacity">
                <span className={barColor} style={{ width: `${percent}%` }} />
              </div>
              <div className="subtitle">
                Capacity: {percent}% {percent <= 50 ? '(green)' : percent <= 80 ? '(orange)' : '(red)'}
              </div>
            </div>
          );
        })}
      </div>
      {state.team.length === 0 && <div className="card muted">No team members yet. Add someone above.</div>}
    </div>
  );
}

