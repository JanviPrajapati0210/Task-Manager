import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

function TaskChart({ tasks }) {
  const data = STATUSES.map(({ value, label }) => ({
    status: label,
    count: tasks.filter((t) => (t.status || 'pending') === value).length,
  }));

  return (
    <div style={{ width: '100%', height: 260, marginBottom: '32px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#8a859c" strokeOpacity={0.3} />
          <XAxis dataKey="status" stroke="#8a859c" />
          <YAxis allowDecimals={false} stroke="#8a859c" />
          <Tooltip />
          <Bar dataKey="count" fill="#9b8cf0" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default TaskChart;