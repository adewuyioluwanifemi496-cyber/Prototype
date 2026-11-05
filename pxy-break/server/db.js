import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const db = new Database(process.env.DB_PATH || path.join(here, 'pxy-break.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  email_verified INTEGER NOT NULL DEFAULT 0,
  verify_code TEXT,
  role TEXT NOT NULL CHECK (role IN ('Tester','Supervisor')),
  supervisor_email TEXT,
  supervisor_id INTEGER REFERENCES users(id),
  team_link_token TEXT,
  theme TEXT NOT NULL DEFAULT 'light',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS solutions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS test_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS test_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  solution_id INTEGER NOT NULL REFERENCES solutions(id),
  test_type_id INTEGER NOT NULL REFERENCES test_types(id),
  has_issue INTEGER NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('Passed','Issue Found')),
  logged_by INTEGER NOT NULL REFERENCES users(id),
  logged_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_run_id INTEGER NOT NULL UNIQUE REFERENCES test_runs(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT DEFAULT '',
  severity TEXT NOT NULL CHECK (severity IN ('Low','Medium','High','Critical')),
  steps_to_reproduce TEXT DEFAULT '',
  screenshot TEXT,
  status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','In Progress','Fixed','Closed')),
  email_sent INTEGER NOT NULL DEFAULT 0,
  email_sent_at TEXT,
  sent_to TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  status_changed_at TEXT
);
CREATE TABLE IF NOT EXISTS outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// Pre-loaded lists
const solCount = db.prepare('SELECT COUNT(*) c FROM solutions').get().c;
if (!solCount) {
  const ins = db.prepare('INSERT INTO solutions (name, description) VALUES (?, ?)');
  ins.run('Ergo Suite', 'Ergonomics assessment suite');
  ins.run('Visiguard', 'Visibility and safety monitoring');
}
const typeCount = db.prepare('SELECT COUNT(*) c FROM test_types').get().c;
if (!typeCount) {
  const ins = db.prepare('INSERT INTO test_types (name) VALUES (?)');
  ['Functional', 'Usability', 'Performance', 'Security', 'Regression', 'Integration'].forEach((n) => ins.run(n));
}

// Sample data so the dashboard looks populated (sample users cannot log in)
export function seedDemo() {
  if (db.prepare('SELECT COUNT(*) c FROM test_runs').get().c) return;
  const lock = bcrypt.hashSync(Math.random().toString(36), 8);
  const mkUser = db.prepare(
    "INSERT OR IGNORE INTO users (full_name,email,password_hash,email_verified,role,supervisor_email) VALUES (?,?,?,1,'Tester','sample.lead@example.com')"
  );
  mkUser.run('Ada Sample', 'ada.sample@example.com', lock);
  mkUser.run('Sam Sample', 'sam.sample@example.com', lock);
  const uid = (e) => db.prepare('SELECT id FROM users WHERE email=?').get(e).id;
  const users = [uid('ada.sample@example.com'), uid('sam.sample@example.com')];
  const sol = db.prepare('SELECT id FROM solutions ORDER BY id').all().map((r) => r.id);
  const types = db.prepare("SELECT id FROM test_types WHERE name IN ('Functional','Usability','Performance','Security','Regression') ORDER BY id").all().map((r) => r.id);
  const runIns = db.prepare('INSERT INTO test_runs (solution_id,test_type_id,has_issue,result,logged_by,logged_at) VALUES (?,?,?,?,?,?)');
  const issIns = db.prepare(
    `INSERT INTO issues (test_run_id,title,description,location,severity,steps_to_reproduce,status,email_sent,email_sent_at,sent_to,created_at,updated_at,status_changed_at)
     VALUES (?,?,?,?,?,?,?,1,?,?,?,?,?)`
  );
  const issues = {
    3: ['Posture score resets after saving', 'Saved assessment shows 0 instead of the calculated score.', 'Assessment results', 'High', 'Open'],
    7: ['Camera feed freezes after 10 minutes', 'Live feed stops updating; expected continuous stream.', 'Live view', 'Critical', 'In Progress'],
    11: ['Export button misaligned on tablet', 'Export button overlaps the table header at tablet width.', 'Reports page', 'Low', 'Fixed'],
    15: ['Login accepts expired session token', 'Expired token still loads the dashboard.', 'Login', 'Critical', 'Open'],
    19: ['Slow load on large workstation lists', 'List of 500+ workstations takes 12s to render.', 'Workstation list', 'Medium', 'Open'],
    23: ['Alert threshold change not applied', 'Changing threshold in settings does not affect alerts until restart.', 'Alert settings', 'Medium', 'Closed'],
  };
  const tx = db.transaction(() => {
    for (let i = 0; i < 25; i++) {
      const day = new Date(Date.now() - (25 - i) * 36e5 * 20);
      const ts = day.toISOString().slice(0, 19).replace('T', ' ');
      const iss = issues[i];
      const run = runIns.run(sol[i % 2], types[i % types.length], iss ? 1 : 0, iss ? 'Issue Found' : 'Passed', users[i % 2], ts);
      if (iss) {
        const resolved = iss[4] === 'Fixed' || iss[4] === 'Closed' || iss[4] === 'In Progress';
        issIns.run(run.lastInsertRowid, iss[0], iss[1], iss[2], iss[3], '1. Open the page\n2. Repeat the action', iss[4], ts, 'sample.lead@example.com', ts, ts, resolved ? ts : null);
      }
    }
  });
  tx();
}
