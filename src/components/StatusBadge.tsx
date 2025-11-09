export function StatusBadge({ status }: { status: 'Completed' | 'In Progress' | 'Not Started' }) {
  const cls =
    status === 'Completed' ? 'badge green' : status === 'In Progress' ? 'badge blue' : 'badge gray';
  return <span className={cls}>{status}</span>;
}


