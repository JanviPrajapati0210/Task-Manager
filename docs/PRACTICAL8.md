# Practical 8 — Performance Optimization & Lazy Loading (Task Manager client)

## What was changed
- `client/src/App.jsx`: `/tasks`, `/login`, `/register` and the 404 page are lazy-loaded with
  `React.lazy()` (via `lazyWithMinDelay`); `<Suspense>` wraps only `<Routes>`.
- `PageLoader.jsx`: fallback UI (spinner + text). `lazyWithDelay.js`: 300 ms minimum fallback.
- `TaskChart.jsx` (recharts): lazy-loaded inside `TaskManager`, fetched only when
  "Show chart" is clicked (heavy third-party component, supplementary problem).
- `TaskManager.jsx`: `TaskItem` wrapped in `React.memo`, stable callbacks via `useCallback`,
  `useMemo` for the filtered list (Profiler fix).

## Before / after (fill in from your machine)
"Before" = same app with static imports (see steps in the main README / notes below).

| Metric | Before | After |
|---|---|---|
| Main JS in build output | ___ kB (gzip ___ kB) | ___ kB (gzip ___ kB) |
| JS files in `client/dist/assets` | 1 | ___ |
| Initial load, Network tab: JS transferred | ___ kB | ___ kB |
| Finish / DOMContentLoaded / Load | ___ | ___ |
| Slow 3G: time until the login/tasks page is usable | ___ | ___ |

Screenshots: `docs/before-build.png`, `before-network.png`, `after-build.png`,
`after-network.png`, `after-slow3g-fallback.png`, `after-chart-chunk.png`,
`profiler-before.png`, `profiler-after.png`.

## Key questions
1. **Initial bundle vs lazy chunk:** the initial bundle (React, router, app shell) downloads on
   the first visit; each page chunk and the chart chunk downloads only when first needed, then
   is cached.
2. **Perceived performance:** the user sees something sooner because only the first route's code
   is needed up front. Total code over a session is the same; lazy loading changes *when* it
   downloads, not *how much*.
3. **Not worth it when:** the app is tiny, or the code is used on nearly every visit. Extra
   chunks add requests, loading states and complexity for no real saving.

## Profiler: unnecessary re-render
React DevTools Profiler, recording while typing in "Add a new task".
**Before:** every task row re-rendered on each keystroke ("parent component rendered"), though no
task changed. **Fix:** `TaskItem` in `React.memo` + stable handlers (`useCallback`) + `useMemo`
for `visibleTasks`. **After:** only the form re-renders. Also fixed: the toast timer restarted on
every keystroke because `onClose` was a new function each render.
(Replace with what *you* observed in your Profiler recording.)

## Troubleshooting notes
(Write what actually happened, e.g. a missing `export default`, or the fallback only visible
after enabling Slow 3G.)