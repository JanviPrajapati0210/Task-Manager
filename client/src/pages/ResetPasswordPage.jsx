import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { resetPassword } from '../api';

function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await resetPassword(token, password);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 1800);
    } catch (err) {
      setError(err.message || 'Could not reset password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="section" style={{ maxWidth: '400px', margin: '80px auto' }}>
      <span className="section__title section__title--projects">Reset Password</span>

      {success ? (
        <p style={{ color: 'var(--accent)', marginTop: '24px' }}>
          Password updated! Redirecting to login...
        </p>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '14px', marginTop: '24px' }}>
          <input
            type="password"
            placeholder="New password (min 6 characters)"
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Confirm new password"
            minLength={6}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            style={inputStyle}
          />
          {error && <p style={{ color: '#ff6b6b', fontSize: '0.85rem' }}>{error}</p>}
          <button type="submit" className="btn btn--solid" disabled={submitting}>
            {submitting ? 'Updating...' : 'Update password'}
          </button>
        </form>
      )}

      <p style={{ color: 'var(--muted)', marginTop: '18px', fontSize: '0.85rem' }}>
        Link expired?{' '}
        <Link to="/forgot-password" style={{ color: 'var(--accent)' }}>
          Request a new one
        </Link>
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

export default ResetPasswordPage;