## Context

Builds on the `init-backend` foundation (see `openspec/specs/api-foundation`, `environment-configuration`). See proposal.md - Why/What Changes for motivation and scope; the session strategy (httpOnly JWT cookie, not a Bearer token or server-side session store) was already decided with the user before this document was written. This document covers how the three modules (`auth`, `linkedin`, `users`) implement that decision, and the LinkedIn-specific protocol details.

## Goals / Non-Goals

**Goals:**
- Keep LinkedIn's OpenID Connect protocol details fully contained in the `linkedin` module; `auth` and `users` never see a LinkedIn access token or call the LinkedIn API directly.
- Keep the session mechanism stateless (no session store, no Redis) so it fits the existing minimal-infrastructure stack.
- Make the LinkedIn client swappable in tests without network calls.

**Non-Goals:**
- Supporting any identity provider other than LinkedIn. `session-authentication` is provider-agnostic in its contract, but this change only wires up one provider.
- Long-lived LinkedIn API access (no storage of LinkedIn access/refresh tokens; they are used once during login and discarded).
- Refresh-token rotation or session renewal flows - the session JWT has a fixed expiry; when it expires the visitor logs in again.

## Decisions

### OpenID Connect client: `openid-client`
Use the `openid-client` npm package (spec-compliant OIDC client, actively maintained) directly inside `LinkedinService`, rather than a Passport strategy. LinkedIn's current product is "Sign In with LinkedIn using OpenID Connect", which exposes standard OIDC discovery/authorization/token/userinfo endpoints - `openid-client` talks to it without a LinkedIn-specific dependency.
- Alternative considered: `passport-linkedin-oauth2` / similar Passport strategies. Rejected - they target LinkedIn's older OAuth2 REST APIs (`r_liteprofile`, deprecated), not the current OIDC product, and add an abstraction layer that makes mocking in tests harder for no benefit here (we only have one provider and don't need Passport's multi-strategy plumbing).

### Session token: JWT in an httpOnly cookie, no server-side store
`@nestjs/jwt` signs a short payload (`{ sub: userId }`) with `AUTH_JWT_SECRET` (HS256) and a fixed expiry (7 days). The callback handler sets it via `res.cookie('session', token, { httpOnly: true, secure, sameSite })`. `AuthGuard` reads the same cookie, verifies the signature/expiry, loads the user via `UsersService`, and attaches it to `request.user`. No session table, no Redis - matches the already-decided cookie-JWT strategy and avoids new infrastructure.
- `secure` is `true` whenever `NODE_ENV === 'production'`, `false` otherwise (local HTTP dev has no TLS).
- `sameSite` is `'none'` in production (frontend and backend are different origins) and `'lax'` in development. `sameSite: 'none'` requires `secure: true`, which holds in production.

### CSRF protection for the OAuth redirect: short-lived `state`/`nonce` cookie
`GET /api/v1/auth/linkedin` generates an OIDC `state` and `nonce`, stores both in a short-lived (5 minute), httpOnly cookie, and includes them in the authorization URL. The callback compares the returned `state` against the cookie value before exchanging the code, then clears the cookie. This keeps CSRF protection stateless (no server-side store) while still following OIDC's recommended mitigation.

**Deviation found during manual verification (task 9.3):** LinkedIn's ID token never echoes back the `nonce` claim, so `openid-client`'s strict nonce check against the ID token always fails with a real LinkedIn app (`nonce mismatch, expected <value>, got: undefined`) - this is a known LinkedIn OIDC conformance gap, not a bug in our code. The `nonce` is still generated, sent in the authorization request, and round-tripped through a cookie (harmless, and forward-compatible if LinkedIn ever fixes this), but `LinkedinService.exchangeCodeForIdentity` only passes `state` into `openid-client`'s callback checks. `state` remains the CSRF protection for this flow; token exchange also required explicitly setting `token_endpoint_auth_method: 'client_secret_post'` on the client, since LinkedIn's token endpoint rejects the HTTP Basic auth `openid-client` defaults to.

### Post-login return destination: `returnTo` carried through the same OIDC cookie
LinkedIn's callback request only ever carries `code` and `state` - it has no way to relay an application-specific value like "which article the visitor was reading". So `returnTo` is never sent to or expected back from LinkedIn: `GET /api/v1/auth/linkedin` reads it from the initiating request's query string, validates it, and stores it in a short-lived httpOnly cookie alongside `oidc_state`/`oidc_nonce` (same options, same 5-minute expiry). Because the whole round trip (our redirect to LinkedIn, then LinkedIn's redirect back) happens in the same browser, that cookie is automatically resent to our own callback endpoint regardless of what LinkedIn puts in the callback URL. The callback reads `returnTo` from the cookie, not from any parameter LinkedIn controls, and appends it to `FRONTEND_URL` for the final redirect.

`returnTo` is validated once, at ingestion in the login handler, as a same-site relative path: it must start with a single `/` and not with `//` or `/\` (both of which browsers can interpret as protocol-relative, i.e. an absolute URL to a different host). An invalid or absent value is treated as "no `returnTo`", falling back to bare `FRONTEND_URL`. Without this check, a crafted link like `/api/v1/auth/linkedin?returnTo=https://evil.example` would make our own login flow end by sending an authenticated visitor to an attacker-controlled page - a classic open-redirect phishing setup - so this validation is a security requirement, not a nicety.

### LinkedIn identity mapping and available fields
LinkedIn's OIDC `userinfo` endpoint (scopes `openid profile email`) returns `sub`, `name`, `picture`, `email`, `email_verified` - it does **not** return a profile URL. The proposal's example `User` shape includes `linkedinUrl`; per the proposal's own caveat ("fields SHALL be validated against information actually available"), `linkedinUrl` is dropped. The persisted `User` model is:
```
User
├── id            (application-generated primary key)
├── linkedinId    (LinkedIn `sub`, unique)
├── name
├── avatarUrl     (LinkedIn `picture`, nullable - not always present)
├── email         (nullable - only present if LinkedIn grants/returns it)
├── createdAt
└── updatedAt
```
LinkedIn access/refresh tokens are used only in-memory during the callback (to call `userinfo`) and are never persisted, per the proposal's guidance to avoid storing tokens without a clear need.

### Duplicate prevention: DB-level unique constraint + upsert
`linkedinId` has a `@unique` constraint in Prisma. `UsersService.findOrCreateFromLinkedin(...)` uses `prisma.user.upsert({ where: { linkedinId }, update: {...}, create: {...} })`, which Postgres executes atomically (`INSERT ... ON CONFLICT DO UPDATE`), so two concurrent first-logins for the same identity cannot create two rows - the second `upsert` call updates the row the first one just inserted instead of erroring.

### Replacing the `Ping` placeholder model
`init-backend` added a placeholder `Ping` Prisma model solely so `prisma generate` had something to generate against (see its schema comment: "remove it once the first feature module adds its own models"). This change removes `Ping` and adds `User` in the same migration.

### Error translation
LinkedIn/OIDC failures (discovery failure, token exchange failure, invalid `state`) are thrown as NestJS `HttpException` subtypes (`UnauthorizedException` for identity/state problems, `BadGatewayException` for LinkedIn being unreachable) from `AuthController`/`AuthService`. The existing global `HttpExceptionFilter` from `init-backend` already sanitizes these before they reach the client, so no new error-handling infrastructure is needed - only correct exception types and log messages that never include tokens or secrets.

## Risks / Trade-offs

- [`sameSite: 'none'` cookies require HTTPS in production; if the deployed backend and frontend are ever served over plain HTTP, the browser silently drops the session cookie] → Document `FRONTEND_URL`/backend deployment as HTTPS-only in production; local dev uses `sameSite: 'lax'` over HTTP where the browser allows it.
- [Stateless JWT sessions cannot be revoked before expiry - logout only clears the client's cookie, so a stolen token remains valid until it expires] → Keep the expiry short (7 days) as a bound on exposure; a server-side revocation list is explicitly out of scope for this change (would require the session store this design deliberately avoids).
- [`openid-client` performing OIDC discovery on every cold start adds a network round-trip to LinkedIn before the first login-capable request] → Acceptable for this change's scope; the discovery document can be cached in-memory by the client instance without added infrastructure.
- [Mapping only `sub`/`name`/`picture`/`email` means the frontend gets less profile data than the proposal's example `User` shape suggested (no `linkedinUrl`)] → Documented above; revisit only if a future change has a concrete need for the public profile URL (would require LinkedIn's separate, more restricted Profile API).

## Migration Plan

1. Add `User` model to `prisma/schema.prisma`, remove the `Ping` placeholder model, and generate a new Prisma migration.
2. Add the new required environment variables (`LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_CALLBACK_URL`, `AUTH_JWT_SECRET`) to `.env.example` and the startup validation schema.
3. Register a LinkedIn OIDC application (outside this repo) with the callback URL matching `LINKEDIN_CALLBACK_URL` for each environment.
4. Deploy backend changes; verify `GET /api/v1/auth/linkedin` completes a full login round-trip against a real LinkedIn app in a non-production environment before enabling it in production.

Rollback: the new endpoints and modules are additive and gated behind their own routes; disabling them (or not routing traffic to them) requires no rollback of the `init-backend` foundation. The `Ping` → `User` migration is a schema change; rolling back would require a down-migration dropping `User` and restoring `Ping`, acceptable given no production data depends on either yet.
