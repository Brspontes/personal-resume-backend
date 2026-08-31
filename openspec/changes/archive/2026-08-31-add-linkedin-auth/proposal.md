## Why

The portfolio needs a way for visitors to identify themselves before interacting with articles (likes, comments, replies planned in later changes). LinkedIn is the natural identity provider for a professional portfolio audience, and the backend must own the resulting application identity so future authenticated features don't each need to talk to LinkedIn themselves.

## What Changes

- Add LinkedIn login via OpenID Connect: `GET /api/v1/auth/linkedin` (initiate) and `GET /api/v1/auth/linkedin/callback` (complete the flow, validate the identity, redirect back to the frontend).
- Establish an application-level authenticated session as a signed JWT stored in an httpOnly, secure cookie set on successful callback. The frontend never reads the token directly; it relies on the browser sending the cookie automatically on subsequent requests (`credentials: 'include'`).
- Add `GET /api/v1/auth/me` to return the current authenticated user (or 401 if not authenticated).
- Add `POST /api/v1/auth/logout` to clear the session cookie.
- Add a reusable `AuthGuard` (`@UseGuards(AuthGuard)`) that validates the session cookie and attaches the authenticated user to the request, so future modules (likes, comments) can require authentication without knowing about LinkedIn or JWTs.
- Create three dedicated modules with separated responsibilities: `auth/` (session/guard/current-user), `linkedin/` (OAuth/OIDC protocol + LinkedIn API calls only), `users/` (persistence of application users).
- Persist application users in PostgreSQL via Prisma, keyed by the stable LinkedIn subject identifier (`linkedinId`), with a unique constraint preventing duplicate users for the same LinkedIn identity.
- Auto-create a local user on first LinkedIn login; update basic profile fields (name, avatar) on subsequent logins.
- **BREAKING (infrastructure only, no prior consumers)**: CORS must now allow credentialed requests (cookies) from `FRONTEND_URL`, since the session is cookie-based - this changes the CORS configuration introduced in `init-backend` from a non-credentialed to a credentialed policy.
- Add new required environment variables for the LinkedIn client and session signing (see Impact).

## Capabilities

### New Capabilities
- `linkedin-login`: The LinkedIn OpenID Connect login flow itself - initiating the redirect to LinkedIn, handling the callback, validating the returned identity, and handing off to session establishment.
- `session-authentication`: The provider-agnostic authenticated-session mechanism that other modules depend on - the session cookie, `GET /auth/me`, `POST /auth/logout`, the reusable `AuthGuard`, and unauthorized-access behavior.
- `user-identity`: Persistence and identity rules for application users tied to a stable external (LinkedIn) identity - first-login user creation, profile updates on repeat login, and duplicate prevention.

### Modified Capabilities
- `api-foundation`: The Cross-Origin Access Control requirement must be extended - the configured frontend origin now needs credentialed (cookie-bearing) cross-origin requests to be supported, which the current requirement does not address.
- `environment-configuration`: The set of environment variables validated at startup grows to include the LinkedIn client configuration and the session signing secret.

## Impact

- New modules: `src/auth/`, `src/linkedin/`, `src/users/`.
- New Prisma model for application users (replacing the placeholder `Ping` model from `init-backend`), with a unique constraint on `linkedinId`; new migration.
- New environment variables: `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_CALLBACK_URL`, and a session/JWT signing secret (e.g. `AUTH_JWT_SECRET`).
- CORS configuration in `main.ts` changes to allow credentials for `FRONTEND_URL`.
- New dependency on an OAuth/OIDC client library to talk to LinkedIn, and a JWT library to sign/verify session tokens (exact libraries decided in design.md).
- No impact on `health-check` or `api-documentation` capabilities beyond documenting the new endpoints in Swagger.
- Out of scope: likes, comments, comment replies, article management, Sanity integration, notifications, user administration/moderation - all left to separate future OpenSpec changes per the proposal's Non-Goals.
