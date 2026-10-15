import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getUsers, updateUserRole, createTask } from '../api';
import Toast from '../components/Toast';

function TeamPage() {
  const { user, isLoggedIn } = useAuth();
  const navigate = useNavigate();

  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Edit Role modal
  const [editingUser, setEditingUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState('employee');
  const [savingRole, setSavingRole] = useState(false);

  // Assign Task modal
  const [assigningUser, setAssigningUser] = useState(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskPriority, setTaskPriority] = useState('medium');
  const [taskStatus, setTaskStatus] = useState('pending');
  const [savingTask, setSavingTask] = useState(false);

  const fetchTeam = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getUsers();
      setTeam(data || []);
    } catch (err) {
      if (err.status === 401) {
        navigate('/login');
      } else {
        setToast({ message: err.message || 'Failed to load team members.', type: 'error' });
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
    fetchTeam();
  }, [isLoggedIn, navigate, fetchTeam]);

  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';

  const handleOpenEditRole = (targetUser) => {
    if (!isAdmin) {
      setToast({ message: 'Only administrators can change team roles.', type: 'error' });
      return;
    }
    setEditingUser(targetUser);
    setSelectedRole(targetUser.role || 'employee');
  };

  const handleSaveRole = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    setSavingRole(true);
    try {
      await updateUserRole(editingUser.id || editingUser._id, selectedRole);
      setTeam((prev) =>
        prev.map((u) =>
          (u.id || u._id) === (editingUser.id || editingUser._id)
            ? { ...u, role: selectedRole }
            : u
        )
      );
      setToast({
        message: `Updated ${editingUser.username || editingUser.email}'s role to ${selectedRole.toUpperCase()}`,
        type: 'success',
      });
      setEditingUser(null);
    } catch (err) {
      setToast({ message: err.message || 'Failed to update role.', type: 'error' });
    } finally {
      setSavingRole(false);
    }
  };

  const handleOpenAssignTask = (targetUser) => {
    setAssigningUser(targetUser);
    setTaskTitle('');
    setTaskDesc('');
    setTaskPriority('medium');
    setTaskStatus('pending');
  };

  const handleAssignTask = async (e) => {
    e.preventDefault();
    if (!taskTitle.trim() || !assigningUser) return;
    setSavingTask(true);
    try {
      await createTask({
        title: taskTitle.trim(),
        description: taskDesc.trim(),
        priority: taskPriority,
        status: taskStatus,
        userId: assigningUser.id || assigningUser._id,
      });
      setToast({
        message: `Task successfully assigned to ${assigningUser.username || assigningUser.email}!`,
        type: 'success',
      });
      setAssigningUser(null);
    } catch (err) {
      setToast({ message: err.message || 'Failed to assign task.', type: 'error' });
    } finally {
      setSavingTask(false);
    }
  };

  const roleBadgeStyle = (r) => {
    const role = (r || 'user').toLowerCase();
    if (role === 'admin') {
      return {
        bg: '#fdf2f8',
        color: '#db2777',
        border: '#fbcfe8',
        icon: '🛡️',
        label: 'ADMIN',
      };
    }
    if (role === 'manager') {
      return {
        bg: '#f5f3ff',
        color: '#7c3aed',
        border: '#ddd6fe',
        icon: '👔',
        label: 'MANAGER',
      };
    }
    if (role === 'employee') {
      return {
        bg: '#ecfdf5',
        color: '#059669',
        border: '#a7f3d0',
        icon: '👤',
        label: 'EMPLOYEE',
      };
    }
    return {
      bg: '#f0fdf4',
      color: '#16a34a',
      border: '#bbf7d0',
      icon: '👤',
      label: 'USER',
    };
  };

  return (
    <div className="v8-team-page">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header section matching Screenshot 3 */}
      <div className="v8-team-header">
        <h1 className="v8-team-header__title">• Teams and Roles:</h1>
        <p className="v8-team-header__subtitle">
          Administrators can assign tasks to any employee, change user roles, and configure manager-employee hierarchies.
        </p>
      </div>

      {loading ? (
        <div className="v8-empty-state">Loading team members...</div>
      ) : team.length === 0 ? (
        <div className="v8-empty-state">No team members registered yet.</div>
      ) : (
        <div className="v8-team-grid">
          {team.map((member) => {
            const memberId = member.id || member._id;
            const currentUserId = user?.id || user?._id;
            const isSelf = String(memberId) === String(currentUserId);
            const badge = roleBadgeStyle(member.role);

            return (
              <div key={memberId} className="v8-team-card">
                {/* Card Top: Role Badge & 'You' indicator */}
                <div className="v8-team-card__top">
                  <span
                    className="v8-role-badge-tag"
                    style={{
                      background: badge.bg,
                      color: badge.color,
                      borderColor: badge.border,
                    }}
                  >
                    <span>{badge.icon}</span>
                    <span>{badge.label}</span>
                  </span>

                  {isSelf && <span className="v8-you-pill">You</span>}
                </div>

                {/* Card Main: Username & Email */}
                <div className="v8-team-card__main">
                  <h3 className="v8-team-card__name">
                    {member.username || member.email.split('@')[0]}
                  </h3>
                  <div className="v8-team-card__email">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                      <polyline points="22,6 12,13 2,6"></polyline>
                    </svg>
                    <span>{member.email}</span>
                  </div>
                </div>

                {/* Card Bottom: Action buttons */}
                <div className="v8-team-card__actions">
                  <button
                    type="button"
                    className="v8-btn v8-btn--card-primary"
                    onClick={() => handleOpenAssignTask(member)}
                  >
                    + Assign Task
                  </button>
                  <button
                    type="button"
                    className="v8-btn v8-btn--card-secondary"
                    onClick={() => handleOpenEditRole(member)}
                  >
                    ✏️ Edit Role
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Role Modal */}
      {editingUser && (
        <div className="v8-modal-overlay" onClick={() => setEditingUser(null)}>
          <div className="v8-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="v8-modal-header">
              <h3>Edit User Role</h3>
              <button
                type="button"
                className="v8-modal-close"
                onClick={() => setEditingUser(null)}
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleSaveRole} className="v8-modal-form">
              <p style={{ color: 'var(--muted)', fontSize: '0.95rem', marginBottom: '14px' }}>
                Change permissions and hierarchy for <strong>{editingUser.username || editingUser.email}</strong>.
              </p>

              <label>
                <span>Select Role</span>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                >
                  <option value="employee">👤 EMPLOYEE (Staff Member)</option>
                  <option value="user">👤 USER (Standard Member)</option>
                  <option value="manager">👔 MANAGER (Team Supervisor)</option>
                  <option value="admin">🛡️ ADMIN (Full System Access)</option>
                </select>
              </label>

              <div className="v8-modal-actions">
                <button
                  type="button"
                  className="v8-btn v8-btn--outline"
                  onClick={() => setEditingUser(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="v8-btn v8-btn--solid"
                  disabled={savingRole}
                >
                  {savingRole ? 'Saving...' : 'Save Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Task Modal */}
      {assigningUser && (
        <div className="v8-modal-overlay" onClick={() => setAssigningUser(null)}>
          <div className="v8-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="v8-modal-header">
              <h3>Assign Task</h3>
              <button
                type="button"
                className="v8-modal-close"
                onClick={() => setAssigningUser(null)}
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleAssignTask} className="v8-modal-form">
              <p style={{ color: 'var(--muted)', fontSize: '0.95rem', marginBottom: '14px' }}>
                Assigning to: <strong>{assigningUser.username || assigningUser.email}</strong>
              </p>

              <label>
                <span>Task Title *</span>
                <input
                  type="text"
                  placeholder="e.g. Audit security logs"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  required
                />
              </label>

              <label>
                <span>Description (optional)</span>
                <textarea
                  rows={3}
                  placeholder="Provide task expectations and notes..."
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                />
              </label>

              <div className="v8-form-row">
                <label>
                  <span>Priority</span>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value)}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </label>

                <label>
                  <span>Initial Status</span>
                  <select
                    value={taskStatus}
                    onChange={(e) => setTaskStatus(e.target.value)}
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
                  onClick={() => setAssigningUser(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="v8-btn v8-btn--solid"
                  disabled={savingTask}
                >
                  {savingTask ? 'Assigning...' : 'Assign Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default TeamPage;
