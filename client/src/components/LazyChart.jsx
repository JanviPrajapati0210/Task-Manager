import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

const STATUS_CONFIG = [
  { value: 'completed', label: 'Completed', color: '#10b981' },
  { value: 'in-progress', label: 'In Progress', color: '#3b82f6' },
  { value: 'pending', label: 'Pending', color: '#f59e0b' },
];

function LazyChart({ tasks = [] }) {
  const data = STATUS_CONFIG.map(({ value, label, color }) => ({
    status: label,
    count: tasks.filter((t) => (t.status || 'pending') === value).length,
    color,
  }));

  return (
    <div className="v8-lazy-chart-container" style={{ width: '100%', height: 280, marginTop: '20px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" strokeOpacity={0.6} />
          <XAxis dataKey="status" stroke="var(--muted)" tick={{ fill: 'var(--muted)', fontSize: 13 }} />
          <YAxis allowDecimals={false} stroke="var(--muted)" tick={{ fill: 'var(--muted)', fontSize: 13 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--bg-elevated)',
              borderRadius: '8px',
              border: '1px solid var(--line)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
              color: 'var(--text)',
            }}
          />
          <Bar dataKey="count" radius={[6, 6, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default LazyChart;
