# PXY-Break

Log a test in under 30 seconds. If something broke, the tester's supervisor is emailed automatically, and every test feeds an Issues Dashboard.
Built from the "Break: Testing App Specification and Technical Creation Document" (TBO ISL Innovation Lab, Break It to Build It).

## Stack
- **client/**: React 18 + Vite + React Router + Recharts (no UI framework, plain CSS in `src/styles.css`)
- **server/**: Node (Express) + SQLite (better-sqlite3) + Nodemailer. JWT login, image uploads with multer.

## Run it
Needs Node 22.9 or newer.

```bash
npm run install:all
npm run dev          # API on :4000, web app on http://localhost:5173
```

Production style (one server serves the built front end):

```bash
npm run build
npm start            # http://localhost:4000  (set APP_URL=http://localhost:4000)
```

### Email
With no SMTP settings, alert emails are saved to the in-app **Dev inbox** (sidebar) and printed in the server console, so the demo works with nothing configured.
For real email, copy `server/.env.example` to `server/.env` and fill in the `SMTP_*` values (Gmail app password, Outlook, SendGrid, Mailgun etc. all work).
The sign-up confirmation code for supervisors also arrives by email (or the Dev inbox).

### Sample data
First start seeds Ergo Suite, Visiguard, six test types, and 25 sample tests with 6 issues (sample users cannot log in). Set `SEED_DEMO=false` for an empty database. Delete `server/pxy-break.db` to reset.

## Where each spec feature lives
| Spec | Code |
|---|---|
| 6.1 Sign-up, supervisor email typed twice, Path A confirm, Path B team link, link reset | `server/index.js` (auth + team routes), `client/src/pages/Auth.jsx`, `App.jsx` (LinkPrompt) |
| 6.2 Log a Test, conditional issue section | `client/src/pages/LogTest.jsx` |
| 6.3 Email alert, failure warning + Retry | `server/index.js` (`dispatchIssueEmail`), `server/mail.js` |
| 6.4 / 6.5 Test log, filters, issue detail, status | `TestLog.jsx`, `TestTable.jsx`, `IssueDetail.jsx` |
| 6.6 Dashboard | `Dashboard.jsx`, `/api/stats` |
| 6.7 Settings | `Settings.jsx` |
| 6.8 My Team (view only) | `MyTeam.jsx`, `/api/team` |

## Demo rehearsal (4-minute pitch)
1. Sign up as a Tester, using a second email of yours as the supervisor email.
2. Log a test on **Ergo Suite**, choose "Yes, there is an issue", fill title, description, severity, and save.
3. Show the alert: your real inbox (with SMTP set) or the Dev inbox.
4. Open the Issues dashboard and show the counts moving.

## Notes
- Supervisor email is only shown on an issue to the person who logged it.
- A supervisor must verify their email before testers can be linked to them.
- Changing your supervisor email in Settings unlinks the old supervisor; past issues keep the address they were sent to.
