function PageLoader({ label = 'Loading page...' }) {
  return (
    <div className="page-loader" role="status" aria-live="polite">
      <div className="page-loader__spinner" />
      <p className="page-loader__text">{label}</p>
    </div>
  );
}

export default PageLoader;