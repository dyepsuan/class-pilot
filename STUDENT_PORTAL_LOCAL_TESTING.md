# Student portal local testing

Apply migrations to the local D1 database only:

```bash
npx wrangler d1 migrations apply db_classpilot --local
```

Choose an existing student with an active enrollment in an active class. Create or reset that student's local portal PIN:

```bash
node scripts/create-local-student-account.mjs
```

Enter the student's number and a 4-12 digit PIN when prompted. The PIN is hidden while typing. Only its PBKDF2 hash is stored, and resetting it invalidates the student's existing local portal sessions.

Start the local Cloudflare preview:

```bash
npm run preview
```

Open `http://localhost:8787/student/login`. If that port is unavailable, use the local URL printed by Wrangler.
