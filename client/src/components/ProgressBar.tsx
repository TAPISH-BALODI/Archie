export function ProgressBar({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className="progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={clamped}>
      <span style={{ width: `${clamped}%` }} />
    </div>
  );
}

