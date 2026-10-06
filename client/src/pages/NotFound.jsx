import { Link } from 'react-router-dom';

function NotFound() {
  return (
    <section className="page" style={{ textAlign: 'center', padding: '80px 20px' }}>
      <h1 className="section__title">404</h1>
      <p style={{ color: 'var(--muted)', marginTop: '12px' }}>
        The page you're looking for doesn't exist.
      </p>
      <Link to="/" className="btn btn--solid" style={{ marginTop: '24px', display: 'inline-block' }}>
        Back to Home
      </Link>
    </section>
  );
}

export default NotFound;