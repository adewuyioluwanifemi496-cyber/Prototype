import React, { useEffect, useState } from 'react';
import { api, fmtDate } from '../api.js';
import { Empty } from '../components.jsx';

export default function DevInbox() {
  const [mails, setMails] = useState(null);
  const load = () => api('/dev-inbox').then(setMails).catch(() => setMails([]));
  useEffect(() => { load(); }, []);
  if (!mails) return null;
  return (
    <>
      <header className="page-head">
        <h1>Dev inbox</h1>
        <p>No SMTP settings are configured, so emails land here instead of going out. Set SMTP_HOST in server/.env to send real email.</p>
      </header>
      <button className="btn ghost small" onClick={load}>Refresh</button>
      {!mails.length ? <Empty title="No emails yet.">Log a test with an issue to see the supervisor alert.</Empty> : (
        <div className="stack">
          {mails.map((m) => (
            <article className="card mail" key={m.id}>
              <header><strong>{m.subject}</strong><span className="muted">To {m.to_email}, {fmtDate(m.created_at)}{m.status === 'failed' ? ', failed' : ''}</span></header>
              <pre>{m.body}</pre>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
