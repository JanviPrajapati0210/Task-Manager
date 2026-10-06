import { lazy } from 'react';

/**
 * Thin wrapper around React.lazy() that guarantees the Suspense fallback is
 * visible for at least `minDelay` ms (avoids flicker on fast connections).
 * Set minDelay to 0 to get plain React.lazy() behaviour.
 */
export function lazyWithMinDelay(importFn, minDelay = 300) {
  return lazy(() =>
    Promise.all([
      importFn(),
      new Promise((resolve) => setTimeout(resolve, minDelay)),
    ]).then(([module]) => module)
  );
}