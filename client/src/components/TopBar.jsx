import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

function TopBar() {
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('light', isLight);
  }, [isLight]);

  return (
    <header className="topbar">
      <Link to="/tasks" className="topbar__brand">
        task<span>_</span>manager
      </Link>
      <button
        type="button"
        className="topbar__toggle"
        onClick={() => setIsLight((prev) => !prev)}
        aria-label="Toggle light and dark mode"
      >
        {isLight ? 'Dark mode' : 'Light mode'}
      </button>
    </header>
  );
}

export default TopBar;