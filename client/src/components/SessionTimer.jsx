import { useEffect, useRef, useState } from 'react';

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'scroll'];

// Shows a countdown to an automatic logout after `timeoutMs` of no activity
// (mouse, keyboard, click or scroll resets it). It keeps its own state, so the
// once-a-second tick only re-renders this tiny component, not the whole page.
function SessionTimer({ timeoutMs = 30 * 60 * 1000, onExpire }) {
  const lastActivity = useRef(Date.now());
  const onExpireRef = useRef(onExpire);
  const [remaining, setRemaining] = useState(timeoutMs);

  useEffect(() => {
    onExpireRef.current = onExpire;
  });

  useEffect(() => {
    const touch = () => {
      lastActivity.current = Date.now();
    };
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, touch, { passive: true }));

    const timerId = setInterval(() => {
      const left = timeoutMs - (Date.now() - lastActivity.current);
      if (left <= 0) {
        clearInterval(timerId);
        if (onExpireRef.current) onExpireRef.current();
        return;
      }
      setRemaining(left);
    }, 1000);

    return () => {
      clearInterval(timerId);
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, touch));
    };
  }, [timeoutMs]);

  const totalSeconds = Math.max(0, Math.floor(remaining / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');

  return (
    <span className="session-timer" title="You are logged out automatically after 30 minutes of inactivity">
      Session {minutes}:{seconds}
    </span>
  );
}

export default SessionTimer;