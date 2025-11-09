export function LoadingOverlay({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="overlay">
      <div className="spinner" aria-label="Loading" />
    </div>
  );
}

