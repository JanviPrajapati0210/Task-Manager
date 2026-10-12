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
  getStats,
  downloadPdf,
} from '../api';
import Toast from './Toast';
import SessionTimer from './SessionTimer';

// Heavy component (pulls in the whole recharts library). Downloaded only when
// the user clicks "Show chart" for the first time.
const TaskChart = lazy(() => import('./TaskChart'));

const PRIORITIES = ['low', 'medium', 'high'];

const STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

// Status workflow is forward-only: pending -> in-progress -> completed
const STATUS_RANK = { pending: 1, 'in-progress': 2, completed: 3 };
const rankOf = (status) => STATUS_RANK[status || 'pending'] || 1;

const TABS = [{ value: 'all', label: 'All' }, ...STATUSES];

const PRIORITY_FILTERS = [
  { value: 'all', label: 'Priority' },
  ...PRIORITIES.map((p) => ({ value: p, label: p[0].toUpperCase() + p.slice(1) })),
];

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // auto-logout after 30 minutes of inactivity

const isStaffRole = (role) => role === 'admin' || role === 'manager';

// YYYY-MM-DD in the user's LOCAL time zone (toISOString() would shift the day)
const toLocalISODate = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;

// Memoised row: re-renders only when its own `task` (or the stable callbacks)
// change, not every time the parent re-renders (e.g. while typing a new title).
const TaskItem = memo(function TaskItem({ task, showOwner, onStatusChange, onEdit, onAskDelete }) {
  const status = task.status || 'pending';
  const owner =
    task.user && typeof task.user === 'object' ? task.user.username || task.user.email : null;

  const meta = [
    task.createdAt ? `Created ${new Date(task.createdAt).toLocaleDateString()}` : null,
    showOwner ? `Assigned to ${owner || 'unknown'}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <li className="projects__card task-row" style={{ opacity: task.__optimistic ? 0.6 : 1 }}>
      <div className="task-row__main">
        <div className="task-row__title">
          <span style={{ color: 'var(--text)' }}>{task.title}</span>
          <span style={priorityBadgeStyle(task.priority)}>{task.priority}</span>
        </div>
        {task.description && <p className="task-row__desc">{task.description}</p>}
        {meta && <p className="task-row__meta">{meta}</p>}
      </div>

      <div className="task-row__actions">
        {/* Forward-only: statuses BEFORE the current one are disabled */}
        <select
          value={status}
          onChange={(e) => onStatusChange(task, e.target.value)}
          disabled={task.__optimistic}
          style={inputStyle}
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value} disabled={rankOf(s.value) < rankOf(status)}>
              {s.label}
            </option>
          ))}
        </select>

        <button
          className="btn btn--outline"
          style={{ padding: '4px 12px' }}
          onClick={() => onEdit(task)}
          disabled={task.__optimistic}
        >
          Edit
        </button>
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
  const [user, setUser] = useState(null);

  // add-task form
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState('medium');
  const [newStatus, setNewStatus] = useState('pending');
  const [submitting, setSubmitting] = useState(false);

  // list filters
  const [activeTab, setActiveTab] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');

  // dialogs / UI
  const [confirmingTask, setConfirmingTask] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', priority: 'medium', status: 'pending' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [toast, setToast] = useState(null);
  const [showChart, setShowChart] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // admin report
  const [report, setReport] = useState({ startDate: '', endDate: '', status: 'all', allUsers: 'true' });
  const [reportStats, setReportStats] = useState(null);
  const [reportBusy, setReportBusy] = useState(false);

  const isStaff = isStaffRole(user?.role);
  const isAdmin = user?.role === 'admin';

  const showToast = useCallback((message, type = 'success') => setToast({ message, type }), []);
  const closeToast = useCallback(() => setToast(null), []);

  // Returns true when the error was a 401 (token expired) and we already redirected
  const handleAuthError = useCallback(
    (err) => {
      if (err.status === 401) {
        navigate('/login');
        return true;
      }
      return false;
    },
    [navigate]
  );

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTasks();
      setTasks(data);
    } catch (err) {
      if (handleAuthError(err)) return;
      setError(err.message || 'Failed to load tasks.');
    } finally {
      setLoading(false);
    }
  }, [handleAuthError]);

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate('/login');
      return;
    }
    getMe()
      .then(setUser)
      .catch(() => {
        // token invalid/expired even before the first task fetch
        navigate('/login');
      });
    loadTasks();
  }, [loadTasks, navigate]);

  const handleLogout = useCallback(async () => {
    await logoutUser();
    navigate('/login');
  }, [navigate]);

  const handleSessionExpired = useCallback(async () => {
    await logoutUser();
    window.alert('Your session has timed out due to inactivity. Please log in again.');
    navigate('/login');
  }, [navigate]);

  const handleAddTask = async (e) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    const description = newDescription.trim();

    const tempId = `temp-${Date.now()}`;
    const optimisticTask = {
      _id: tempId,
      title,
      description,
      priority: newPriority,
      status: newStatus,
      createdAt: new Date().toISOString(),
      user: user ? { username: user.username, email: user.email } : null,
      __optimistic: true,
    };
    setTasks((prev) => [optimisticTask, ...prev]);
    setNewTitle('');
    setNewDescription('');
    setSubmitting(true);

    try {
      const created = await createTask({ title, description, priority: newPriority, status: newStatus });
      setTasks((prev) => prev.map((t) => (t._id === tempId ? created : t)));
      showToast('Task added.', 'success');
    } catch (err) {
      setTasks((prev) => prev.filter((t) => t._id !== tempId));
      if (handleAuthError(err)) return;
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
        if (newStatusValue === 'completed') {
          showToast('Task completed. A notification email was sent.', 'success');
        }
      } catch (err) {
        setTasks((prev) =>
          prev.map((t) => (t._id === task._id ? { ...t, status: previousStatus } : t))
        );
        if (handleAuthError(err)) return;
        showToast(err.message || 'Could not update task.', 'error');
      }
    },
    [handleAuthError, showToast]
  );

  const openEdit = useCallback((task) => {
    setEditingTask(task);
    setEditForm({
      title: task.title,
      description: task.description || '',
      priority: task.priority || 'medium',
      status: task.status || 'pending',
    });
  }, []);

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    const title = editForm.title.trim();
    if (!title) {
      showToast('Title cannot be empty.', 'error');
      return;
    }

    const payload = {
      title,
      description: editForm.description.trim(),
      priority: editForm.priority,
    };
    // Only send the status when it really changed (forward-only rule on the server)
    if (editForm.status !== (editingTask.status || 'pending')) {
      payload.status = editForm.status;
    }

    setSavingEdit(true);
    try {
      const updated = await updateTask(editingTask._id, payload);
      setTasks((prev) => prev.map((t) => (t._id === updated._id ? updated : t)));
      setEditingTask(null);
      showToast('Task updated.', 'success');
    } catch (err) {
      if (handleAuthError(err)) return;
      showToast(err.message || 'Could not update task.', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (id) => {
    const previous = tasks;
    setTasks((prev) => prev.filter((t) => t._id !== id));
    setConfirmingTask(null);
    try {
      await deleteTask(id);
      showToast('Task deleted.', 'success');
    } catch (err) {
      setTasks(previous);
      if (handleAuthError(err)) return;
      showToast(err.message || 'Could not delete task.', 'error');
    }
  };

  // PDF of the tasks in the currently selected tab (admin/manager: everyone's tasks)
  const handleDownloadTab = async () => {
    setDownloading(true);
    try {
      const path = activeTab === 'all' ? '/tasks/report/pdf' : `/tasks/download/${activeTab}`;
      await downloadPdf(
        path,
        { priority: filterPriority, allUsers: isStaff ? 'true' : undefined },
        `tasks-${activeTab}-${Date.now()}.pdf`
      );
    } catch (err) {
      if (handleAuthError(err)) return;
      showToast(err.message || 'Could not download the PDF.', 'error');
    } finally {
      setDownloading(false);
    }
  };

  // ---------- Admin: date-range report ----------

  const reportParams = () => ({
    startDate: report.startDate,
    endDate: report.endDate,
    status: report.status,
    allUsers: report.allUsers === 'true' ? 'true' : undefined,
  });

  const updateReport = (field, value) => {
    setReport((prev) => ({ ...prev, [field]: value }));
    setReportStats(null);
  };

  const setReportPreset = (preset) => {
    if (preset === 'month') {
      const now = new Date();
      setReport((prev) => ({
        ...prev,
        startDate: toLocalISODate(new Date(now.getFullYear(), now.getMonth(), 1)),
        endDate: toLocalISODate(now),
      }));
    } else {
      setReport((prev) => ({ ...prev, startDate: '', endDate: '' }));
    }
    setReportStats(null);
  };

  const handlePreviewStats = async () => {
    setReportBusy(true);
    try {
      setReportStats(await getStats(reportParams()));
    } catch (err) {
      if (handleAuthError(err)) return;
      showToast(err.message || 'Could not load statistics.', 'error');
    } finally {
      setReportBusy(false);
    }
  };

  const handleDownloadReport = async (e) => {
    e.preventDefault();
    setReportBusy(true);
    try {
      await downloadPdf(
        '/tasks/report/pdf',
        reportParams(),
        `Admin-Task-Report-${report.startDate || 'all'}-to-${report.endDate || 'all'}.pdf`
      );
    } catch (err) {
      if (handleAuthError(err)) return;
      showToast(err.message || 'Could not generate the report.', 'error');
    } finally {
      setReportBusy(false);
    }
  };

  // Must stay ABOVE the early returns below (Rules of Hooks).
  const counts = useMemo(
    () => ({
      all: tasks.length,
      pending: tasks.filter((t) => (t.status || 'pending') === 'pending').length,
      'in-progress': tasks.filter((t) => t.status === 'in-progress').length,
      completed: tasks.filter((t) => t.status === 'completed').length,
    }),
    [tasks]
  );

  const visibleTasks = useMemo(
    () =>
      tasks.filter((t) => {
        const statusOk = activeTab === 'all' || (t.status || 'pending') === activeTab;
        const priorityOk = filterPriority === 'all' || t.priority === filterPriority;
        return statusOk && priorityOk;
      }),
    [tasks, activeTab, filterPriority]
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

      {editingTask && (
        <div className="modal-backdrop" onClick={() => setEditingTask(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSaveEdit}>
            <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}>Edit task</h3>
            <input
              type="text"
              value={editForm.title}
              onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Title"
              style={inputStyle}
              required
            />
            <textarea
              rows={3}
              value={editForm.description}
              onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Description (optional)"
              style={{ ...inputStyle, borderRadius: '12px', resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <select
                value={editForm.priority}
                onChange={(e) => setEditForm((f) => ({ ...f, priority: e.target.value }))}
                style={{ ...inputStyle, flex: 1 }}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p[0].toUpperCase() + p.slice(1)}
                  </option>
                ))}
              </select>
              <select
                value={editForm.status}
                onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                style={{ ...inputStyle, flex: 1 }}
              >
                {STATUSES.map((s) => (
                  <option
                    key={s.value}
                    value={s.value}
                    disabled={rankOf(s.value) < rankOf(editingTask.status)}
                  >
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn--outline" onClick={() => setEditingTask(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn--solid" disabled={savingEdit}>
                {savingEdit ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ---------- User bar: who is logged in, role, session timer, logout ---------- */}
      <div className="user-bar">
        <div className="user-bar__info">
          <strong style={{ color: 'var(--text)' }}>{user ? user.username || user.email : ''}</strong>
          {user && <span className={`role-badge role-${user.role}`}>{user.role}</span>}
          {user && user.username && <small>{user.email}</small>}
        </div>
        <div className="user-bar__actions">
          <SessionTimer timeoutMs={IDLE_TIMEOUT_MS} onExpire={handleSessionExpired} />
          <button className="btn btn--outline" style={{ padding: '4px 14px' }} onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>

      {isAdmin && (
        <div className="admin-banner">
          <strong>Admin mode:</strong> you can see every user's tasks and generate date-range PDF
          reports.
        </div>
      )}

      {/* ---------- Admin only: date-range report ---------- */}
      {isAdmin && (
        <form className="report-card" onSubmit={handleDownloadReport}>
          <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}>Admin report</h3>
          <div className="report-card__grid">
            <label>
              <span>From</span>
              <input
                type="date"
                value={report.startDate}
                onChange={(e) => updateReport('startDate', e.target.value)}
                style={inputStyle}
              />
            </label>
            <label>
              <span>To</span>
              <input
                type="date"
                value={report.endDate}
                onChange={(e) => updateReport('endDate', e.target.value)}
                style={inputStyle}
              />
            </label>
            <label>
              <span>Status</span>
              <select
                value={report.status}
                onChange={(e) => updateReport('status', e.target.value)}
                style={inputStyle}
              >
                <option value="all">All statuses</option>
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Users</span>
              <select
                value={report.allUsers}
                onChange={(e) => updateReport('allUsers', e.target.value)}
                style={inputStyle}
              >
                <option value="true">All users</option>
                <option value="false">Only me</option>
              </select>
            </label>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '14px' }}>
            <button type="button" className="btn btn--outline" onClick={() => setReportPreset('month')}>
              This month
            </button>
            <button type="button" className="btn btn--outline" onClick={() => setReportPreset('all')}>
              All time
            </button>
            <button
              type="button"
              className="btn btn--outline"
              onClick={handlePreviewStats}
              disabled={reportBusy}
            >
              Preview stats
            </button>
            <button type="submit" className="btn btn--solid" disabled={reportBusy}>
              {reportBusy ? 'Working...' : 'Download PDF report'}
            </button>
          </div>

          {reportStats && (
            <p className="report-card__stats">
              Total {reportStats.total} · Pending {reportStats.pending} · In progress{' '}
              {reportStats.inProgress} · Completed {reportStats.completed} · Completion{' '}
              {reportStats.completionRate}%
            </p>
          )}
        </form>
      )}

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
          {isStaff ? 'All Tasks' : 'My Tasks'}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
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
            onClick={handleDownloadTab}
            disabled={downloading}
          >
            {downloading ? 'Preparing...' : 'Download PDF'}
          </button>
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

      <form
        onSubmit={handleAddTask}
        style={{ display: 'grid', gap: '12px', marginBottom: '32px' }}
      >
        <input
          type="text"
          placeholder="Add a new task..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          style={inputStyle}
        />
        <textarea
          rows={2}
          placeholder="Description (optional)"
          value={newDescription}
          onChange={(e) => setNewDescription(e.target.value)}
          style={{ ...inputStyle, borderRadius: '12px', resize: 'vertical' }}
        />
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
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
        </div>
      </form>

      {/* ---------- Status tabs with live counts ---------- */}
      <div className="status-tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.value}
            className={`status-tab${activeTab === tab.value ? ' status-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.value)}
          >
            {tab.label}
            <span className="status-tab__count">{counts[tab.value]}</span>
          </button>
        ))}
      </div>

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
              showOwner={isStaff}
              onStatusChange={handleStatusChange}
              onEdit={openEdit}
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