import { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import TopBar from './components/TopBar';
import PageLoader from './components/PageLoader';
import { lazyWithMinDelay } from './utils/lazyWithDelay';
import { AuthProvider } from './context/AuthContext';

// Route-based code splitting (Practical 8): each page becomes its own chunk,
// downloaded only when the route is first visited.
const DashboardPage = lazyWithMinDelay(() => import('./pages/DashboardPage'));
const TasksPage = lazyWithMinDelay(() => import('./pages/TasksPage'));
const TeamPage = lazyWithMinDelay(() => import('./pages/TeamPage'));
const AnalyticsPage = lazyWithMinDelay(() => import('./pages/AnalyticsPage'));
const ContactPage = lazyWithMinDelay(() => import('./pages/ContactPage'));
const LoginPage = lazyWithMinDelay(() => import('./pages/LoginPage'));
const RegisterPage = lazyWithMinDelay(() => import('./pages/RegisterPage'));
const ForgotPasswordPage = lazyWithMinDelay(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazyWithMinDelay(() => import('./pages/ResetPasswordPage'));
const NotFound = lazyWithMinDelay(() => import('./pages/NotFound'));

function App() {
  return (
    <AuthProvider>
      <TopBar />
      <main>
        {/* Suspense wraps ONLY the Routes block, so the TopBar stays visible */}
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/team" element={<TeamPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
    </AuthProvider>
  );
}

export default App;