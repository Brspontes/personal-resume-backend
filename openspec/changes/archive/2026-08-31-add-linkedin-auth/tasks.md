## 1. Dependencies & Schema

- [x] 1.1 Add dependencies: `openid-client`, `@nestjs/jwt`, `cookie-parser` (+ `@types/cookie-parser` dev dependency).
- [x] 1.2 Remove the placeholder `Ping` model from `prisma/schema.prisma`; add a `User` model (`id`, `linkedinId` unique, `name`, `avatarUrl` nullable, `email` nullable, `createdAt`, `updatedAt`).
- [x] 1.3 Generate the Prisma migration for the `Ping` → `User` change and apply it against the local dev database.

## 2. Environment Configuration

- [x] 2.1 Extend `envValidationSchema` with `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_CALLBACK_URL` (required strings/URI) and `AUTH_JWT_SECRET` (required string, minimum length enforced).
- [x] 2.2 Add the new variables to `.env.example` with placeholder (non-real) values.

## 3. Users Module

- [x] 3.1 Create `src/users/users.module.ts` and `src/users/users.service.ts`.
- [x] 3.2 Implement `UsersService.findOrCreateFromLinkedin(identity)` using `prisma.user.upsert` keyed on `linkedinId`, creating on first login and updating `name`/`avatarUrl`/`email` on repeat logins.
- [x] 3.3 Implement `UsersService.findById(id)` for use by the auth guard.
- [x] 3.4 Define the LinkedIn identity input type (`sub`, `name`, `picture`, `email`) consumed by `findOrCreateFromLinkedin`, decoupled from any LinkedIn SDK types.

## 4. LinkedIn Module

- [x] 4.1 Create `src/linkedin/linkedin.module.ts` and `src/linkedin/linkedin.service.ts`.
- [x] 4.2 Implement OIDC discovery/client setup against LinkedIn's OpenID Connect issuer using `openid-client`, configured from `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_CALLBACK_URL`.
- [x] 4.3 Implement `LinkedinService.buildAuthorizationUrl(state, nonce)` requesting the `openid profile email` scopes.
- [x] 4.4 Implement `LinkedinService.exchangeCodeForIdentity(code, state, nonce)` that performs the token exchange, calls the userinfo endpoint, and returns a mapped identity (`sub`, `name`, `picture`, `email`), throwing on failure.
- [x] 4.5 Ensure LinkedIn access/refresh tokens are only held in local variables during the exchange and are never logged or persisted.

## 5. Auth Module

- [x] 5.1 Create `src/auth/auth.module.ts`, `src/auth/auth.controller.ts`, `src/auth/auth.service.ts`.
- [x] 5.2 Register `cookie-parser` middleware globally so controllers/guards can read cookies.
- [x] 5.3 Implement `GET /api/v1/auth/linkedin`: generate `state`/`nonce`, set them in a short-lived httpOnly cookie, redirect to the LinkedIn authorization URL from `LinkedinService`.
- [x] 5.4 Implement `GET /api/v1/auth/linkedin/callback`: validate `state` against the cookie, call `LinkedinService.exchangeCodeForIdentity`, call `UsersService.findOrCreateFromLinkedin`, issue a signed JWT via `@nestjs/jwt`, set it as the httpOnly session cookie, clear the state cookie, and redirect to `FRONTEND_URL`.
- [x] 5.5 Handle LinkedIn error responses and code/identity validation failures on the callback without establishing a session, per the `linkedin-login` spec scenarios.
- [x] 5.6 Implement `AuthGuard` (`src/auth/guards/auth.guard.ts`) that reads the session cookie, verifies the JWT, loads the user via `UsersService.findById`, attaches it to `request.user`, and rejects with 401 when missing/invalid/expired.
- [x] 5.7 Implement `GET /api/v1/auth/me` protected by `AuthGuard`, returning the authenticated user's non-sensitive profile fields.
- [x] 5.8 Implement `POST /api/v1/auth/logout` that clears the session cookie.
- [x] 5.9 Add a param decorator (e.g. `@CurrentUser()`) so guarded endpoints can access `request.user` without reaching into the request object directly.
- [x] 5.10 Add a `returnTo` query parameter to `GET /api/v1/auth/linkedin`, validated as a same-site relative path (rejecting absolute/protocol-relative values), and store it in a short-lived httpOnly cookie alongside `oidc_state`/`oidc_nonce`.
- [x] 5.11 On `GET /api/v1/auth/linkedin/callback`, read the `returnTo` cookie, clear it alongside the other OIDC cookies, and redirect to `FRONTEND_URL` + `returnTo` when present and valid, falling back to bare `FRONTEND_URL` otherwise.

## 6. API Foundation Updates

- [x] 6.1 Update CORS configuration in `main.ts` to set `credentials: true` for the configured `FRONTEND_URL` origin.
- [x] 6.2 Set session and state cookies with `secure`/`sameSite` values derived from `NODE_ENV` per design.md (production: `secure: true, sameSite: 'none'`; development: `secure: false, sameSite: 'lax'`).

## 7. Swagger Documentation

- [x] 7.1 Add Swagger decorators for `GET /api/v1/auth/linkedin`, `GET /api/v1/auth/linkedin/callback`, `GET /api/v1/auth/me`, and `POST /api/v1/auth/logout`, including response schemas and the 401 case for `/auth/me`.
- [x] 7.2 Add a response DTO for the authenticated user shape returned by `/auth/me`, excluding any authentication secrets.

## 8. Testing

- [x] 8.1 Unit test `UsersService.findOrCreateFromLinkedin`: creates on first login, reuses and updates on repeat login, and does not create a duplicate for a concurrent upsert on the same `linkedinId`.
- [x] 8.2 Unit test `LinkedinService` with `openid-client` mocked: successful identity mapping, and failure propagation on token exchange/userinfo errors.
- [x] 8.3 Unit test `AuthGuard`: allows a request with a valid session cookie, rejects a missing cookie, rejects an invalid/expired token.
- [x] 8.4 E2E test for `GET /api/v1/auth/linkedin/callback` (LinkedIn calls mocked): successful callback sets the session cookie and redirects to `FRONTEND_URL`; invalid `state` and LinkedIn error responses are rejected without setting a session cookie.
- [x] 8.5 E2E test for `GET /api/v1/auth/me`: returns the user with a valid session cookie, returns 401 without one.
- [x] 8.6 E2E test for `POST /api/v1/auth/logout`: session cookie is cleared and a subsequent `/auth/me` call returns 401.
- [x] 8.7 E2E test for a guarded sample route confirming `AuthGuard` blocks unauthenticated requests and allows authenticated ones (mirrors the pattern used for the global `ValidationPipe` test in `init-backend`).
- [x] 8.8 Unit test the environment validation schema: fails to validate when `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_CALLBACK_URL`, or `AUTH_JWT_SECRET` are missing, or `AUTH_JWT_SECRET` is too short.
- [x] 8.9 Run the full test suite via the project's standard test commands and confirm it passes.
- [x] 8.10 E2E test for `returnTo`: a safe relative `returnTo` is preserved through the full round-trip and appended to `FRONTEND_URL` on the post-login redirect; an unsafe `returnTo` (absolute URL or protocol-relative) is discarded and the redirect falls back to bare `FRONTEND_URL`.

## 9. Build & Verification

- [x] 9.1 Run lint and fix any violations.
- [x] 9.2 Run the production build and confirm it completes without errors.
- [x] 9.3 Register a LinkedIn OIDC application for local development, set the new environment variables, and manually verify a full login round-trip (`/auth/linkedin` → LinkedIn → `/auth/linkedin/callback` → session cookie set → `/auth/me` returns the user → `/auth/logout` clears it).
- [x] 9.4 Confirm no secrets (LinkedIn client secret, `AUTH_JWT_SECRET`, `.env`) are committed.
