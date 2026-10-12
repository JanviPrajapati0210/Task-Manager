import { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../api';

function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setSubmitting(true);
    try {
      const data = await forgotPassword(email);
      setMessage(data.message);
    } catch (err) {
      setError(err.message || 'Could not send reset link.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="section" style={{ maxWidth: '400px', margin: '80px auto' }}>
      <span className="section__title section__title--projects">Forgot Password</span>
      <p style={{ color: 'var(--muted)', marginTop: '16px', fontSize: '0.9rem' }}>
        Enter your account email and we'll send you a link to reset your password.
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '14px', marginTop: '24px' }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={inputStyle}
        />
        {error && <p style={{ color: '#ff6b6b', fontSize: '0.85rem' }}>{error}</p>}
        {message && <p style={{ color: 'var(--accent)', fontSize: '0.85rem' }}>{message}</p>}
        <button type="submit" className="btn btn--solid" disabled={submitting}>
          {submitting ? 'Sending...' : 'Send reset link'}
        </button>
      </form>

      <p style={{ color: 'var(--muted)', marginTop: '18px', fontSize: '0.85rem' }}>
        Remembered it? <Link to="/login" style={{ color: 'var(--accent)' }}>Back to Log In</Link>
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

export default ForgotPasswordPage;