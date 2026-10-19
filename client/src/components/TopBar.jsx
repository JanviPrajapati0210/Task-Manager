import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function TopBar() {
  const { user, isLoggedIn, logout } = useAuth();
  const location = useLocation();

  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('light', isLight);
  }, [isLight]);

  const isStaff = user?.role === 'admin' || user?.role === 'manager';

  const navItems = [
    {
      to: '/dashboard',
      label: 'Dashboard',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7"></rect>
          <rect x="14" y="3" width="7" height="7"></rect>
          <rect x="14" y="14" width="7" height="7"></rect>
          <rect x="3" y="14" width="7" height="7"></rect>
        </svg>
      ),
    },
    {
      to: '/tasks',
      label: 'Tasks & Projects',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>
      ),
    },
    ...(isStaff
      ? [
          {
            to: '/team',
            label: 'Team & Roles',
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            ),
          },
        ]
      : []),
    {
      to: '/analytics',
      label: 'Analytics (Lazy)',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10"></line>
          <line x1="12" y1="20" x2="12" y2="4"></line>
          <line x1="6" y1="20" x2="6" y2="14"></line>
        </svg>
      ),
    },
    {
      to: '/contact',
      label: 'Contact',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
          <polyline points="22,6 12,13 2,6"></polyline>
        </svg>
      ),
    },
  ];

  const currentPath = location.pathname;

  const getRoleLabel = (role) => {
    const r = (role || 'user').toUpperCase();
    if (r === 'ADMIN') return '🛡️ ADMIN';
    if (r === 'MANAGER') return '👔 MANAGER';
    return '👤 EMPLOYEE';
  };

  return (
    <header className="v8-topbar">
      <div className="v8-topbar__inner">
        {/* Brand */}
        <Link to={isLoggedIn ? '/dashboard' : '/login'} className="v8-brand">
          <div className="v8-brand__icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4"></path>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
            </svg>
          </div>
          <div className="v8-brand__text">
            <span className="v8-brand__name">TaskManager</span>
            <span className="v8-brand__version">v8.0</span>
          </div>
        </Link>

        {/* Navigation Tabs */}
        {isLoggedIn && (
          <nav className="v8-nav">
            {navItems.map((item) => {
              const isActive =
                item.to === '/dashboard'
                  ? currentPath === '/' || currentPath === '/dashboard'
                  : currentPath.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`v8-nav__item ${isActive ? 'v8-nav__item--active' : ''}`}
                >
                  <span className="v8-nav__icon">{item.icon}</span>
                  <span className="v8-nav__label">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        )}

        {/* Actions & Theme Toggle */}
        <div className="v8-user-actions">
          {isLoggedIn && user ? (
            <>
              <div className="v8-session-badge" title="Session Active">
                <span className="v8-pulse-dot"></span>
                <span>Session Active</span>
              </div>

              <span className={`role-badge role-${user.role || 'user'}`}>
                {getRoleLabel(user.role)}
              </span>

              <span className="v8-username">
                {user.username || user.name || user.email.split('@')[0]}
              </span>

              <button
                type="button"
                className="topbar__toggle"
                onClick={() => setIsLight((prev) => !prev)}
                aria-label="Toggle light and dark mode"
                style={{ fontSize: '0.78rem', padding: '5px 12px' }}
              >
                {isLight ? 'Dark' : 'Light'}
              </button>

              <button type="button" className="v8-logout-btn" onClick={logout}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                <span>Logout</span>
              </button>
            </>
          ) : (
            <div className="v8-auth-links">
              <button
                type="button"
                className="topbar__toggle"
                onClick={() => setIsLight((prev) => !prev)}
                aria-label="Toggle light and dark mode"
                style={{ fontSize: '0.78rem', padding: '5px 12px' }}
              >
                {isLight ? 'Dark' : 'Light'}
              </button>
              <Link to="/login" className="btn btn--outline" style={{ padding: '6px 14px' }}>Login</Link>
              <Link to="/register" className="btn btn--solid" style={{ padding: '6px 14px' }}>Register</Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default TopBar;