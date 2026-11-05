import React, { useState } from 'react';
import { Filters, TestTable, useRows } from './TestTable.jsx';

export default function TestLog() {
  const [filters, setFilters] = useState({});
  const rows = useRows('/tests', filters);
  return (
    <>
      <header className="page-head"><h1>Test log</h1><p>Every test, passed or not. Select a row with an issue to open it.</p></header>
      <Filters value={filters} onChange={setFilters} />
      {rows && <TestTable rows={rows} />}
    </>
  );
}
