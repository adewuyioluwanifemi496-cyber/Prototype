import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, fmtDate, qs } from '../api.js';
import { Empty, Result, Sev, Status } from '../components.jsx';

export function useLookups() {
  const [solutions, setSolutions] = useState([]);
  const [types, setTypes] = useState([]);
  useEffect(() => { api('/solutions').then(setSolutions); api('/test-types').then(setTypes); }, []);
  return { solutions, types };
}

export function Filters({ value, onChange, extra }) {
  const { solutions, types } = useLookups();
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="filters">
      <select aria-label="Solution" value={value.solution || ''} onChange={set('solution')}>
        <option value="">All solutions</option>{solutions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <select aria-label="Test type" value={value.test_type || ''} onChange={set('test_type')}>
        <option value="">All test types</option>{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <select aria-label="Result" value={value.result || ''} onChange={set('result')}>
        <option value="">Any result</option><option>Passed</option><option>Issue Found</option>
      </select>
      <select aria-label="Severity" value={value.severity || ''} onChange={set('severity')}>
        <option value="">Any severity</option>{['Low', 'Medium', 'High', 'Critical'].map((s) => <option key={s}>{s}</option>)}
      </select>
      <select aria-label="Status" value={value.status || ''} onChange={set('status')}>
        <option value="">Any status</option>{['Open', 'In Progress', 'Fixed', 'Closed'].map((s) => <option key={s}>{s}</option>)}
      </select>
      <input type="date" aria-label="From date" value={value.from || ''} onChange={set('from')} />
      <input type="date" aria-label="To date" value={value.to || ''} onChange={set('to')} />
      {extra}
      <button className="btn ghost small" onClick={() => onChange({})}>Clear</button>
    </div>
  );
}

export function TestTable({ rows }) {
  const nav = useNavigate();
  if (!rows.length) return <Empty title="No tests found.">Log a test, or loosen the filters.</Empty>;
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Date</th><th>Solution</th><th>Test type</th><th>Result</th><th>Severity</th><th>Status</th><th>Logged by</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={r.issue_id ? 'clickable' : ''} onClick={() => r.issue_id && nav(`/issues/${r.issue_id}`)}>
              <td>{fmtDate(r.logged_at)}</td><td>{r.solution}</td><td>{r.test_type}</td>
              <td><Result value={r.result} /></td><td><Sev value={r.severity} /></td><td><Status value={r.status} /></td><td>{r.logged_by}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function useRows(path, filters) {
  const [data, setData] = useState(null);
  useEffect(() => { api(`${path}${qs(filters)}`).then(setData); }, [path, JSON.stringify(filters)]);
  return data;
}
