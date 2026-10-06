import { useState, useEffect, useCallback, useMemo, memo, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  isLoggedIn,
  logoutUser,
  getMe,
} from '../api';
import Toast from './Toast';

// Heavy component (pulls in the whole recharts library). Downloaded only when
// the user clicks "Show chart" for the first time.
const TaskChart = lazy(() => import('./TaskChart'));

const PRIORITIES = ['low', 'medium', 'high'];

const STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

const STATUS_FILTERS = [{ value: 'all', label: 'Status' }, ...STATUSES];
const PRIORITY_FILTERS = [
  { value: 'all', label: 'Priority' },
  ...PRIORITIES.map((p) => ({ value: p, label: p[0].toUpperCase() + p.slice(1) })),
];

// Memoised row: re-renders only when its own `task` (or the stable callbacks)
// change, not every time the parent re-renders (e.g. while typing a new title).
const TaskItem = memo(function TaskItem({ task, onStatusChange, onAskDelete }) {
  return (
    <li
      className="projects__card"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        flexWrap: 'wrap',
        opacity: task.__optimistic ? 0.6 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '160px' }}>
        <span style={{ color: 'var(--text)' }}>{task.title}</span>
        <span style={priorityBadgeStyle(task.priority)}>{task.priority}</span>
      </div>

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <select
          value={task.status || 'pending'}
          onChange={(e) => onStatusChange(task, e.target.value)}
          disabled={task.__optimistic}
          style={inputStyle}
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <button
          className="btn btn--outline"
          style={{ padding: '4px 12px' }}
          onClick={() => onAskDelete(task)}
          disabled={task.__optimistic}
        >
          Delete
        </button>
      </div>
    </li>
  );
});

const TaskManager = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState('medium');
  const [newStatus, setNewStatus] = useState('pending');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [submitting, setSubmitting] = useState(false);
  const [confirmingTask, setConfirmingTask] = useState(null);
  const [toast, setToast] = useState(null);
  const [showChart, setShowChart] = useState(false);

  const showToast = useCallback((message, type = 'success') => setToast({ message, type }), []);
  const closeToast = useCallback(() => setToast(null), []);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTasks();
      setTasks(data);
    } catch (err) {
      if (err.status === 401) {
        // Supplementary Problem: expired/invalid token -> redirect to login
        navigate('/login');
        return;
      }
      setError(err.message || 'Failed to load tasks.');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate('/login');
      return;
    }
    getMe()
      .then((user) => setUserEmail(user.email))
      .catch(() => {
        // token invalid/expired even before the first task fetch
        navigate('/login');
      });
    loadTasks();
  }, [loadTasks, navigate]);

  const handleLogout = () => {
    logoutUser();
    navigate('/login');
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticTask = {
      _id: tempId,
      title,
      priority: newPriority,
      status: newStatus,
      __optimistic: true,
    };
    setTasks((prev) => [optimisticTask, ...prev]);
    setNewTitle('');
    setSubmitting(true);

    try {
      const created = await createTask({ title, priority: newPriority, status: newStatus });
      setTasks((prev) => prev.map((t) => (t._id === tempId ? created : t)));
      showToast('Task added.', 'success');
    } catch (err) {
      setTasks((prev) => prev.filter((t) => t._id !== tempId));
      if (err.status === 401) {
        navigate('/login');
        return;
      }
      showToast(err.message || 'Could not add task.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Stable callback (useCallback) so memo(TaskItem) actually works.
  // Rollback uses a functional update with the old status instead of a
  // snapshot of the whole `tasks` array, so it doesn't depend on `tasks`.
  const handleStatusChange = useCallback(
    async (task, newStatusValue) => {
      const previousStatus = task.status;
      setTasks((prev) =>
        prev.map((t) => (t._id === task._id ? { ...t, status: newStatusValue } : t))
      );
      try {
        const updated = await updateTask(task._id, { status: newStatusValue });
        setTasks((prev) => prev.map((t) => (t._id === task._id ? updated : t)));
      } catch (err) {
        setTasks((prev) =>
          prev.map((t) => (t._id === task._id ? { ...t, status: previousStatus } : t))
        );
        if (err.status === 401) {
          navigate('/login');
          return;
        }
        showToast(err.message || 'Could not update task.', 'error');
      }
    },
    [navigate, showToast]
  );

  const handleDelete = async (id) => {
    const previous = tasks;
    setTasks((prev) => prev.filter((t) => t._id !== id));
    setConfirmingTask(null);
    try {
      await deleteTask(id);
      showToast('Task deleted.', 'success');
    } catch (err) {
      setTasks(previous);
      if (err.status === 401) {
        navigate('/login');
        return;
      }
      showToast(err.message || 'Could not delete task.', 'error');
    }
  };

  // Must stay ABOVE the early returns below (Rules of Hooks).
  const visibleTasks = useMemo(
    () =>
      tasks.filter((t) => {
        const statusOk = filterStatus === 'all' || (t.status || 'pending') === filterStatus;
        const priorityOk = filterPriority === 'all' || t.priority === filterPriority;
        return statusOk && priorityOk;
      }),
    [tasks, filterStatus, filterPriority]
  );

  if (loading) {
    return (
      <section className="section" style={{ textAlign: 'center', padding: '60px 0' }}>
        <span className="section__title section__title--projects">Tasks</span>
        <h3 style={{ color: 'var(--text)', marginTop: '16px', fontFamily: 'var(--font-display)' }}>
          Loading tasks...
        </h3>
        <div style={spinnerStyle}></div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="section" style={{ textAlign: 'center', padding: '60px 0' }}>
        <span className="section__title section__title--projects">Tasks</span>
        <h3 style={{ color: '#ff6b6b', marginTop: '16px', fontFamily: 'var(--font-display)' }}>
          Error Loading Tasks
        </h3>
        <p style={{ color: 'var(--muted)', marginBottom: '20px' }}>{error}</p>
        <button onClick={loadTasks} className="btn btn--outline" style={{ cursor: 'pointer' }}>
          🔄 Retry
        </button>
      </section>
    );
  }

  return (
    <section className="section">
      {confirmingTask && (
        <div style={confirmPanelStyle}>
          <span style={{ color: '#ff6b6b', fontSize: '0.85rem', fontWeight: '600' }}>
            Delete "{confirmingTask.title}"? This can't be undone.
          </span>
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <button
              className="btn btn--outline"
              style={{ padding: '4px 12px', borderColor: '#ff6b6b', color: '#ff6b6b', flex: 1 }}
              onClick={() => handleDelete(confirmingTask._id)}
            >
              Yes, delete
            </button>
            <button
              className="btn btn--outline"
              style={{ padding: '4px 12px', flex: 1 }}
              onClick={() => setConfirmingTask(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '8px',
        }}
      >
        <span style={{ color: 'var(--muted)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
          {userEmail ? `Logged in as ${userEmail}` : ''}
        </span>
        <button className="btn btn--outline" style={{ padding: '4px 14px' }} onClick={handleLogout}>
          Logout
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <span className="section__title section__title--projects" style={{ marginBottom: 0 }}>
          My Tasks
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={inputStyle}>
            {STATUS_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} style={inputStyle}>
            {PRIORITY_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <span style={countBadgeStyle}>
            {visibleTasks.length} {visibleTasks.length === 1 ? 'task' : 'tasks'}
          </span>
          <button
            type="button"
            className="btn btn--outline"
            style={{ padding: '4px 14px' }}
            onClick={() => setShowChart((prev) => !prev)}
          >
            {showChart ? 'Hide chart' : 'Show chart'}
          </button>
        </div>
      </div>

      {/* The chart chunk (recharts) is only requested once showChart is true */}
      {showChart && (
        <Suspense
          fallback={
            <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '40px 0' }}>
              Loading chart...
            </p>
          }
        >
          <TaskChart tasks={tasks} />
        </Suspense>
      )}

      <form onSubmit={handleAddTask} style={{ display: 'flex', gap: '12px', marginBottom: '32px', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Add a new task..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          style={{ ...inputStyle, flex: 1, minWidth: '200px' }}
        />
        <select value={newPriority} onChange={(e) => setNewPriority(e.target.value)} style={inputStyle}>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p[0].toUpperCase() + p.slice(1)}
            </option>
          ))}
        </select>
        <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} style={inputStyle}>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn--solid" disabled={submitting || !newTitle.trim()}>
          {submitting ? 'Adding...' : 'Add Task'}
        </button>
      </form>

      {visibleTasks.length === 0 ? (
        <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '40px 0' }}>
          No tasks match these filters.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '12px' }}>
          {visibleTasks.map((task) => (
            <TaskItem
              key={task._id}
              task={task}
              onStatusChange={handleStatusChange}
              onAskDelete={setConfirmingTask}
            />
          ))}
        </ul>
      )}

      <Toast toast={toast} onClose={closeToast} />
    </section>
  );
};

const spinnerStyle = {
  width: '40px',
  height: '40px',
  border: '4px solid var(--line)',
  borderTop: '4px solid var(--accent)',
  borderRadius: '50%',
  margin: '24px auto',
  animation: 'spin 1s linear infinite',
};

const inputStyle = {
  padding: '10px 16px',
  borderRadius: '999px',
  border: '1px solid var(--line)',
  backgroundColor: 'var(--bg-elevated)',
  color: 'var(--text)',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.85rem',
  outline: 'none',
};

const countBadgeStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: '0.8rem',
  fontWeight: '600',
  color: 'var(--text)',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--line)',
  padding: '4px 12px',
  borderRadius: '999px',
};

const priorityBadgeStyle = (priority) => ({
  fontFamily: 'var(--font-mono)',
  fontSize: '0.7rem',
  textTransform: 'uppercase',
  padding: '2px 8px',
  borderRadius: '999px',
  border: '1px solid var(--line)',
  color: priority === 'high' ? '#ff6b6b' : priority === 'low' ? 'var(--muted)' : 'var(--accent)',
});

const confirmPanelStyle = {
  position: 'fixed',
  top: '90px',
  right: '24px',
  zIndex: 1000,
  width: '300px',
  background: 'var(--bg-elevated)',
  border: '1px solid #ff6b6b',
  borderRadius: '10px',
  padding: '16px',
  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.35)',
  display: 'flex',
  flexDirection: 'column',
};

export default TaskManager;