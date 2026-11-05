import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../App.jsx';

export default function Home() {
  const { user } = useApp();
  const [s, setS] = useState(null);
  useEffect(() => { api('/stats').then(setS); }, []);
  return (
    <>
      <header className="page-head">
        <h1>Welcome, {user.full_name.split(' ')[0]}</h1>
        <p>{s ? s.summary : ''}</p>
      </header>
      {s && (
        <div className="kpis three">
          <div className="kpi"><span>Tests run</span><strong>{s.total_tests}</strong></div>
          <div className="kpi"><span>Issues found</span><strong>{s.tests_with_issues}</strong></div>
          <div className="kpi"><span>Open issues</span><strong>{s.open_issues}</strong></div>
        </div>
      )}
      <div className="row">
        <Link to="/log" className="btn">Log a test</Link>
        <Link to="/dashboard" className="btn ghost">See the dashboard</Link>
      </div>
    </>
  );
}
