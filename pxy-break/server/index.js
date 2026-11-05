import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db, seedDemo } from './db.js';
import { sendMail, mailMode } from './mail.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4000;
const APP_URL = (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-me';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];
const STATUSES = ['Open', 'In Progress', 'Fixed', 'Closed'];

if (process.env.SEED_DEMO !== 'false') seedDemo();

const uploadDir = path.join(here, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_r, f, cb) => cb(null, crypto.randomUUID() + path.extname(f.originalname).toLowerCase()),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_r, f, cb) => cb(/^image\/(png|jpe?g|gif|webp)$/.test(f.mimetype) ? null : new Error('Only image files are allowed.'), /^image\/(png|jpe?g|gif|webp)$/.test(f.mimetype)),
});

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadDir));

// ---------- helpers ----------
const lower = (s) => String(s || '').trim().toLowerCase();
const token = (u) => jwt.sign({ id: u.id }, JWT_SECRET, { expiresIn: '7d' });
const newToken = () => crypto.randomBytes(16).toString('hex');
const bad = (res, errors, code = 400) => res.status(code).json({ errors: typeof errors === 'string' ? { form: errors } : errors });

function auth(req, res, next) {
  try {
    const h = req.headers.authorization || '';
    const { id } = jwt.verify(h.replace('Bearer ', ''), JWT_SECRET);
    req.user = db.prepare('SELECT * FROM users WHERE id=?').get(id);
    if (!req.user) throw new Error('no user');
    next();
  } catch {
    res.status(401).json({ errors: { form: 'Please log in.' } });
  }
}

function publicUser(u) {
  const pending = pendingTesters(u);
  const teamCount = u.role === 'Supervisor' ? db.prepare('SELECT COUNT(*) c FROM users WHERE supervisor_id=?').get(u.id).c : 0;
  return {
    id: u.id, full_name: u.full_name, email: u.email, email_verified: !!u.email_verified, role: u.role,
    supervisor_email: u.supervisor_email, theme: u.theme,
    team_link: u.role === 'Supervisor' && u.team_link_token ? `${APP_URL}/signup?team=${u.team_link_token}` : null,
    pending_testers: pending.map((t) => t.full_name),
    team_count: teamCount,
  };
}

// Testers who listed this supervisor's email but are not linked yet (needs verified email)
function pendingTesters(u) {
  if (u.role !== 'Supervisor' || !u.email_verified) return [];
  return db.prepare('SELECT id, full_name FROM users WHERE supervisor_email=? AND supervisor_id IS NULL AND id != ?').all(lower(u.email), u.id);
}

async function sendVerification(u) {
  const code = String(crypto.randomInt(100000, 999999));
  db.prepare('UPDATE users SET verify_code=? WHERE id=?').run(code, u.id);
  await sendMail({ to: u.email, subject: '[PXY-Break] Confirm your email', text: `Your PXY-Break confirmation code is ${code}.` });
}

// ---------- auth ----------
app.get('/api/team-link/:token', (req, res) => {
  const s = db.prepare("SELECT full_name, email FROM users WHERE team_link_token=? AND role='Supervisor'").get(req.params.token);
  if (!s) return res.json({ valid: false });
  res.json({ valid: true, supervisor_email: s.email, supervisor_name: s.full_name });
});

app.post('/api/auth/signup', async (req, res) => {
  const b = req.body;
  const errors = {};
  const email = lower(b.email);
  const role = b.role === 'Supervisor' ? 'Supervisor' : 'Tester';
  if (!String(b.full_name || '').trim()) errors.full_name = 'Enter your full name.';
  if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address.';
  else if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) errors.email = 'An account with this email already exists.';
  if (String(b.password || '').length < 8) errors.password = 'Use at least 8 characters.';

  let supEmail = lower(b.supervisor_email);
  let supervisorId = null;
  if (b.team_token) {
    const s = db.prepare("SELECT id, email FROM users WHERE team_link_token=? AND role='Supervisor'").get(b.team_token);
    if (!s) return bad(res, { form: 'This link is no longer valid. Ask your supervisor for a new one.' });
    supEmail = s.email;
    supervisorId = s.id;
  } else if (role === 'Tester' || supEmail) {
    if (!supEmail) errors.supervisor_email = "Enter your supervisor's email.";
    else if (!EMAIL_RE.test(supEmail)) errors.supervisor_email = 'Enter a valid email address.';
    else if (supEmail === email) errors.supervisor_email = 'Your supervisor email must be different from your own.';
    else if (supEmail !== lower(b.supervisor_email_confirm)) errors.supervisor_email_confirm = 'The two supervisor emails do not match.';
  }
  if (Object.keys(errors).length) return bad(res, errors);

  const info = db.prepare(
    'INSERT INTO users (full_name,email,password_hash,role,supervisor_email,supervisor_id,team_link_token) VALUES (?,?,?,?,?,?,?)'
  ).run(b.full_name.trim(), email, bcrypt.hashSync(b.password, 10), role, supEmail || null, supervisorId, role === 'Supervisor' ? newToken() : null);
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(info.lastInsertRowid);
  await sendVerification(u);
  res.json({ token: token(u), user: publicUser(u) });
});

app.post('/api/auth/login', (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(lower(req.body.email));
  if (!u || !bcrypt.compareSync(String(req.body.password || ''), u.password_hash)) return bad(res, 'Email or password is incorrect.', 401);
  res.json({ token: token(u), user: publicUser(u) });
});

app.post('/api/auth/verify', auth, (req, res) => {
  if (!req.user.verify_code || String(req.body.code).trim() !== req.user.verify_code) return bad(res, { code: 'That code is not right. Check the email and try again.' });
  db.prepare('UPDATE users SET email_verified=1, verify_code=NULL WHERE id=?').run(req.user.id);
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id)) });
});

app.post('/api/auth/resend', auth, async (req, res) => {
  await sendVerification(req.user);
  res.json({ ok: true });
});

app.get('/api/me', auth, (req, res) => res.json({ user: publicUser(req.user), mail_mode: mailMode }));

app.patch('/api/me', auth, (req, res) => {
  const errors = {};
  const name = String(req.body.full_name ?? req.user.full_name).trim();
  let sup = req.body.supervisor_email === undefined ? req.user.supervisor_email : lower(req.body.supervisor_email);
  if (!name) errors.full_name = 'Enter your full name.';
  if (req.user.role === 'Tester' || sup) {
    if (!sup) errors.supervisor_email = "Enter your supervisor's email.";
    else if (!EMAIL_RE.test(sup)) errors.supervisor_email = 'Enter a valid email address.';
    else if (sup === lower(req.user.email)) errors.supervisor_email = 'Your supervisor email must be different from your own.';
  }
  if (Object.keys(errors).length) return bad(res, errors);
  const theme = req.body.theme === 'dark' ? 'dark' : req.body.theme === 'light' ? 'light' : req.user.theme;
  // Changing supervisor email unlinks the old supervisor; the new one can confirm later.
  const changed = (sup || null) !== (req.user.supervisor_email || null);
  db.prepare('UPDATE users SET full_name=?, supervisor_email=?, theme=?, supervisor_id=CASE WHEN ? THEN NULL ELSE supervisor_id END WHERE id=?')
    .run(name, sup || null, theme, changed ? 1 : 0, req.user.id);
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id)) });
});

// ---------- team linking ----------
app.post('/api/team/confirm', auth, (req, res) => {
  const u = req.user;
  if (u.role !== 'Supervisor' || !u.email_verified) return bad(res, 'Verify your email first.', 403);
  const r = db.prepare('UPDATE users SET supervisor_id=? WHERE supervisor_email=? AND supervisor_id IS NULL AND id != ?').run(u.id, lower(u.email), u.id);
  res.json({ linked: r.changes, user: publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(u.id)) });
});

app.post('/api/team/reset-link', auth, (req, res) => {
  if (req.user.role !== 'Supervisor') return bad(res, 'Only supervisors have a team link.', 403);
  db.prepare('UPDATE users SET team_link_token=? WHERE id=?').run(newToken(), req.user.id);
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id)) });
});

// ---------- lookups ----------
app.get('/api/solutions', auth, (_q, res) => res.json(db.prepare('SELECT * FROM solutions ORDER BY name').all()));
app.get('/api/test-types', auth, (_q, res) => res.json(db.prepare('SELECT * FROM test_types ORDER BY name').all()));

for (const [route, table, extra] of [['solutions', 'solutions', true], ['test-types', 'test_types', false]]) {
  app.post(`/api/${route}`, auth, (req, res) => {
    const name = String(req.body.name || '').trim();
    if (!name) return bad(res, { name: 'Enter a name.' });
    if (db.prepare(`SELECT 1 FROM ${table} WHERE lower(name)=?`).get(name.toLowerCase())) return bad(res, { name: 'That name already exists.' });
    if (extra) db.prepare('INSERT INTO solutions (name, description) VALUES (?,?)').run(name, req.body.description || '');
    else db.prepare('INSERT INTO test_types (name) VALUES (?)').run(name);
    res.json(db.prepare(`SELECT * FROM ${table} ORDER BY name`).all());
  });
  app.patch(`/api/${route}/:id`, auth, (req, res) => {
    const row = db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(req.params.id);
    if (!row) return bad(res, 'Not found.', 404);
    const name = String(req.body.name ?? row.name).trim();
    const active = req.body.active === undefined ? row.active : req.body.active ? 1 : 0;
    if (!name) return bad(res, { name: 'Enter a name.' });
    db.prepare(`UPDATE ${table} SET name=?, active=? WHERE id=?`).run(name, active, row.id);
    res.json(db.prepare(`SELECT * FROM ${table} ORDER BY name`).all());
  });
}

// ---------- tests ----------
function issueEmail(issue, run, reporter) {
  const sol = db.prepare('SELECT name FROM solutions WHERE id=?').get(run.solution_id).name;
  const type = db.prepare('SELECT name FROM test_types WHERE id=?').get(run.test_type_id).name;
  const hasAccount = db.prepare('SELECT 1 FROM users WHERE email=?').get(lower(issue.sent_to));
  const lines = [
    `A new issue was reported in PXY-Break.`, '',
    `Solution: ${sol}`, `Test type: ${type}`, `Severity: ${issue.severity}`, `Title: ${issue.title}`,
    `Description: ${issue.description}`, `Where it happened: ${issue.location || 'Not given'}`,
    `Steps to reproduce: ${issue.steps_to_reproduce || 'Not given'}`,
    `Reported by: ${reporter.full_name}`, `Date and time: ${run.logged_at} UTC`, '',
    `Open the issue: ${APP_URL}/issues/${issue.id}`,
  ];
  if (!hasAccount) lines.push('', `Create an account to see your team's issues: ${APP_URL}/signup?role=Supervisor&email=${encodeURIComponent(issue.sent_to)}`);
  return { subject: `[PXY-Break] ${issue.severity} issue in ${sol}: ${issue.title}`, text: lines.join('\n') };
}

async function dispatchIssueEmail(issueId) {
  const issue = db.prepare('SELECT * FROM issues WHERE id=?').get(issueId);
  const run = db.prepare('SELECT * FROM test_runs WHERE id=?').get(issue.test_run_id);
  const reporter = db.prepare('SELECT * FROM users WHERE id=?').get(run.logged_by);
  const to = issue.email_sent ? issue.sent_to : reporter.supervisor_email;
  if (!to) return false;
  db.prepare('UPDATE issues SET sent_to=? WHERE id=?').run(to, issueId);
  const { subject, text } = issueEmail({ ...issue, sent_to: to }, run, reporter);
  const ok = await sendMail({ to, subject, text });
  db.prepare("UPDATE issues SET email_sent=?, email_sent_at=CASE WHEN ? THEN datetime('now') ELSE NULL END WHERE id=?").run(ok ? 1 : 0, ok ? 1 : 0, issueId);
  return ok;
}

app.post('/api/tests', auth, (req, res, next) => upload.single('screenshot')(req, res, (err) => (err ? bad(res, { screenshot: err.message }) : next())), async (req, res) => {
  const b = req.body;
  const errors = {};
  const sol = db.prepare('SELECT id FROM solutions WHERE id=? AND active=1').get(b.solution_id);
  const type = db.prepare('SELECT id FROM test_types WHERE id=? AND active=1').get(b.test_type_id);
  const hasIssue = b.has_issue === 'true' || b.has_issue === true;
  if (!sol) errors.solution_id = 'Choose a solution.';
  if (!type) errors.test_type_id = 'Choose a test type.';
  if (hasIssue) {
    if (!String(b.title || '').trim()) errors.title = 'Give the issue a short title.';
    if (!String(b.description || '').trim()) errors.description = 'Describe what happened and what you expected.';
    if (!SEVERITIES.includes(b.severity)) errors.severity = 'Choose a severity.';
  }
  if (Object.keys(errors).length) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return bad(res, errors);
  }
  const run = db.prepare('INSERT INTO test_runs (solution_id,test_type_id,has_issue,result,logged_by) VALUES (?,?,?,?,?)')
    .run(sol.id, type.id, hasIssue ? 1 : 0, hasIssue ? 'Issue Found' : 'Passed', req.user.id);
  if (!hasIssue) return res.json({ test_run_id: run.lastInsertRowid, result: 'Passed' });

  const info = db.prepare(
    'INSERT INTO issues (test_run_id,title,description,location,severity,steps_to_reproduce,screenshot) VALUES (?,?,?,?,?,?,?)'
  ).run(run.lastInsertRowid, b.title.trim(), b.description.trim(), b.location || '', b.severity, b.steps_to_reproduce || '', req.file ? req.file.filename : null);
  const emailSent = await dispatchIssueEmail(info.lastInsertRowid);
  res.json({ test_run_id: run.lastInsertRowid, result: 'Issue Found', issue_id: info.lastInsertRowid, email_sent: emailSent, sent_to: req.user.supervisor_email });
});

const LIST_SQL = `
  SELECT r.id, r.logged_at, r.result, r.has_issue, s.name AS solution, t.name AS test_type, u.full_name AS logged_by,
         u.id AS logged_by_id, i.id AS issue_id, i.severity, i.status, i.title
  FROM test_runs r
  JOIN solutions s ON s.id=r.solution_id JOIN test_types t ON t.id=r.test_type_id
  JOIN users u ON u.id=r.logged_by LEFT JOIN issues i ON i.test_run_id=r.id`;

function filtered(q, extraWhere = '', extraParams = []) {
  const w = [], p = [];
  if (extraWhere) { w.push(extraWhere); p.push(...extraParams); }
  if (q.solution) { w.push('r.solution_id=?'); p.push(q.solution); }
  if (q.test_type) { w.push('r.test_type_id=?'); p.push(q.test_type); }
  if (q.result) { w.push('r.result=?'); p.push(q.result); }
  if (q.severity) { w.push('i.severity=?'); p.push(q.severity); }
  if (q.status) { w.push('i.status=?'); p.push(q.status); }
  if (q.from) { w.push('date(r.logged_at)>=date(?)'); p.push(q.from); }
  if (q.to) { w.push('date(r.logged_at)<=date(?)'); p.push(q.to); }
  return db.prepare(`${LIST_SQL} ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY r.logged_at DESC, r.id DESC`).all(...p);
}

app.get('/api/tests', auth, (req, res) => res.json(filtered(req.query)));

app.get('/api/issues/:id', auth, (req, res) => {
  const i = db.prepare(`
    SELECT i.*, s.name AS solution, t.name AS test_type, u.full_name AS logged_by, u.id AS logged_by_id, r.logged_at
    FROM issues i JOIN test_runs r ON r.id=i.test_run_id JOIN solutions s ON s.id=r.solution_id
    JOIN test_types t ON t.id=r.test_type_id JOIN users u ON u.id=r.logged_by WHERE i.id=?`).get(req.params.id);
  if (!i) return bad(res, 'Issue not found.', 404);
  // Supervisor email is only shown to the person who logged the issue.
  if (i.logged_by_id !== req.user.id) i.sent_to = null;
  res.json(i);
});

app.patch('/api/issues/:id/status', auth, (req, res) => {
  if (!STATUSES.includes(req.body.status)) return bad(res, 'Choose a valid status.');
  const r = db.prepare("UPDATE issues SET status=?, status_changed_at=datetime('now'), updated_at=datetime('now') WHERE id=?").run(req.body.status, req.params.id);
  if (!r.changes) return bad(res, 'Issue not found.', 404);
  res.json({ ok: true });
});

app.post('/api/issues/:id/retry-email', auth, async (req, res) => {
  const i = db.prepare('SELECT i.id, r.logged_by FROM issues i JOIN test_runs r ON r.id=i.test_run_id WHERE i.id=?').get(req.params.id);
  if (!i) return bad(res, 'Issue not found.', 404);
  if (i.logged_by !== req.user.id) return bad(res, 'Only the person who logged this issue can resend its alert.', 403);
  db.prepare('UPDATE issues SET email_sent=0 WHERE id=?').run(i.id);
  res.json({ email_sent: await dispatchIssueEmail(i.id) });
});

// ---------- dashboard ----------
function stats(rows) {
  const total = rows.length;
  const withIssues = rows.filter((r) => r.has_issue);
  const open = withIssues.filter((r) => r.status === 'Open' || r.status === 'In Progress');
  const count = (arr, key, order) => {
    const m = {};
    arr.forEach((r) => { m[r[key]] = (m[r[key]] || 0) + 1; });
    return (order || Object.keys(m)).map((name) => ({ name, value: m[name] || 0 }));
  };
  const byDay = {};
  withIssues.forEach((r) => { const d = r.logged_at.slice(0, 10); byDay[d] = (byDay[d] || 0) + 1; });
  return {
    total_tests: total,
    tests_with_issues: withIssues.length,
    pass_rate: total ? Math.round(((total - withIssues.length) / total) * 100) : 0,
    open_issues: open.length,
    critical_open: open.filter((r) => r.severity === 'Critical').length,
    by_severity: count(withIssues, 'severity', SEVERITIES),
    by_solution: count(withIssues, 'solution'),
    by_test_type: count(withIssues, 'test_type'),
    open_vs_fixed: [
      { name: 'Open', value: withIssues.filter((r) => r.status === 'Open').length },
      { name: 'In Progress', value: withIssues.filter((r) => r.status === 'In Progress').length },
      { name: 'Fixed', value: withIssues.filter((r) => r.status === 'Fixed').length },
      { name: 'Closed', value: withIssues.filter((r) => r.status === 'Closed').length },
    ],
    over_time: Object.keys(byDay).sort().map((d) => ({ name: d, value: byDay[d] })),
    summary: `${total} test${total === 1 ? '' : 's'} run, ${withIssues.length} issue${withIssues.length === 1 ? '' : 's'} found, ${open.length} still open.`,
  };
}
app.get('/api/stats', auth, (req, res) => res.json(stats(filtered({ solution: req.query.solution }))));

// ---------- my team (supervisors, view only) ----------
function requireSupervisor(req, res, next) {
  if (req.user.role !== 'Supervisor') return bad(res, 'Only supervisors can see My Team.', 403);
  next();
}
app.get('/api/team', auth, requireSupervisor, (req, res) => {
  const testers = db.prepare('SELECT id, full_name FROM users WHERE supervisor_id=? ORDER BY full_name').all(req.user.id);
  const ids = testers.map((t) => t.id);
  const rows = ids.length ? filtered(req.query, `r.logged_by IN (${ids.map(() => '?').join(',')})`, ids) : [];
  const s = stats(rows);
  res.json({
    testers,
    totals: { tests_run: s.total_tests, issues_found: s.tests_with_issues, open_issues: s.open_issues },
    tests: req.query.tester ? rows.filter((r) => String(r.logged_by_id) === String(req.query.tester)) : rows,
  });
});

// ---------- dev inbox (only when SMTP is not configured) ----------
app.get('/api/dev-inbox', auth, (req, res) => {
  if (mailMode !== 'dev-inbox') return bad(res, 'Dev inbox is off when SMTP is configured.', 404);
  res.json(db.prepare('SELECT * FROM outbox ORDER BY id DESC LIMIT 50').all());
});

// ---------- serve built front end ----------
const dist = path.join(here, '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api|uploads).*/, (_q, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.listen(PORT, () => console.log(`PXY-Break API on http://localhost:${PORT} (mail: ${mailMode})`));
