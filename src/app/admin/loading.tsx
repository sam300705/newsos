export default function AdminLoading() {
  return (
    <div aria-busy="true" aria-label="Loading newsroom">
      <div className="skeleton skeleton-kicker" />
      <div className="skeleton skeleton-admin-title" />
      <div className="metric-grid admin-loading-grid">
        <div className="skeleton skeleton-metric" />
        <div className="skeleton skeleton-metric" />
        <div className="skeleton skeleton-metric" />
        <div className="skeleton skeleton-metric" />
      </div>
      <div className="skeleton skeleton-table" />
    </div>
  );
}
