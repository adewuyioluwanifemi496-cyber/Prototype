import React, { createContext, useContext, useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { api, getToken, setToken } from './api.js';
import { Wordmark, Field } from './components.jsx';
import { Login, Signup } from './pages/Auth.jsx';
import Home from './pages/Home.jsx';
import LogTest from './pages/LogTest.jsx';
import TestLog from './pages/TestLog.jsx';
import IssueDetail from './pages/IssueDetail.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Settings from './pages/Settings.jsx';
import MyTeam from './pages/MyTeam.jsx';
import DevInbox from './pages/DevInbox.jsx';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

function VerifyBanner() {
  const { user, setUser, mailMode } = useApp();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  if (user.email_verified) return null;
  const submit = async (e) => {
    e.preventDefault();
    try {
      const r = await api('/auth/verify', { method: 'POST', body: { code } });
      setUser(r.user);
    } catch (err) { setError(err.errors.code || err.errors.form); }
  };
  return (
    <form className="banner" onSubmit={submit}>
      <div>
        <strong>Confirm your email.</strong>{' '}
        We sent a 6-digit code to {user.email}.{mailMode === 'dev-inbox' && ' Find it in the Dev Inbox.'}
      </div>
      <Field label="Code" error={error}>
        <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} />
      </Field>
      <button className="btn">Confirm</button>
      <button type="button" className="btn ghost" onClick={async () => { await api('/auth/resend', { method: 'POST' }); setNote('Code sent again.'); }}>
        Send again
      </button>
      {note && <span className="muted">{note}</span>}
    </form>
  );
}

function LinkPrompt() {
  const { user, setUser } = useApp();
  const nav = useNavigate();
  if (!user.pending_testers?.length) return null;
  const confirm = async () => {
    const r = await api('/team/confirm', { method: 'POST' });
    setUser(r.user);
    nav('/team');
  };
  return (
    <div className="banner accent">
      <div>
        <strong>Are you the supervisor of {user.pending_testers.join(', ')}?</strong> They listed {user.email} as their supervisor.
        Confirming links them to your team.
      </div>
      <button className="btn" onClick={confirm}>Yes, link my team</button>
    </div>
  );
}

function Shell() {
  const { user, setUser, mailMode } = useApp();
  const nav = useNavigate();
  const logout = () => { setToken(null); setUser(null); nav('/login'); };
  const showTeam = user.role === 'Supervisor' && user.team_count > 0;
  return (
    <div className="shell">
      <aside className="sidebar">
        <Wordmark light />
        <nav>
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/log">Log a test</NavLink>
          <NavLink to="/tests">Test log</NavLink>
          <NavLink to="/dashboard">Issues dashboard</NavLink>
          {showTeam && <NavLink to="/team">My team</NavLink>}
          {mailMode === 'dev-inbox' && <NavLink to="/dev-inbox">Dev inbox</NavLink>}
          <NavLink to="/settings">Settings</NavLink>
        </nav>
        <div className="me">
          <strong>{user.full_name}</strong>
          <span>{user.role}</span>
          <button className="btn ghost small" onClick={logout}>Log out</button>
        </div>
      </aside>
      <main className="main">
        <VerifyBanner />
        <LinkPrompt />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/log" element={<LogTest />} />
          <Route path="/tests" element={<TestLog />} />
          <Route path="/issues/:id" element={<IssueDetail />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/team" element={showTeam ? <MyTeam /> : <Navigate to="/" />} />
          <Route path="/dev-inbox" element={<DevInbox />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [mailMode, setMailMode] = useState('dev-inbox');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) return setReady(true);
    api('/me').then((r) => { setUser(r.user); setMailMode(r.mail_mode); }).catch(() => setToken(null)).finally(() => setReady(true));
  }, []);

  useEffect(() => { document.documentElement.dataset.theme = user?.theme || 'light'; }, [user?.theme]);

  if (!ready) return null;
  return (
    <Ctx.Provider value={{ user, setUser, mailMode, setMailMode }}>
      {user ? (
        <Shell />
      ) : (
        <Routes>
          <Route path="/signup" element={<Signup />} />
          <Route path="*" element={<Login />} />
        </Routes>
      )}
    </Ctx.Provider>
  );
}
