import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getTasks, downloadPdf } from '../api';
import Toast from '../components/Toast';

// Lazy-loaded heavy chart component (Practical 8 Optimization)
const LazyChart = lazy(() => import('../components/LazyChart'));

function AnalyticsPage() {
  const { isLoggedIn, user } = useAuth();
  const navigate = useNavigate();

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/login');
      return;
    }
    async function load() {
      try {
        setLoading(true);
        const data = await getTasks();
        setTasks(data || []);
      } catch (err) {
        if (err.status === 401) navigate('/login');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [isLoggedIn, navigate]);

  // Filter tasks by date range if specified
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (!t.createdAt) return true;
      const created = new Date(t.createdAt).getTime();
      if (startDate) {
        const start = new Date(startDate).getTime();
        if (created < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (created > end.getTime()) return false;
      }
      return true;
    });
  }, [tasks, startDate, endDate]);

  const totalInScope = filteredTasks.length;
  const completed = filteredTasks.filter((t) => t.status === 'completed').length;
  const inProgress = filteredTasks.filter((t) => t.status === 'in-progress').length;
  const pending = filteredTasks.filter((t) => (t.status || 'pending') === 'pending').length;

  const completedPct = totalInScope > 0 ? Math.round((completed / totalInScope) * 100) : 0;
  const inProgressPct = totalInScope > 0 ? Math.round((inProgress / totalInScope) * 100) : 0;
  const pendingPct = totalInScope > 0 ? Math.max(0, 100 - completedPct - inProgressPct) : 0;

  const handleExportPDF = async () => {
    try {
      setExporting(true);
      const params = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (user?.role === 'admin') params.allUsers = 'true';

      await downloadPdf('/tasks/report/pdf', params, `tasks-report-${Date.now()}.pdf`);
      setToast({ message: 'PDF report exported successfully!', type: 'success' });
    } catch (err) {
      setToast({ message: err.message || 'Failed to export PDF report.', type: 'error' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="v8-analytics-page">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header section with title and PDF Export button */}
      <div className="v8-page-header">
        <div className="v8-page-header__left">
          <div className="v8-page-header__title-row">
            <span className="v8-page-header__icon">📊</span>
            <h1>Performance Analytics & Reports</h1>
          </div>
          <p className="v8-page-header__subtitle">
            Comprehensive workflow tracking and real-time report generation.
          </p>
        </div>
        <div className="v8-page-header__right">
          <button
            type="button"
            className="v8-btn v8-btn--indigo"
            onClick={handleExportPDF}
            disabled={exporting}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>{exporting ? 'Generating PDF...' : 'Export PDF Report'}</span>
          </button>
        </div>
      </div>

      {/* Code-Split Optimization Callout Box */}
      <div className="v8-optimization-card">
        <div className="v8-optimization-card__icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect>
            <rect x="9" y="9" width="6" height="6"></rect>
            <line x1="9" y1="1" x2="9" y2="4"></line>
            <line x1="15" y1="1" x2="15" y2="4"></line>
            <line x1="9" y1="20" x2="9" y2="23"></line>
            <line x1="15" y1="20" x2="15" y2="23"></line>
            <line x1="20" y1="9" x2="23" y2="9"></line>
            <line x1="20" y1="14" x2="23" y2="14"></line>
            <line x1="1" y1="9" x2="4" y2="9"></line>
            <line x1="1" y1="14" x2="4" y2="14"></line>
          </svg>
        </div>
        <div className="v8-optimization-card__text">
          <h3>Code-Split Heavy Analytics Module (Practical 8 Optimization)</h3>
          <p>
            The chart visualizer below is loaded on-demand using{' '}
            <code>React.lazy(() =&gt; import(&apos;../components/LazyChart&apos;))</code> and wrapped inside a{' '}
            <code>&lt;Suspense&gt;</code> boundary to save initial bundle bandwidth.
          </p>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="v8-filter-bar">
        <div className="v8-filter-bar__inputs">
          <span className="v8-filter-bar__label">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            Filter Date Range:
          </span>
          <label>
            <span>From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>
          <label>
            <span>To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>
          {(startDate || endDate) && (
            <button
              type="button"
              className="v8-btn-link"
              onClick={() => {
                setStartDate('');
                setEndDate('');
              }}
            >
              Reset
            </button>
          )}
        </div>
        <div className="v8-filter-bar__count">
          Total In Scope: <strong>{totalInScope} Tasks</strong>
        </div>
      </div>

      {/* Status Distribution Analysis Card */}
      <div className="v8-panel-card">
        <div className="v8-panel-card__header">
          <div className="v8-panel-card__title-row">
            <span style={{ fontSize: '1.2rem' }}>📈</span>
            <h2 className="v8-panel-card__title">Status Distribution Analysis</h2>
          </div>
          <span className="v8-efficiency-tag">
            {completedPct}% Overall Efficiency
          </span>
        </div>

        <div className="v8-panel-card__body">
          {/* Segmented Multi-Color Progress Bar */}
          <div className="v8-dist-bar">
            {completedPct > 0 && (
              <div
                className="v8-dist-bar__segment v8-dist-bar__segment--completed"
                style={{ width: `${completedPct}%` }}
                title={`Completed: ${completed} (${completedPct}%)`}
              />
            )}
            {inProgressPct > 0 && (
              <div
                className="v8-dist-bar__segment v8-dist-bar__segment--progress"
                style={{ width: `${inProgressPct}%` }}
                title={`In Progress: ${inProgress} (${inProgressPct}%)`}
              />
            )}
            {pendingPct > 0 && (
              <div
                className="v8-dist-bar__segment v8-dist-bar__segment--pending"
                style={{ width: `${pendingPct}%` }}
                title={`Pending: ${pending} (${pendingPct}%)`}
              />
            )}
          </div>

          {/* 3 Metric Breakdown Boxes */}
          <div className="v8-metric-boxes">
            <div className="v8-metric-box v8-metric-box--green">
              <div className="v8-metric-box__title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>Completed</span>
              </div>
              <div className="v8-metric-box__value">
                {completed} <span className="v8-metric-box__pct">({completedPct}%)</span>
              </div>
            </div>

            <div className="v8-metric-box v8-metric-box--blue">
              <div className="v8-metric-box__title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                <span>In Progress</span>
              </div>
              <div className="v8-metric-box__value">
                {inProgress} <span className="v8-metric-box__pct">({inProgressPct}%)</span>
              </div>
            </div>

            <div className="v8-metric-box v8-metric-box--amber">
              <div className="v8-metric-box__title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span>Pending</span>
              </div>
              <div className="v8-metric-box__value">
                {pending} <span className="v8-metric-box__pct">({pendingPct}%)</span>
              </div>
            </div>
          </div>

          {/* Code-Split Lazy Loaded Chart inside Suspense */}
          <Suspense
            fallback={
              <div className="v8-chart-loader">
                <div className="v8-spinner"></div>
                <span>Loading Lazy Analytics Visualizer...</span>
              </div>
            }
          >
            <LazyChart tasks={filteredTasks} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

export default AnalyticsPage;
