import { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import TopBar from './components/TopBar';
import PageLoader from './components/PageLoader';
import { lazyWithMinDelay } from './utils/lazyWithDelay';

const TasksPage = lazyWithMinDelay(() => import('./pages/TasksPage'));
const LoginPage = lazyWithMinDelay(() => import('./pages/LoginPage'));
const RegisterPage = lazyWithMinDelay(() => import('./pages/RegisterPage'));
const NotFound = lazyWithMinDelay(() => import('./pages/NotFound'));

function App() {
  return (
    <>
      <TopBar />
      <main>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Navigate to="/tasks" replace />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
    </>
  );
}

export default App;