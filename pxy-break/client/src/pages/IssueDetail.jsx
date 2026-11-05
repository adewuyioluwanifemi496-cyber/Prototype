import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, fmtDate } from '../api.js';
import { Sev, Status } from '../components.jsx';
import { useApp } from '../App.jsx';

const STATUSES = ['Open', 'In Progress', 'Fixed', 'Closed'];

export default function IssueDetail() {
  const { id } = useParams();
  const { user } = useApp();
  const [i, setI] = useState(null);
  const [error, setError] = useState('');
  const load = () => api(`/issues/${id}`).then(setI).catch((e) => setError(e.errors.form));
  useEffect(() => { load(); }, [id]);

  const setStatus = async (status) => { await api(`/issues/${id}/status`, { method: 'PATCH', body: { status } }); load(); };
  const retry = async () => { await api(`/issues/${id}/retry-email`, { method: 'POST' }).catch(() => {}); load(); };

  if (error) return <p className="form-error">{error}</p>;
  if (!i) return null;
  return (
    <>
      <Link to="/tests" className="back">Back to test log</Link>
      <header className="page-head">
        <h1>{i.title}</h1>
        <p><Sev value={i.severity} /> <Status value={i.status} /> {i.solution}, {i.test_type} test</p>
      </header>
      <div className="split">
        <section className="card">
          <dl>
            <dt>What happened and what was expected</dt><dd>{i.description}</dd>
            <dt>Where it happened</dt><dd>{i.location || 'Not given'}</dd>
            <dt>Steps to reproduce</dt><dd className="pre">{i.steps_to_reproduce || 'Not given'}</dd>
            <dt>Reported by</dt><dd>{i.logged_by}, {fmtDate(i.logged_at)}</dd>
          </dl>
          {i.screenshot && <a href={`/uploads/${i.screenshot}`} target="_blank" rel="noreferrer"><img className="shot" src={`/uploads/${i.screenshot}`} alt="Screenshot attached to the issue" /></a>}
        </section>
        <section className="card">
          <label className="field">
            <span className="field-label">Status</span>
            <select value={i.status} onChange={(e) => setStatus(e.target.value)}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
          </label>
          {i.status_changed_at && <p className="muted">Status changed {fmtDate(i.status_changed_at)}</p>}
          <h3>Email alert</h3>
          {i.email_sent ? (
            <p>Sent {fmtDate(i.email_sent_at)}{i.sent_to ? ` to ${i.sent_to}` : ''}.</p>
          ) : (
            <div className="warn"><strong>Issue saved but email could not be sent.</strong>
              {i.logged_by_id === user.id && <button className="btn small" onClick={retry}>Retry</button>}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
