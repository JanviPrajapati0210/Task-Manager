import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  isLoggedIn,
  getMe,
  downloadPdf,
} from '../api';
import Toast from './Toast';
import AiTaskAssistant from './AiTaskAssistant';

// Heavy component lazy-loaded on demand (Practical 8 requirement)
const TaskChart = lazy(() => import('./TaskChart'));

const PRIORITIES = ['low', 'medium', 'high'];

const STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

// Forward-only status workflow: pending -> in-progress -> completed
const STATUS_RANK = { pending: 1, 'in-progress': 2, completed: 3 };
const rankOf = (status) => STATUS_RANK[status || 'pending'] || 1;

const isStaffRole = (role) => role === 'admin' || role === 'manager';

const TaskManager = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');

  // Modals & Forms
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState('medium');
  const [newStatus, setNewStatus] = useState('pending');
  const [submitting, setSubmitting] = useState(false);

  const [editingTask, setEditingTask] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', priority: 'medium', status: 'pending' });
  const [savingEdit, setSavingEdit] = useState(false);

  const [confirmingTask, setConfirmingTask] = useState(null);
  const [toast, setToast] = useState(null);
  const [showChart, setShowChart] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Admin report date range
  const [report, setReport] = useState({ startDate: '', endDate: '', status: 'all', allUsers: 'true' });
  const [reportBusy, setReportBusy] = useState(false);

  const isStaff = isStaffRole(user?.role);
  const isAdmin = user?.role === 'admin';

  const showToast = useCallback((message, type = 'success') => setToast({ message, type }), []);
  const closeToast = useCallback(() => setToast(null), []);

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

  // Load user profile & tasks
  const loadData = useCallback(async () => {
    if (!isLoggedIn()) {
      navigate('/login');
      return;
    }
    setLoading(true);
    try {
      const [userData, taskData] = await Promise.all([getMe(), getTasks()]);
      setUser(userData);
      setTasks(taskData || []);
    } catch (err) {
      if (!handleAuthError(err)) {
        showToast(err.message || 'Failed to load tasks', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [navigate, handleAuthError, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Add New Task
  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      showToast('Task title is required.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const created = await createTask({
        title: newTitle.trim(),
        description: newDescription.trim(),
        priority: newPriority,
        status: newStatus,
      });

      // Update state with newly created task
      setTasks((prev) => [created, ...prev]);
      showToast('Task created successfully!', 'success');
      setShowNewModal(false);
      setNewTitle('');
      setNewDescription('');
      setNewPriority('medium');
      setNewStatus('pending');
    } catch (err) {
      if (!handleAuthError(err)) {
        showToast(err.message || 'Failed to create task.', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Quick Status Transition (e.g. Start Task -> In Progress, Complete Task -> Completed)
  const handleAdvanceStatus = async (task, targetStatus) => {
    // Forward-only check
    if (rankOf(targetStatus) < rankOf(task.status)) {
      showToast(`Cannot move backwards from ${task.status} to ${targetStatus}`, 'error');
      return;
    }

    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) => (t._id === task._id ? { ...t, status: targetStatus, __optimistic: true } : t))
    );

    try {
      const updated = await updateTask(task._id, { status: targetStatus });
      setTasks((prev) =>
        prev.map((t) => (t._id === task._id ? { ...updated, __optimistic: false } : t))
      );
      showToast(`Task status updated to ${targetStatus.replace('-', ' ')}`, 'success');
    } catch (err) {
      // Revert optimistic update on failure
      setTasks((prev) => prev.map((t) => (t._id === task._id ? task : t)));
      if (!handleAuthError(err)) {
        showToast(err.message || 'Failed to update task status.', 'error');
      }
    }
  };

  // Open Edit Modal
  const handleStartEdit = (task) => {
    setEditingTask(task);
    setEditForm({
      title: task.title || '',
      description: task.description || '',
      priority: task.priority || 'medium',
      status: task.status || 'pending',
    });
  };

  // Save Edit Modal
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingTask) return;
    if (!editForm.title.trim()) {
      showToast('Task title cannot be empty.', 'error');
      return;
    }

    setSavingEdit(true);
    try {
      const updated = await updateTask(editingTask._id, {
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        priority: editForm.priority,
        status: editForm.status,
      });

      setTasks((prev) => prev.map((t) => (t._id === editingTask._id ? updated : t)));
      showToast('Task updated successfully.', 'success');
      setEditingTask(null);
    } catch (err) {
      if (!handleAuthError(err)) {
        showToast(err.message || 'Failed to save changes.', 'error');
      }
    } finally {
      setSavingEdit(false);
    }
  };

  // Handle Delete Task
  const handleDeleteTask = async (taskId) => {
    try {
      await deleteTask(taskId);
      setTasks((prev) => prev.filter((t) => t._id !== taskId));
      showToast('Task deleted successfully.', 'success');
      setConfirmingTask(null);
    } catch (err) {
      if (!handleAuthError(err)) {
        showToast(err.message || 'Failed to delete task.', 'error');
      }
    }
  };

  // Admin PDF Download
  const handleDownloadReport = async (e) => {
    e.preventDefault();
    setReportBusy(true);
    try {
      const params = {};
      if (report.startDate) params.startDate = report.startDate;
      if (report.endDate) params.endDate = report.endDate;
      if (report.status !== 'all') params.status = report.status;
      if (report.allUsers) params.allUsers = report.allUsers;

      const blob = await downloadPdf(params);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tasks-report-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast('Report downloaded successfully.', 'success');
    } catch (err) {
      if (!handleAuthError(err)) {
        showToast(err.message || 'Failed to download PDF report.', 'error');
      }
    } finally {
      setReportBusy(false);
    }
  };

  // Filter tasks based on live search, status, and priority
  const visibleTasks = useMemo(() => {
    return tasks.filter((task) => {
      // 1. Status Filter
      if (filterStatus !== 'all' && task.status !== filterStatus) {
        return false;
      }

      // 2. Priority Filter
      if (filterPriority !== 'all' && task.priority !== filterPriority) {
        return false;
      }

      // 3. Search Query Filter (searches title, description, and assignee name/email)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const titleMatch = (task.title || '').toLowerCase().includes(query);
        const descMatch = (task.description || '').toLowerCase().includes(query);
        const assigneeName =
          task.user && typeof task.user === 'object'
            ? `${task.user.username || ''} ${task.user.name || ''} ${task.user.email || ''}`.toLowerCase()
            : '';
        const assigneeMatch = assigneeName.includes(query);

        if (!titleMatch && !descMatch && !assigneeMatch) {
          return false;
        }
      }

      return true;
    });
  }, [tasks, filterStatus, filterPriority, searchQuery]);

  // Mode Subtitle description
  const modeSubtitle = useMemo(() => {
    if (isAdmin) {
      return 'Admin Mode: Manage organization tasks, view all team activity, and generate reports.';
    }
    if (isStaff) {
      return 'Manager Mode: Oversee assigned team tasks and manage project workflows.';
    }
    return 'Employee Mode: Manage assigned tasks and add personal work items.';
  }, [isAdmin, isStaff]);

  return (
    <div className="board-container">
      {toast && <Toast message={toast.message} type={toast.type} onClose={closeToast} />}

      {/* =========================================================================
          BOARD HEADER: Icon + Title + Subtitle + "+ New Task" Action Button
         ========================================================================= */}
      <div className="board-header">
        <div className="board-header__left">
          <div className="board-header__icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
          <div>
            <h1 className="board-header__title">Tasks &amp; Project Board</h1>
            <p className="board-header__subtitle">{modeSubtitle}</p>
          </div>
        </div>

        <div className="board-header__actions">
          {isAdmin && (
            <button
              type="button"
              className="btn btn--outline board-header__btn"
              onClick={() => setShowAdminPanel((prev) => !prev)}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
              <span>{showAdminPanel ? 'Hide Reports' : 'PDF Reports'}</span>
            </button>
          )}

          <button
            type="button"
            className="btn btn--outline board-header__btn"
            onClick={() => setShowChart((prev) => !prev)}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"></line>
              <line x1="12" y1="20" x2="12" y2="4"></line>
              <line x1="6" y1="20" x2="6" y2="14"></line>
            </svg>
            <span>{showChart ? 'Hide Chart' : 'Show Chart'}</span>
          </button>

          <button
            type="button"
            className="btn btn--outline board-header__btn"
            style={{ borderColor: 'var(--accent)', color: 'var(--accent)', gap: '6px' }}
            onClick={() => {
              setNewTitle('');
              setNewDescription('');
              setShowNewModal(true);
            }}
            title="Create task with AI assistance"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
            <span>✨ AI Assist</span>
          </button>

          <button
            type="button"
            className="board-btn-new-task"
            onClick={() => setShowNewModal(true)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          ADMIN ONLY COLLAPSIBLE REPORT DRAWER
         ========================================================================= */}
      {isAdmin && showAdminPanel && (
        <form className="report-card" onSubmit={handleDownloadReport} style={{ marginBottom: '24px' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--text)', marginBottom: '14px' }}>
            Admin PDF &amp; Range Reports
          </h3>
          <div className="report-card__grid">
            <label>
              <span>From Date</span>
              <input
                type="date"
                value={report.startDate}
                onChange={(e) => setReport((r) => ({ ...r, startDate: e.target.value }))}
              />
            </label>
            <label>
              <span>To Date</span>
              <input
                type="date"
                value={report.endDate}
                onChange={(e) => setReport((r) => ({ ...r, endDate: e.target.value }))}
              />
            </label>
            <label>
              <span>Status</span>
              <select
                value={report.status}
                onChange={(e) => setReport((r) => ({ ...r, status: e.target.value }))}
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
              <span>User Scope</span>
              <select
                value={report.allUsers}
                onChange={(e) => setReport((r) => ({ ...r, allUsers: e.target.value }))}
              >
                <option value="true">All users</option>
                <option value="false">Only my tasks</option>
              </select>
            </label>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
            <button type="submit" className="btn btn--solid" disabled={reportBusy}>
              {reportBusy ? 'Generating...' : 'Download PDF Report'}
            </button>
          </div>
        </form>
      )}

      {/* =========================================================================
          LAZY LOADED ANALYTICS CHART
         ========================================================================= */}
      {showChart && (
        <div style={{ marginBottom: '24px' }}>
          <Suspense fallback={<p style={{ color: 'var(--muted)', textAlign: 'center', padding: '30px 0' }}>Loading chart...</p>}>
            <TaskChart tasks={tasks} />
          </Suspense>
        </div>
      )}

      {/* =========================================================================
          UNIFIED SEARCH & FILTER BAR
         ========================================================================= */}
      <div className="board-toolbar">
        <div className="board-search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="board-search__icon">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            placeholder="Search by title, description or assignee..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="board-search__input"
          />
          {searchQuery && (
            <button
              type="button"
              className="board-search__clear"
              onClick={() => setSearchQuery('')}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        <div className="board-filters">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="board-filter-select"
            aria-label="Filter by Status"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>

          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="board-filter-select"
            aria-label="Filter by Priority"
          >
            <option value="all">All Priorities</option>
            <option value="low">Low Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="high">High Priority</option>
          </select>
        </div>
      </div>

      {/* =========================================================================
          TASKS CARDS GRID (Matches user uploaded screenshot)
         ========================================================================= */}
      {loading ? (
        <div className="board-loading">
          <div className="page-loader__spinner"></div>
          <p>Loading your board tasks...</p>
        </div>
      ) : visibleTasks.length === 0 ? (
        <div className="board-empty-state">
          <div className="board-empty-state__icon">📋</div>
          <h3>No tasks found</h3>
          <p>
            {searchQuery || filterStatus !== 'all' || filterPriority !== 'all'
              ? 'No tasks match your active filters. Try clearing filters or search query.'
              : 'You do not have any tasks yet. Click "+ New Task" to create your first task!'}
          </p>
          {(searchQuery || filterStatus !== 'all' || filterPriority !== 'all') && (
            <button
              type="button"
              className="btn btn--outline"
              style={{ marginTop: '14px', padding: '6px 18px', fontSize: '0.88rem' }}
              onClick={() => {
                setSearchQuery('');
                setFilterStatus('all');
                setFilterPriority('all');
              }}
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="board-grid">
          {visibleTasks.map((task) => {
            const ownerName =
              task.user && typeof task.user === 'object'
                ? task.user.username || task.user.name || task.user.email
                : user?.username || user?.name || (user?.email ? user.email.split('@')[0] : 'VidhiPatel');

            const priority = (task.priority || 'medium').toLowerCase();
            const status = (task.status || 'pending').toLowerCase();

            return (
              <div
                key={task._id}
                className={`board-card board-card--priority-${priority}`}
                style={{ opacity: task.__optimistic ? 0.6 : 1 }}
              >
                {/* Badges Row */}
                <div className="board-card__badges">
                  <span className={`board-badge-priority board-badge-priority--${priority}`}>
                    {priority.toUpperCase()} PRIORITY
                  </span>
                  <span className={`board-badge-status board-badge-status--${status}`}>
                    {status.replace('-', ' ').toUpperCase()}
                  </span>
                </div>

                {/* Task Title */}
                <h3 className="board-card__title">{task.title}</h3>

                {/* Task Description */}
                {task.description && (
                  <p className="board-card__desc">{task.description}</p>
                )}

                {/* Assignee Box */}
                <div className="board-card__assignee">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                  <span>
                    Assigned To: <strong>{ownerName}</strong>
                  </span>
                </div>

                {/* Card Action Footer */}
                <div className="board-card__footer">
                  {status === 'pending' && (
                    <button
                      type="button"
                      className="board-btn-action"
                      onClick={() => handleAdvanceStatus(task, 'in-progress')}
                      disabled={task.__optimistic}
                      title="Start working on this task"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <circle cx="12" cy="12" r="4"></circle>
                      </svg>
                      <span>Start Task</span>
                    </button>
                  )}

                  {status === 'in-progress' && (
                    <button
                      type="button"
                      className="board-btn-action board-btn-action--complete"
                      onClick={() => handleAdvanceStatus(task, 'completed')}
                      disabled={task.__optimistic}
                      title="Mark task as complete"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                      <span>Complete Task</span>
                    </button>
                  )}

                  {status === 'completed' && (
                    <div className="board-badge-completed" title="Task is completed">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                      <span>Completed</span>
                    </div>
                  )}

                  {/* Icon Actions: Edit & Delete */}
                  <div className="board-card__icon-actions">
                    <button
                      type="button"
                      className="board-btn-icon"
                      title="Edit task"
                      onClick={() => handleStartEdit(task)}
                      disabled={task.__optimistic}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9"></path>
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                      </svg>
                    </button>

                    <button
                      type="button"
                      className="board-btn-icon board-btn-icon--delete"
                      title="Delete task"
                      onClick={() => setConfirmingTask(task)}
                      disabled={task.__optimistic}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =========================================================================
          NEW TASK MODAL DIALOG
         ========================================================================= */}
      {showNewModal && (
        <div className="modal-backdrop" onClick={() => setShowNewModal(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleCreateTask}>
            <div className="modal-header">
              <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}>Create New Task</h3>
              <button type="button" className="modal-close" onClick={() => setShowNewModal(false)}>✕</button>
            </div>
            
            <label style={{ display: 'grid', gap: '6px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>Title *</span>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Python Learning"
                required
                autoFocus
              />
            </label>

            {/* AI-Powered Task Assistant (Practical 11) */}
            <AiTaskAssistant
              title={newTitle}
              description={newDescription}
              onApply={({ description, priority }) => {
                if (description) setNewDescription(description);
                if (priority) setNewPriority(priority);
              }}
            />

            <label style={{ display: 'grid', gap: '6px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>Description</span>
              <textarea
                rows={3}
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Brief description of the task or deliverables..."
                style={{ borderRadius: '12px', resize: 'vertical' }}
              />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <label style={{ display: 'grid', gap: '6px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>Priority</span>
                <select value={newPriority} onChange={(e) => setNewPriority(e.target.value)}>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p[0].toUpperCase() + p.slice(1)} Priority
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'grid', gap: '6px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>Initial Status</span>
                <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button
                type="button"
                className="btn btn--outline"
                style={{ padding: '8px 18px', fontSize: '0.9rem' }}
                onClick={() => setShowNewModal(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn--solid"
                style={{ padding: '8px 22px', fontSize: '0.9rem' }}
                disabled={submitting || !newTitle.trim()}
              >
                {submitting ? 'Creating...' : 'Create Task'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =========================================================================
          EDIT TASK MODAL DIALOG
         ========================================================================= */}
      {editingTask && (
        <div className="modal-backdrop" onClick={() => setEditingTask(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSaveEdit}>
            <div className="modal-header">
              <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}>Edit Task</h3>
              <button type="button" className="modal-close" onClick={() => setEditingTask(null)}>✕</button>
            </div>

            <label style={{ display: 'grid', gap: '6px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>Title *</span>
              <input
                type="text"
                value={editForm.title}
                onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Title"
                required
              />
            </label>

            {/* AI-Powered Task Assistant for Edit Modal */}
            <AiTaskAssistant
              title={editForm.title}
              description={editForm.description}
              onApply={({ description, priority }) => {
                setEditForm((prev) => ({
                  ...prev,
                  ...(description ? { description } : {}),
                  ...(priority ? { priority } : {}),
                }));
              }}
            />

            <label style={{ display: 'grid', gap: '6px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>Description</span>
              <textarea
                rows={3}
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Description"
                style={{ borderRadius: '12px', resize: 'vertical' }}
              />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <label style={{ display: 'grid', gap: '6px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>Priority</span>
                <select
                  value={editForm.priority}
                  onChange={(e) => setEditForm((f) => ({ ...f, priority: e.target.value }))}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p[0].toUpperCase() + p.slice(1)} Priority
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'grid', gap: '6px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>Status</span>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
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
              </label>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button
                type="button"
                className="btn btn--outline"
                style={{ padding: '8px 18px', fontSize: '0.9rem' }}
                onClick={() => setEditingTask(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn--solid"
                style={{ padding: '8px 22px', fontSize: '0.9rem' }}
                disabled={savingEdit || !editForm.title.trim()}
              >
                {savingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =========================================================================
          DELETE CONFIRMATION MODAL
         ========================================================================= */}
      {confirmingTask && (
        <div className="modal-backdrop" onClick={() => setConfirmingTask(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--text)', marginBottom: '8px' }}>
              Delete Task
            </h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.92rem', marginBottom: '20px' }}>
              Are you sure you want to delete &ldquo;<strong>{confirmingTask.title}</strong>&rdquo;? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="btn btn--outline"
                style={{ flex: 1, padding: '8px 14px', fontSize: '0.9rem' }}
                onClick={() => setConfirmingTask(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--solid"
                style={{
                  flex: 1,
                  padding: '8px 14px',
                  fontSize: '0.9rem',
                  background: '#ef4444',
                  boxShadow: '0 4px 14px rgba(239, 68, 68, 0.35)',
                }}
                onClick={() => handleDeleteTask(confirmingTask._id)}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskManager;