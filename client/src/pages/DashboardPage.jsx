import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getTasks, createTask, updateTask } from '../api';
import Toast from '../components/Toast';

const STATUS_RANKS = { pending: 1, 'in-progress': 2, completed: 3 };

function DashboardPage() {
  const { user, isLoggedIn } = useAuth();
  const navigate = useNavigate();

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // New task modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState('medium');
  const [newStatus, setNewStatus] = useState('pending');
  const [submitting, setSubmitting] = useState(false);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getTasks();
      setTasks(data || []);
    } catch (err) {
      if (err.status === 401) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/login');
      return;
    }
    fetchTasks();
  }, [isLoggedIn, navigate, fetchTasks]);

  const totalTasks = tasks.length;
  const inProgressTasks = tasks.filter((t) => t.status === 'in-progress').length;
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;
  const completedRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const role = (user?.role || 'user').toUpperCase();
  const displayName = user?.username || user?.name || (user?.email ? user.email.split('@')[0] : 'User');

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setSubmitting(true);
    try {
      const created = await createTask({
        title: newTitle.trim(),
        description: newDescription.trim(),
        priority: newPriority,
        status: newStatus,
      });
      setTasks((prev) => [created, ...prev]);
      setToast({ message: 'Task created successfully!', type: 'success' });
      setShowNewModal(false);
      setNewTitle('');
      setNewDescription('');
      setNewPriority('medium');
      setNewStatus('pending');
    } catch (err) {
      setToast({ message: err.message || 'Failed to create task.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickStatusChange = async (task, newSt) => {
    try {
      const updated = await updateTask(task._id, { status: newSt });
      setTasks((prev) => prev.map((t) => (t._id === task._id ? updated : t)));
      setToast({ message: `Task status updated to ${newSt}`, type: 'success' });
    } catch (err) {
      setToast({ message: err.message || 'Cannot update status.', type: 'error' });
    }
  };

  const recentTasks = tasks.slice(0, 5);

  return (
    <div className="v8-dashboard-page">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Hero Banner */}
      <section className="v8-hero-banner">
        <div className="v8-hero-banner__content">
          <div className="v8-hero-badge">
            <span className="v8-hero-badge__icon">🛡️</span>
            <span>Logged in as {role}</span>
          </div>
          <h1 className="v8-hero-title">
            Welcome back, {displayName}! <span className="v8-wave">👋</span>
          </h1>
          <p className="v8-hero-desc">
            {role === 'ADMIN'
              ? 'You have Full Administrator access. You can assign tasks to any employee, manage team roles, and download enterprise reports.'
              : role === 'MANAGER'
              ? 'You have Manager access. You can assign tasks to team members, monitor project progression, and oversee milestones.'
              : 'You have access to your personal task manager. Track your progress, update task statuses, and collaborate with your team.'}
          </p>
        </div>
        <div className="v8-hero-banner__actions">
          <button
            type="button"
            className="v8-btn v8-btn--white"
            onClick={() => setShowNewModal(true)}
          >
            + New Task
          </button>
          <Link to="/tasks" className="v8-btn v8-btn--translucent">
            View All Tasks &rarr;
          </Link>
        </div>
      </section>

      {/* 3 Metric Cards */}
      <section className="v8-stats-grid">
        <div className="v8-stat-card">
          <div className="v8-stat-card__icon v8-stat-card__icon--blue">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6"></line>
              <line x1="8" y1="12" x2="21" y2="12"></line>
              <line x1="8" y1="18" x2="21" y2="18"></line>
              <line x1="3" y1="6" x2="3.01" y2="6"></line>
              <line x1="3" y1="12" x2="3.01" y2="12"></line>
              <line x1="3" y1="18" x2="3.01" y2="18"></line>
            </svg>
          </div>
          <div className="v8-stat-card__info">
            <span className="v8-stat-card__label">Total Tasks</span>
            <span className="v8-stat-card__value">{totalTasks}</span>
          </div>
        </div>

        <div className="v8-stat-card">
          <div className="v8-stat-card__icon v8-stat-card__icon--amber">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div className="v8-stat-card__info">
            <span className="v8-stat-card__label">In Progress</span>
            <span className="v8-stat-card__value">{inProgressTasks}</span>
          </div>
        </div>

        <div className="v8-stat-card">
          <div className="v8-stat-card__icon v8-stat-card__icon--green">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <div className="v8-stat-card__info">
            <span className="v8-stat-card__label">Completed</span>
            <span className="v8-stat-card__value">
              {completedTasks} ({completedRate}%)
            </span>
          </div>
        </div>
      </section>

      {/* Recent Activity Card */}
      <section className="v8-panel-card">
        <div className="v8-panel-card__header">
          <h2 className="v8-panel-card__title">Recent Activity & Assigned Tasks</h2>
          <Link to="/tasks" className="v8-panel-card__link">
            View Full List &rarr;
          </Link>
        </div>

        <div className="v8-panel-card__body">
          {loading ? (
            <div className="v8-empty-state">Loading tasks...</div>
          ) : recentTasks.length === 0 ? (
            <div className="v8-empty-state">
              <p>No tasks found. Click &quot;+ New Task&quot; to create your first task!</p>
            </div>
          ) : (
            <div className="v8-task-list">
              {recentTasks.map((task) => {
                const ownerName =
                  task.user && typeof task.user === 'object'
                    ? task.user.username || task.user.email
                    : 'You';
                return (
                  <div key={task._id} className="v8-task-item">
                    <div className="v8-task-item__main">
                      <div className="v8-task-item__title-row">
                        <span className="v8-task-item__title">{task.title}</span>
                        <span className={`v8-priority-tag v8-priority-tag--${task.priority || 'medium'}`}>
                          {task.priority || 'medium'}
                        </span>
                      </div>
                      {task.description && (
                        <p className="v8-task-item__desc">{task.description}</p>
                      )}
                      <div className="v8-task-item__meta">
                        <span>📅 {new Date(task.createdAt).toLocaleDateString()}</span>
                        <span>👤 Assigned to: <strong>{ownerName}</strong></span>
                      </div>
                    </div>

                    <div className="v8-task-item__actions">
                      <select
                        className="v8-status-select"
                        value={task.status || 'pending'}
                        onChange={(e) => handleQuickStatusChange(task, e.target.value)}
                      >
                        <option value="pending" disabled={STATUS_RANKS['pending'] < STATUS_RANKS[task.status]}>
                          Pending
                        </option>
                        <option value="in-progress" disabled={STATUS_RANKS['in-progress'] < STATUS_RANKS[task.status]}>
                          In Progress
                        </option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Modal for + New Task */}
      {showNewModal && (
        <div className="v8-modal-overlay" onClick={() => setShowNewModal(false)}>
          <div className="v8-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="v8-modal-header">
              <h3>Create New Task</h3>
              <button
                type="button"
                className="v8-modal-close"
                onClick={() => setShowNewModal(false)}
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleCreateTask} className="v8-modal-form">
              <label>
                <span>Task Title *</span>
                <input
                  type="text"
                  placeholder="e.g. Implement user authentication"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                />
              </label>

              <label>
                <span>Description (optional)</span>
                <textarea
                  rows={3}
                  placeholder="Provide context, deliverables, and checklist..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                />
              </label>

              <div className="v8-form-row">
                <label>
                  <span>Priority</span>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </label>

                <label>
                  <span>Status</span>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                  >
                    <option value="pending">Pending</option>
                    <option value="in-progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </label>
              </div>

              <div className="v8-modal-actions">
                <button
                  type="button"
                  className="v8-btn v8-btn--outline"
                  onClick={() => setShowNewModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="v8-btn v8-btn--solid"
                  disabled={submitting}
                >
                  {submitting ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default DashboardPage;
