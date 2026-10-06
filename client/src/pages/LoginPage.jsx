import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loginUser, loginWithGoogle } from '../api';
import GoogleSignInButton from '../components/GoogleSignInButton';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await loginUser(email, password);
      navigate('/tasks');
    } catch (err) {
      setError(err.message || 'Login failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async (credential) => {
    setError(null);
    try {
      await loginWithGoogle(credential);
      navigate('/tasks');
    } catch (err) {
      setError(err.message || 'Google login failed.');
    }
  };

  return (
    <section className="section" style={{ maxWidth: '400px', margin: '80px auto' }}>
      <span className="section__title section__title--projects">Log In</span>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '14px', marginTop: '24px' }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={inputStyle}
        />
        {error && <p style={{ color: '#ff6b6b', fontSize: '0.85rem' }}>{error}</p>}
        <button type="submit" className="btn btn--solid" disabled={submitting}>
          {submitting ? 'Logging in...' : 'Log In'}
        </button>
      </form>

      <div style={dividerStyle}>
        <span style={{ flex: 1, height: '1px', background: 'var(--line)' }} />
        <span>or</span>
        <span style={{ flex: 1, height: '1px', background: 'var(--line)' }} />
      </div>
      <GoogleSignInButton onCredential={handleGoogle} onError={setError} />

      <p style={{ color: 'var(--muted)', marginTop: '18px', fontSize: '0.85rem' }}>
        Don't have an account? <Link to="/register" style={{ color: 'var(--accent)' }}>Register</Link>
      </p>
    </section>
  );
}

const inputStyle = {
  padding: '12px 16px',
  borderRadius: '8px',
  border: '1px solid var(--line)',
  backgroundColor: 'var(--bg-elevated)',
  color: 'var(--text)',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.9rem',
  outline: 'none',
};

const dividerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  margin: '20px 0',
  color: 'var(--muted)',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.8rem',
};

export default LoginPage;