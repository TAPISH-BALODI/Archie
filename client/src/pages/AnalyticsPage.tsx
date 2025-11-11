import { useMemo } from 'react';
import { useAppState, getProjectStatus } from '../store';
import { ProgressBar } from '../components/ProgressBar';

function BarChart({ data, maxValue, height = 150 }: { data: Array<{ label: string; value: number; color?: string }>; maxValue: number; height?: number }) {
  const labelHeight = 30;
  const topPadding = 20;
  const maxBarHeight = height - labelHeight - topPadding;
  const barWidthPercent = Math.max(15, Math.min(22, 90 / data.length));
  const spacingPercent = (100 - (barWidthPercent * data.length)) / (data.length + 1);
  
  return (
    <svg width="100%" height={height} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <clipPath id="chartClip">
          <rect x="0" y="0" width="100%" height={height} />
        </clipPath>
      </defs>
      <g clipPath="url(#chartClip)">
        {data.map((item, i) => {
          const barHeight = maxValue > 0 ? (item.value / maxValue) * maxBarHeight : 0;
          const xPercent = spacingPercent + (i * (barWidthPercent + spacingPercent));
          const color = item.color || '#22c55e';
          const barY = topPadding + (maxBarHeight - barHeight);
          return (
            <g key={i}>
              <rect
                x={`${xPercent}%`}
                y={barY}
                width={`${barWidthPercent}%`}
                height={barHeight}
                fill={color}
                rx={4}
              />
              <text
                x={`${xPercent + barWidthPercent / 2}%`}
                y={height - 8}
                textAnchor="middle"
                fontSize="10"
                fill="#64748b"
                dominantBaseline="middle"
              >
                {item.label.length > 10 ? item.label.substring(0, 9) + '...' : item.label}
              </text>
              {item.value > 0 && barHeight > 15 && (
                <text
                  x={`${xPercent + barWidthPercent / 2}%`}
                  y={barY - 4}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fill="#0f172a"
                  dominantBaseline="middle"
                >
                  {item.value}
                </text>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

function PieChart({ data, size = 120 }: { data: Array<{ label: string; value: number; color: string }>; size?: number }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) {
    return (
      <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
        No data
      </div>
    );
  }
  
  let currentAngle = -90;
  const center = size / 2;
  const radius = size / 2 - 10;
  
  const paths = data.map((item, i) => {
    const percentage = item.value / total;
    const angle = percentage * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;
    
    const x1 = center + radius * Math.cos((startAngle * Math.PI) / 180);
    const y1 = center + radius * Math.sin((startAngle * Math.PI) / 180);
    const x2 = center + radius * Math.cos((endAngle * Math.PI) / 180);
    const y2 = center + radius * Math.sin((endAngle * Math.PI) / 180);
    const largeArc = angle > 180 ? 1 : 0;
    
    const path = `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    
    return (
      <path
        key={i}
        d={path}
        fill={item.color}
        stroke="#ffffff"
        strokeWidth="2"
      />
    );
  });
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <svg width={size} height={size}>
        {paths}
        <circle cx={center} cy={center} r={radius * 0.6} fill="#ffffff" />
        <text x={center} y={center + 5} textAnchor="middle" fontSize="16" fontWeight="600" fill="#0f172a">
          {total}
        </text>
      </svg>
      <div style={{ display: 'grid', gap: 6, fontSize: 11 }}>
        {data.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: 2, background: item.color }} />
            <span style={{ color: '#64748b' }}>{item.label}: {item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AnalyticsPage() {
  const { state } = useAppState();

  const analytics = useMemo(() => {
    const projects = state.projects ?? [];
    const team = state.team ?? [];
    
    const statusBreakdown = {
      completed: projects.filter(p => getProjectStatus(p) === 'Completed').length,
      inProgress: projects.filter(p => getProjectStatus(p) === 'In Progress').length,
      notStarted: projects.filter(p => getProjectStatus(p) === 'Not Started').length,
    };
    
    const totalTasks = projects.reduce((sum, p) => sum + (p.tasks?.length ?? 0), 0);
    const completedTasks = projects.reduce((sum, p) => 
      sum + (p.tasks?.filter(t => t.completed).length ?? 0), 0);
    const unassignedTasks = projects.reduce((sum, p) => 
      sum + (p.tasks?.filter(t => !t.assigneeId && !t.completed).length ?? 0), 0);
    
    const taskCountByMember = new Map<string, number>();
    for (const p of projects) {
      for (const t of (p.tasks ?? [])) {
        if (t.assigneeId && !t.completed) {
          taskCountByMember.set(t.assigneeId, (taskCountByMember.get(t.assigneeId) ?? 0) + 1);
        }
      }
    }
    
    const teamWorkload = team.map(m => ({
      name: m.name,
      taskCount: taskCountByMember.get(m.id) ?? 0
    })).sort((a, b) => b.taskCount - a.taskCount);
    
    const progressRanges = [
      { label: '0-25%', value: 0, color: '#ef4444' },
      { label: '26-50%', value: 0, color: '#f59e0b' },
      { label: '51-75%', value: 0, color: '#3b82f6' },
      { label: '76-100%', value: 0, color: '#22c55e' },
    ];
    
    projects.forEach(p => {
      if (p.progress <= 25) progressRanges[0].value++;
      else if (p.progress <= 50) progressRanges[1].value++;
      else if (p.progress <= 75) progressRanges[2].value++;
      else progressRanges[3].value++;
    });
    
    const topProjects = [...projects]
      .sort((a, b) => (b.tasks?.length ?? 0) - (a.tasks?.length ?? 0))
      .slice(0, 5)
      .map(p => ({
        name: p.name,
        taskCount: p.tasks?.length ?? 0,
        progress: p.progress
      }));
    
    return {
      statusBreakdown,
      totalTasks,
      completedTasks,
      unassignedTasks,
      teamWorkload,
      progressRanges,
      topProjects,
      totalProjects: projects.length,
      totalTeamMembers: team.length
    };
  }, [state]);

  return (
    <div className="container" style={{ display: 'grid', gap: 16 }}>
      <div className="card" style={{ display: 'grid', gap: 12 }}>
        <div className="title">Analytics Dashboard</div>
        <div className="row muted" style={{ fontSize: 14 }}>
          Comprehensive overview of projects, tasks, and team performance
        </div>
      </div>

      <div className="grid grid-4">
        <div className="stat-card">
          <div className="stat-value">{analytics.totalProjects}</div>
          <div className="stat-label">Total Projects</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{analytics.totalTasks}</div>
          <div className="stat-label">Total Tasks</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {analytics.totalTasks > 0 ? Math.round((analytics.completedTasks / analytics.totalTasks) * 100) : 0}%
          </div>
          <div className="stat-label">Completion Rate</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{analytics.unassignedTasks}</div>
          <div className="stat-label">Unassigned Tasks</div>
        </div>
      </div>

      <div className="grid grid-2" style={{ gap: 16 }}>
        <div className="card" style={{ display: 'grid', gap: 12 }}>
          <div className="title" style={{ fontSize: 16 }}>Project Status</div>
          <PieChart
            data={[
              { label: 'Completed', value: analytics.statusBreakdown.completed, color: '#22c55e' },
              { label: 'In Progress', value: analytics.statusBreakdown.inProgress, color: '#3b82f6' },
              { label: 'Not Started', value: analytics.statusBreakdown.notStarted, color: '#94a3b8' },
            ]}
          />
        </div>

        <div className="card" style={{ display: 'grid', gap: 12 }}>
          <div className="title" style={{ fontSize: 16 }}>Progress Distribution</div>
          <div className="chart-container">
            <BarChart
              data={analytics.progressRanges}
              maxValue={Math.max(...analytics.progressRanges.map(r => r.value), 1)}
            />
          </div>
        </div>
      </div>

      {analytics.teamWorkload.length > 0 && (
        <div className="card" style={{ display: 'grid', gap: 12 }}>
          <div className="title" style={{ fontSize: 16 }}>Team Workload</div>
          <div className="chart-container">
            <BarChart
              data={analytics.teamWorkload.map(m => ({
                label: m.name,
                value: m.taskCount,
                color: m.taskCount <= 3 ? '#22c55e' : m.taskCount <= 5 ? '#f59e0b' : '#ef4444'
              }))}
              maxValue={Math.max(...analytics.teamWorkload.map(m => m.taskCount), 1)}
            />
          </div>
        </div>
      )}

      {analytics.topProjects.length > 0 && (
        <div className="card" style={{ display: 'grid', gap: 12 }}>
          <div className="title" style={{ fontSize: 16 }}>Top Projects by Task Count</div>
          <div className="list">
            {analytics.topProjects.map((p, i) => (
              <div key={i} className="list-item" style={{ display: 'grid', gap: 8 }}>
                <div className="space-between">
                  <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                    <span className="muted" style={{ fontSize: 14, fontWeight: 600 }}>#{i + 1}</span>
                    <span style={{ fontWeight: 500 }}>{p.name}</span>
                  </div>
                  <span className="muted">{p.taskCount} tasks</span>
                </div>
                <ProgressBar percent={p.progress} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

