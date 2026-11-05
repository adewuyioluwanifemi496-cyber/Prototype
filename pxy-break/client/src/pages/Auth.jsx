import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, setToken } from '../api.js';
import { Field, Wordmark } from '../components.jsx';
import { useApp } from '../App.jsx';

function Frame({ title, children, footer }) {
  return (
    <div className="auth">
      <section className="auth-pitch">
        <Wordmark light />
        <h1>Break it to build it.</h1>
        <p>Log a test in under 30 seconds. If something broke, your supervisor hears about it straight away.</p>
      </section>
      <section className="auth-card">
        <h2>{title}</h2>
        {children}
        <p className="auth-foot">{footer}</p>
      </section>
    </div>
  );
}

export function Login() {
  const { setUser, setMailMode } = useApp();
  const [f, setF] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const submit = async (e) => {
    e.preventDefault();
    try {
      const r = await api('/auth/login', { method: 'POST', body: f });
      setToken(r.token);
      const me = await api('/me');
      setMailMode(me.mail_mode);
      setUser(r.user);
    } catch (err) { setErrors(err.errors); }
  };
  return (
    <Frame title="Log in" footer={<>New here? <Link to="/signup">Create an account</Link></>}>
      <form onSubmit={submit} noValidate>
        <Field label="Email" error={errors.email}><input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoFocus /></Field>
        <Field label="Password" error={errors.password}><input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        {errors.form && <p className="form-error" role="alert">{errors.form}</p>}
        <button className="btn wide">Log in</button>
      </form>
    </Frame>
  );
}

export function Signup() {
  const { setUser, setMailMode } = useApp();
  const [params] = useSearchParams();
  const teamToken = params.get('team');
  const [link, setLink] = useState(teamToken ? { loading: true } : null);
  const [f, setF] = useState({
    full_name: '', email: params.get('role') === 'Supervisor' ? params.get('email') || '' : '',
    role: params.get('role') === 'Supervisor' ? 'Supervisor' : 'Tester',
    password: '', supervisor_email: '', supervisor_email_confirm: '',
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!teamToken) return;
    api(`/team-link/${teamToken}`).then((r) => setLink(r));
  }, [teamToken]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    try {
      const r = await api('/auth/signup', { method: 'POST', body: { ...f, team_token: teamToken || undefined } });
      setToken(r.token);
      const me = await api('/me');
      setMailMode(me.mail_mode);
      setUser(r.user);
    } catch (err) { setErrors(err.errors); }
  };

  if (teamToken && link && !link.loading && !link.valid) {
    return (
      <Frame title="Link not valid" footer={<Link to="/login">Back to log in</Link>}>
        <p>This link is no longer valid. Ask your supervisor for a new one.</p>
      </Frame>
    );
  }
  const locked = teamToken && link?.valid;
  const isSup = f.role === 'Supervisor';
  return (
    <Frame title="Create your account" footer={<>Already have one? <Link to="/login">Log in</Link></>}>
      <form onSubmit={submit} noValidate>
        {locked && <p className="note">You are joining {link.supervisor_name}'s team.</p>}
        <Field label="Full name" error={errors.full_name}><input value={f.full_name} onChange={set('full_name')} autoFocus /></Field>
        <Field label="Your email" error={errors.email}><input type="email" value={f.email} onChange={set('email')} /></Field>
        {!locked && (
          <Field label="I am a">
            <select value={f.role} onChange={set('role')}>
              <option>Tester</option>
              <option>Supervisor</option>
            </select>
          </Field>
        )}
        <Field label="Password" error={errors.password} hint="At least 8 characters.">
          <input type="password" value={f.password} onChange={set('password')} />
        </Field>
        {locked ? (
          <Field label="Supervisor's email"><input value={link.supervisor_email} readOnly disabled /></Field>
        ) : (
          <>
            <Field label={isSup ? "Your supervisor's email (optional)" : "Your supervisor's email"} error={errors.supervisor_email} hint="Issue alerts go to this address.">
              <input type="email" value={f.supervisor_email} onChange={set('supervisor_email')} />
            </Field>
            {(!isSup || f.supervisor_email) && (
              <Field label="Type it again" error={errors.supervisor_email_confirm}>
                <input type="email" value={f.supervisor_email_confirm} onChange={set('supervisor_email_confirm')} />
              </Field>
            )}
          </>
        )}
        {errors.form && <p className="form-error" role="alert">{errors.form}</p>}
        <button className="btn wide">Create account</button>
      </form>
    </Frame>
  );
}
