import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Field } from '../components.jsx';
import { useApp } from '../App.jsx';

const blank = { solution_id: '', test_type_id: '', title: '', description: '', location: '', severity: '', steps_to_reproduce: '' };

export default function LogTest() {
  const { user } = useApp();
  const [solutions, setSolutions] = useState([]);
  const [types, setTypes] = useState([]);
  const [f, setF] = useState(blank);
  const [hasIssue, setHasIssue] = useState(null); // null = not chosen, false = no issue, true = issue
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    api('/solutions').then((r) => setSolutions(r.filter((x) => x.active)));
    api('/test-types').then((r) => setTypes(r.filter((x) => x.active)));
  }, []);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (hasIssue === null) return setErrors({ has_issue: 'Choose whether there was an issue.' });
    const form = new FormData();
    Object.entries(f).forEach(([k, v]) => form.append(k, v));
    form.append('has_issue', hasIssue);
    if (hasIssue && file) form.append('screenshot', file);
    setBusy(true);
    try {
      const r = await api('/tests', { method: 'POST', form });
      setResult(r);
      setErrors({});
    } catch (err) { setErrors(err.errors); }
    setBusy(false);
  };

  const retry = async () => {
    setRetrying(true);
    const r = await api(`/issues/${result.issue_id}/retry-email`, { method: 'POST' }).catch(() => ({ email_sent: false }));
    setResult({ ...result, email_sent: r.email_sent });
    setRetrying(false);
  };

  const again = () => { setF(blank); setHasIssue(null); setFile(null); setResult(null); setErrors({}); };

  if (result) {
    return (
      <div className="card narrow">
        {result.result === 'Passed' ? (
          <>
            <h2>Test saved as passed</h2>
            <p>No email was sent.</p>
          </>
        ) : (
          <>
            <h2>Issue saved</h2>
            {result.email_sent ? (
              <p>Your supervisor ({result.sent_to}) has been emailed.</p>
            ) : (
              <div className="warn" role="alert">
                <strong>Issue saved but email could not be sent.</strong>
                <button className="btn small" onClick={retry} disabled={retrying}>{retrying ? 'Retrying' : 'Retry'}</button>
              </div>
            )}
            <p><Link to={`/issues/${result.issue_id}`}>Open the issue</Link></p>
          </>
        )}
        <div className="row"><button className="btn" onClick={again}>Log another test</button><Link className="btn ghost" to="/dashboard">See the dashboard</Link></div>
      </div>
    );
  }

  return (
    <>
      <header className="page-head"><h1>Log a test</h1><p>Three choices. Add details only if something broke.</p></header>
      <form className="card narrow" onSubmit={submit} noValidate>
        <div className="grid2">
          <Field label="Solution" error={errors.solution_id}>
            <select value={f.solution_id} onChange={set('solution_id')}>
              <option value="">Choose a solution</option>
              {solutions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Test type" error={errors.test_type_id}>
            <select value={f.test_type_id} onChange={set('test_type_id')}>
              <option value="">Choose a test type</option>
              {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
        </div>

        <fieldset className="field">
          <legend className="field-label">Was there an issue?</legend>
          <div className="seg">
            <button type="button" className={hasIssue === false ? 'on ok' : ''} aria-pressed={hasIssue === false} onClick={() => setHasIssue(false)}>No issue</button>
            <button type="button" className={hasIssue === true ? 'on bad' : ''} aria-pressed={hasIssue === true} onClick={() => setHasIssue(true)}>Yes, there is an issue</button>
          </div>
          {errors.has_issue && <span className="field-error" role="alert">{errors.has_issue}</span>}
        </fieldset>

        {hasIssue === true && (
          <div className="issue-section">
            {!user.supervisor_email && <p className="note">You have no supervisor email on your profile, so no alert will be sent. Add one in Settings.</p>}
            <Field label="Short title" error={errors.title}><input value={f.title} onChange={set('title')} maxLength={120} /></Field>
            <Field label="Description" error={errors.description} hint="What happened, and what did you expect?">
              <textarea rows={3} value={f.description} onChange={set('description')} />
            </Field>
            <div className="grid2">
              <Field label="Where it happened" hint="Page or feature"><input value={f.location} onChange={set('location')} /></Field>
              <Field label="Severity" error={errors.severity}>
                <select value={f.severity} onChange={set('severity')}>
                  <option value="">Choose a severity</option>
                  {['Low', 'Medium', 'High', 'Critical'].map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Steps to reproduce (optional)"><textarea rows={3} value={f.steps_to_reproduce} onChange={set('steps_to_reproduce')} /></Field>
            <Field label="Screenshot (optional)" error={errors.screenshot} hint="Images only, up to 5 MB.">
              <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={(e) => setFile(e.target.files[0] || null)} />
            </Field>
          </div>
        )}
        {errors.form && <p className="form-error" role="alert">{errors.form}</p>}
        <button className="btn" disabled={busy}>{busy ? 'Saving' : hasIssue ? 'Save issue and email supervisor' : 'Save test'}</button>
      </form>
    </>
  );
}
