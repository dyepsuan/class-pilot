# Class-pilot

Class-pilot is a classroom management platform for instructors and students. It combines attendance tracking, quizzes, laboratory scoring, student performance monitoring, secure student portal access, and Gmail-powered account onboarding in one system.

Built with **Next.js**, **Cloudflare Workers**, **OpenNext**, **Cloudflare D1**, and the **Gmail API**.

---

## Features

### Instructor Portal

* Instructor authentication
* Cross-class dashboard
* Class creation and management
* Class schedules and school year information
* Student roster management
* CSV student import
* Student profile pages
* Student archive and restore workflow

### QR Attendance

* Unique QR credentials for students
* Instructor-side QR scanner
* Manual attendance entry
* Present and late tracking
* Multiple attendance sessions
* Attendance session finalization
* Attendance history and statistics
* Inactive students prevented from checking in

### Quizzes

* Create quizzes
* Enter student scores
* Save and edit scores
* Read-only score view after submission
* Student quiz averages and summaries

### Laboratories

* Individual laboratory scoring
* Group laboratory scoring
* Random student grouping
* Individual contribution scoring
* Start and due dates
* Complete and reopen laboratories
* Completed-laboratory filtering
* Shared performance calculations across instructor and student views

### Student Portal

Students have access to their own secure portal with:

* Dashboard
* Attendance history
* Quiz scores
* Laboratory results
* Personal QR code
* Student profile
* Multiple-class switcher

Students enrolled in multiple active classes can switch between classes while keeping the selected class consistent across portal pages.

---

## Secure Student Account Setup

Class-pilot uses secure one-time setup links instead of emailing student PINs.

The onboarding flow is:

```text
Instructor generates or sends setup link
        ↓
Student receives unique one-time link
        ↓
Student opens Class-pilot setup page
        ↓
Student creates their own 6-digit PIN
        ↓
PIN is stored only as a PBKDF2-SHA256 hash
        ↓
Setup token is marked used
        ↓
Student logs in
```

Setup tokens:

* contain 256 bits of cryptographic randomness
* are unique per student
* expire after 48 hours
* can be revoked
* can be replaced
* can only be used once
* are stored only as SHA-256 hashes

Raw setup tokens are never persisted.

Student PINs are stored only as salted **PBKDF2-SHA256** hashes.

---

## Gmail Setup-Link Distribution

Instructors can connect their own Gmail account and send setup links directly to students.

The Gmail integration includes:

* Google OAuth 2.0 web-server flow
* PKCE
* OAuth state validation
* Offline access
* Narrow `gmail.send` scope
* AES-256-GCM encrypted refresh-token storage
* Individual student emails
* Bulk student selection
* Send-result tracking
* Retry support
* Failed-send compensation
* Gmail reconnect and disconnect controls

Each student receives an individual message containing only their own setup link.

**PINs are never sent through email.**

---

## Tech Stack

* **Next.js**
* **React**
* **TypeScript**
* **Tailwind CSS**
* **Cloudflare Workers**
* **OpenNext for Cloudflare**
* **Cloudflare D1**
* **Web Crypto API**
* **Google OAuth 2.0**
* **Gmail API**
* **ZXing** for QR scanning

---

## Project Structure

```text
class-pilot/
├── migrations/
├── scripts/
├── src/
│   ├── app/
│   │   ├── api/
│   │   ├── classes/
│   │   ├── login/
│   │   └── student/
│   ├── components/
│   └── lib/
│       ├── auth/
│       ├── db/
│       ├── gmail/
│       ├── qr/
│       └── validation/
├── .dev.vars.example
├── GMAIL_OAUTH_SETUP.md
├── STUDENT_PORTAL_LOCAL_TESTING.md
├── package.json
└── wrangler.jsonc
```

---

## Local Development

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/class-pilot.git
cd class-pilot
```

Replace `YOUR_USERNAME` with your GitHub username.

### 2. Install dependencies

```bash
npm install
```

### 3. Configure local secrets

Create:

```text
.dev.vars
```

Use `.dev.vars.example` as the template.

```env
NEXTJS_ENV=development

QR_SIGNING_SECRET=your-random-signing-secret

GOOGLE_OAUTH_CLIENT_ID=your-google-oauth-client-id
GOOGLE_OAUTH_CLIENT_SECRET=your-google-oauth-client-secret

GMAIL_TOKEN_ENCRYPTION_KEY=your-base64-encoded-32-byte-key

APP_BASE_URL=http://localhost:PORT
```

Never commit `.dev.vars`.

---

## Generate Secure Secrets

A 32-byte random value can be generated in PowerShell with:

```powershell
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToBase64String($bytes)
```

Use separate random values for:

* `QR_SIGNING_SECRET`
* `GMAIL_TOKEN_ENCRYPTION_KEY`

---

## Database

Class-pilot uses **Cloudflare D1**.

Current migrations:

```text
0001_initial_schema.sql
0002_qr_attendance.sql
0003_one_active_qr_per_student.sql
0004_add_laboratories.sql
0005_add_laboratory_start_date.sql
0006_add_class_meetings.sql
0007_add_authentication.sql
0008_add_student_authentication.sql
0009_add_student_setup_tokens.sql
0010_add_gmail_setup_link_delivery.sql
```

Apply migrations to the local database using the configured D1 database name:

```bash
npx wrangler d1 migrations apply db_classpilot --local
```

Confirm the configured database name in `wrangler.jsonc` before running the command.

---

## Gmail OAuth Setup

Detailed setup instructions are available in:

```text
GMAIL_OAUTH_SETUP.md
```

The general process is:

1. Create a Google Cloud project.
2. Enable the Gmail API.
3. Configure Google Auth Platform.
4. Use an **External** audience for standard Gmail testing.
5. Add the Gmail account as a test user while the OAuth app is in Testing mode.
6. Create an OAuth Client ID with application type **Web application**.
7. Configure the callback URI:

```text
<APP_BASE_URL>/api/integrations/gmail/callback
```

Example:

```text
http://localhost:3000/api/integrations/gmail/callback
```

8. Add the generated Client ID and Client Secret to `.dev.vars`.

---

## Local Testing

Additional testing notes are available in:

```text
STUDENT_PORTAL_LOCAL_TESTING.md
```

Local helper scripts are available under:

```text
scripts/
```

These include utilities for local test accounts and student portal smoke testing.

---

## Validation

Before committing changes, run:

```bash
npx tsc --noEmit
npm run lint
npm run build
git diff --check
```

---

## Security

Never commit:

```text
.dev.vars
.env
.env.local
```

or any file containing real credentials.

Sensitive values include:

* QR signing secrets
* Google OAuth client secrets
* Gmail encryption keys
* OAuth access tokens
* OAuth refresh tokens
* student PINs
* raw student setup tokens

Class-pilot intentionally stores only hashed or encrypted credentials where appropriate.

---

## Local Development Limitation

When Class-pilot uses:

```env
APP_BASE_URL=http://localhost:3000
```

setup links sent through Gmail point to the local development machine.

A `localhost` link opened on a student's phone refers to the student's own device, not the instructor's computer.

External student access will therefore require Class-pilot to eventually run on a reachable hosted origin.

No production deployment configuration is assumed by this README.

---

## Current Status

Class-pilot currently includes:

* Class management
* Student management
* QR attendance
* Quizzes
* Laboratory management and scoring
* Student performance tracking
* Student portal
* Multiple-class support
* Secure student account onboarding
* Gmail setup-link distribution

Development and testing are currently performed locally.

---

## Future Improvements

Potential future additions include:

* Forgot PIN / PIN reset through secure one-time links
* Student announcements
* Notifications
* Gradebook export
* CSV and PDF reports
* Student progress reports
* Historical class access
* Additional analytics
* Production deployment

---

## License

No license has been selected yet.

Unless a license is added, the project remains subject to standard copyright restrictions.
