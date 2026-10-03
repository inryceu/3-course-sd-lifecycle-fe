# ADR 0001: Where the access token is stored in the browser

- Status: accepted
- Ticket: T-09 (frontend login, registration and protected routes)

## Context

The backend issues a short-lived JWT (`POST /auth/login|register` → `{ accessToken, expiresIn, user }`,
lifetime at most one hour) and has no refresh endpoint. The SPA sends it as `Authorization: Bearer`.
The token must survive a page reload within a session and must be easy to drop on logout or 401.

## Options

| Option | XSS (script can read the token) | CSRF | Survives reload | Cost |
| --- | --- | --- | --- | --- |
| `localStorage` | Readable, persists across tabs and browser restarts, so a stolen token stays useful until expiry | Not affected (header, not cookie) | Yes, even after closing the browser | None |
| `sessionStorage` (chosen) | Readable by injected script, but scoped to one tab and cleared when it closes | Not affected | Yes (same tab) | None |
| In-memory only | Not readable from storage; injected script can still use the live token | Not affected | No: every reload forces a new login | Poor UX with no refresh token |
| httpOnly, Secure, SameSite cookie | Not readable by script | Exposed: needs CSRF tokens or strict SameSite plus Origin checks | Yes | Backend changes (cookie auth, CORS credentials, CSRF) outside this ticket |

## Decision

Store the access token in **`sessionStorage`** (`src/api/token-storage.ts`) and send it as a bearer header. There is no refresh token.

## Consequences

- An XSS bug can still read the token. Mitigations: tokens expire within one hour; narrow exposure window (one tab, gone on close); React escapes output by default; nginx sends `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` and a restrictive `Content-Security-Policy` (scripts only from the same origin). Further hardening and TLS come with T-36/T-39.
- No CSRF surface, because credentials are never sent automatically by the browser.
- Users sign in again after one hour or when opening the app in a new tab; this is accepted until a refresh design is agreed with the backend.
- Revisit if the backend adds cookie-based sessions: httpOnly cookie with SameSite and CSRF protection would remove the token from script reach.
