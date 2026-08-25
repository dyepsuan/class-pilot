# Gmail setup-link delivery

Phase 9C uses Google's OAuth 2.0 web-server flow to send student setup links from an instructor's Gmail account. The application requests only OpenID email identity and `https://www.googleapis.com/auth/gmail.send`.

## Google Cloud configuration

1. Create or select a Google Cloud project and enable the Gmail API.
2. Configure the OAuth consent screen. Add the Gmail send scope and the test users needed while the app remains in testing.
3. Create an OAuth 2.0 Client ID of type **Web application**.
4. Add the exact redirect URI:

   `http://localhost:PORT/api/integrations/gmail/callback`

   Replace `PORT` with the port used by `APP_BASE_URL`. Add the production HTTPS callback separately when production is configured.

## Local secrets

Copy the placeholders from `.dev.vars.example` into `.dev.vars` and set:

- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GMAIL_TOKEN_ENCRYPTION_KEY`
- `APP_BASE_URL`

Generate `GMAIL_TOKEN_ENCRYPTION_KEY` as 32 random bytes encoded with base64url. Keep it stable: changing it makes existing encrypted refresh tokens unreadable and requires instructors to reconnect.

Never commit `.dev.vars`. Production values must be configured as Worker secrets. `APP_BASE_URL` must match the public origin and the OAuth redirect registered with Google.

## Local database

Apply migrations before opening the setup-link page:

```powershell
npx.cmd wrangler d1 migrations apply db_classpilot --local
```

Then connect Gmail from a class's **Student Setup Links** page. Disconnecting clears the encrypted local credential and makes a best-effort Google token revocation request.

## Security behavior

- OAuth state and PKCE verifier data live in a short-lived, HTTP-only, SameSite cookie.
- Refresh tokens are encrypted with AES-256-GCM and bound to the instructor ID before D1 persistence.
- Access tokens, raw setup tokens, complete setup URLs, and email bodies are never stored or logged.
- Each recipient gets a new 256-bit one-time token. If Gmail rejects a send, the new token is revoked and the prior valid manual link is restored.
