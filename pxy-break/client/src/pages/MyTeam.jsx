import React, { useState } from 'react';
import { Filters, TestTable, useRows } from './TestTable.jsx';

export default function MyTeam() {
  const [filters, setFilters] = useState({});
  const data = useRows('/team', filters);
  if (!data) return null;
  const tester = (
    <select aria-label="Tester" value={filters.tester || ''} onChange={(e) => setFilters({ ...filters, tester: e.target.value })}>
      <option value="">All testers</option>
      {data.testers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
    </select>
  );
  return (
    <>
      <header className="page-head"><h1>My team</h1><p>{data.testers.map((t) => t.full_name).join(', ')}. View only.</p></header>
      <div className="kpis three">
        <div className="kpi"><span>Tests run</span><strong>{data.totals.tests_run}</strong></div>
        <div className="kpi"><span>Issues found</span><strong>{data.totals.issues_found}</strong></div>
        <div className="kpi"><span>Open issues</span><strong>{data.totals.open_issues}</strong></div>
      </div>
      <Filters value={filters} onChange={setFilters} extra={tester} />
      <TestTable rows={data.tests} />
    </>
  );
}
