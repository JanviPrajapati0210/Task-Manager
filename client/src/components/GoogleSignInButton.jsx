import { useEffect, useRef } from 'react';

const GSI_SRC = 'https://accounts.google.com/gsi/client';
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// Load Google's Identity Services script once, and only when a page that
// needs it is shown (so it is NOT part of the main bundle / first page load).
let scriptPromise;
function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = GSI_SRC;
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = () => {
        scriptPromise = undefined; // allow a retry later
        reject(new Error('Could not load Google Sign-In. Check your internet connection.'));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

function GoogleSignInButton({ onCredential, onError }) {
  const buttonRef = useRef(null);
  const onCredentialRef = useRef(onCredential);
  const onErrorRef = useRef(onError);

  // Always call the latest callbacks without re-initialising Google's button
  useEffect(() => {
    onCredentialRef.current = onCredential;
    onErrorRef.current = onError;
  });

  useEffect(() => {
    if (!CLIENT_ID) return undefined;
    let cancelled = false;

    loadGoogleScript()
      .then(() => {
        if (cancelled || !buttonRef.current) return;
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (response) => onCredentialRef.current(response.credential),
        });
        window.google.accounts.id.renderButton(buttonRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          width: 320,
        });
      })
      .catch((err) => {
        if (!cancelled && onErrorRef.current) onErrorRef.current(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!CLIENT_ID) {
    return (
      <p style={{ color: 'var(--muted)', fontSize: '0.8rem', textAlign: 'center' }}>
        Google login is not configured. Set VITE_GOOGLE_CLIENT_ID in client/.env and restart.
      </p>
    );
  }

  return <div ref={buttonRef} style={{ display: 'flex', justifyContent: 'center' }} />;
}

export default GoogleSignInButton;