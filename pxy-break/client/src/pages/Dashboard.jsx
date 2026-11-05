import React, { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { api, qs } from '../api.js';
import { Empty } from '../components.jsx';
import { useLookups } from './TestTable.jsx';

const SEV = { Low: '#6f86a8', Medium: '#d9a021', High: '#e2702a', Critical: '#c9302c' };
const STAT = { Open: '#c9302c', 'In Progress': '#d9a021', Fixed: '#2f9e6b', Closed: '#7b8494' };
const BRAND = '#3a5bff';

function Chart({ title, children, empty }) {
  return (
    <section className="card chart">
      <h3>{title}</h3>
      {empty ? <p className="muted">No data yet.</p> : <div className="chart-box"><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>}
    </section>
  );
}

const simpleBar = (data, colors) => (
  <BarChart data={data} margin={{ left: -20 }}>
    <CartesianGrid strokeDasharray="3 3" vertical={false} />
    <XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
    <Tooltip />
    <Bar dataKey="value" name="Issues" radius={[4, 4, 0, 0]}>{data.map((d) => <Cell key={d.name} fill={colors?.[d.name] || BRAND} />)}</Bar>
  </BarChart>
);

export default function Dashboard() {
  const { solutions } = useLookups();
  const [solution, setSolution] = useState('');
  const [s, setS] = useState(null);
  useEffect(() => { api(`/stats${qs({ solution })}`).then(setS); }, [solution]);
  if (!s) return null;
  const none = s.total_tests === 0;
  return (
    <>
      <header className="page-head">
        <h1>Issues dashboard</h1>
        <p>{s.summary}</p>
      </header>
      <div className="filters">
        <select aria-label="Solution" value={solution} onChange={(e) => setSolution(e.target.value)}>
          <option value="">All solutions</option>{solutions.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </div>
      {none ? <Empty title="No tests logged yet.">Log your first test.</Empty> : (
        <>
          <div className="kpis">
            <div className="kpi"><span>Tests run</span><strong>{s.total_tests}</strong></div>
            <div className="kpi"><span>Tests with issues</span><strong>{s.tests_with_issues}</strong></div>
            <div className="kpi"><span>Pass rate</span><strong>{s.pass_rate}%</strong></div>
            <div className="kpi"><span>Open issues</span><strong>{s.open_issues}</strong></div>
            <div className={`kpi ${s.critical_open ? 'alert' : ''}`}><span>Critical open</span><strong>{s.critical_open}</strong></div>
          </div>
          <div className="charts">
            <Chart title="Issues by severity" empty={!s.tests_with_issues}>{simpleBar(s.by_severity, SEV)}</Chart>
            <Chart title="Issues by solution" empty={!s.tests_with_issues}>{simpleBar(s.by_solution)}</Chart>
            <Chart title="Issues by test type" empty={!s.tests_with_issues}>{simpleBar(s.by_test_type)}</Chart>
            <Chart title="Open vs fixed" empty={!s.tests_with_issues}>
              <PieChart>
                <Pie data={s.open_vs_fixed.filter((d) => d.value)} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                  {s.open_vs_fixed.filter((d) => d.value).map((d) => <Cell key={d.name} fill={STAT[d.name]} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </Chart>
            <Chart title="Issues over time" empty={!s.over_time.length}>
              <LineChart data={s.over_time} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip /><Line dataKey="value" name="Issues" stroke={BRAND} strokeWidth={2} dot />
              </LineChart>
            </Chart>
          </div>
        </>
      )}
    </>
  );
}
