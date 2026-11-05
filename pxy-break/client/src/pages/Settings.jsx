import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Field } from '../components.jsx';
import { useApp } from '../App.jsx';

function ListEditor({ title, route, withDescription }) {
  const [items, setItems] = useState([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { api(`/${route}`).then(setItems); }, [route]);
  const add = async (e) => {
    e.preventDefault();
    try { setItems(await api(`/${route}`, { method: 'POST', body: { name } })); setName(''); setError(''); }
    catch (err) { setError(err.errors.name || err.errors.form); }
  };
  const patch = async (id, body) => setItems(await api(`/${route}/${id}`, { method: 'PATCH', body }));
  return (
    <section className="card">
      <h3>{title}</h3>
      <ul className="list">
        {items.map((it) => (
          <li key={it.id}>
            <span className={it.active ? '' : 'muted'}>{it.name}</span>
            <button className="btn ghost small" onClick={() => patch(it.id, { active: !it.active })}>{it.active ? 'Hide from dropdown' : 'Show in dropdown'}</button>
          </li>
        ))}
      </ul>
      <form className="row" onSubmit={add} noValidate>
        <Field label={`Add ${withDescription ? 'a solution' : 'a test type'}`} error={error}><input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <button className="btn">Add</button>
      </form>
    </section>
  );
}

export default function Settings() {
  const { user, setUser } = useApp();
  const [f, setF] = useState({ full_name: user.full_name, supervisor_email: user.supervisor_email || '' });
  const [errors, setErrors] = useState({});
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    try { const r = await api('/me', { method: 'PATCH', body: f }); setUser(r.user); setErrors({}); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    catch (err) { setErrors(err.errors); }
  };
  const theme = async (t) => { const r = await api('/me', { method: 'PATCH', body: { theme: t } }); setUser(r.user); };
  const reset = async () => {
    if (!confirm('Reset your team link? The old link will stop working.')) return;
    const r = await api('/team/reset-link', { method: 'POST' });
    setUser(r.user);
  };

  return (
    <>
      <header className="page-head"><h1>Settings</h1></header>
      <div className="stack">
        <form className="card" onSubmit={save} noValidate>
          <h3>Your profile</h3>
          <Field label="Full name" error={errors.full_name}><input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></Field>
          <Field label="Your email"><input value={user.email} disabled /></Field>
          <Field label={user.role === 'Supervisor' ? "Your supervisor's email (optional)" : "Your supervisor's email"} error={errors.supervisor_email} hint="Future alerts go here. Past alerts keep the address they were sent to.">
            <input type="email" value={f.supervisor_email} onChange={(e) => setF({ ...f, supervisor_email: e.target.value })} />
          </Field>
          {errors.form && <p className="form-error">{errors.form}</p>}
          <div className="row"><button className="btn">Save changes</button>{saved && <span className="muted">Saved.</span>}</div>
        </form>

        <section className="card">
          <h3>Theme</h3>
          <div className="seg">
            <button type="button" className={user.theme === 'light' ? 'on' : ''} onClick={() => theme('light')}>Light</button>
            <button type="button" className={user.theme === 'dark' ? 'on' : ''} onClick={() => theme('dark')}>Dark</button>
          </div>
        </section>

        {user.role === 'Supervisor' && (
          <section className="card">
            <h3>Team sign-up link</h3>
            <p>Send this link to your testers. They sign up with your email already filled in and join your team straight away.</p>
            <input readOnly value={user.team_link || ''} onFocus={(e) => e.target.select()} aria-label="Team sign-up link" />
            <div className="row">
              <button className="btn" onClick={() => { navigator.clipboard?.writeText(user.team_link); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? 'Copied' : 'Copy link'}</button>
              <button className="btn ghost" onClick={reset}>Reset link</button>
            </div>
          </section>
        )}

        <ListEditor title="Solutions" route="solutions" withDescription />
        <ListEditor title="Test types" route="test-types" />
      </div>
    </>
  );
}
