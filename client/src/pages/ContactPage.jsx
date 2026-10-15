import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Toast from '../components/Toast';

function ContactPage() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.username || user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [toast, setToast] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    setSent(true);
    setToast({
      message: 'Thank you! Your message has been routed to the administrator.',
      type: 'success',
    });
    setSubject('');
    setMessage('');
  };

  return (
    <div className="v8-contact-page">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="v8-page-header">
        <div className="v8-page-header__left">
          <div className="v8-page-header__title-row">
            <span className="v8-page-header__icon">✉️</span>
            <h1>Contact & Support</h1>
          </div>
          <p className="v8-page-header__subtitle">
            Reach out to system administrators, submit inquiries, or request elevated access.
          </p>
        </div>
      </div>

      <div className="v8-contact-grid">
        <div className="v8-panel-card">
          <div className="v8-panel-card__header">
            <h2 className="v8-panel-card__title">Send a Message</h2>
          </div>
          <div className="v8-panel-card__body">
            <form onSubmit={handleSubmit} className="v8-modal-form">
              <label>
                <span>Your Name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your Name"
                  required
                />
              </label>

              <label>
                <span>Email Address</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@domain.com"
                  required
                />
              </label>

              <label>
                <span>Subject</span>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Access request or bug report"
                  required
                />
              </label>

              <label>
                <span>Message</span>
                <textarea
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type your message details..."
                  required
                />
              </label>

              <div style={{ marginTop: '16px' }}>
                <button type="submit" className="v8-btn v8-btn--solid">
                  Send Message
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="v8-contact-sidebar">
          <div className="v8-panel-card">
            <div className="v8-panel-card__header">
              <h2 className="v8-panel-card__title">Help & Administration</h2>
            </div>
            <div className="v8-panel-card__body">
              <div className="v8-contact-info-item">
                <strong>🛡️ System Administrator</strong>
                <p>24aiml052@charusat.edu.in</p>
              </div>
              <div className="v8-contact-info-item" style={{ marginTop: '16px' }}>
                <strong>⚡ Response Time</strong>
                <p>Within 24 business hours</p>
              </div>
              <div className="v8-contact-info-item" style={{ marginTop: '16px' }}>
                <strong>📦 Version Info</strong>
                <p>TaskManager Enterprise v8.0</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ContactPage;
