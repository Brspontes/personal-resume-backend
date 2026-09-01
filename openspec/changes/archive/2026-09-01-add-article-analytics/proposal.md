## Why

The portfolio backend can authenticate visitors, record reactions, and store comments, but has no way to measure whether an article is actually being read. Most visitors never authenticate, react, or comment, so an analytics mechanism that depends on those flows would miss the majority of article consumption. This change adds an independent analytics module that records anonymous and (when available) authenticated article engagement, without requiring authentication and without depending on Sanity's content API.

## What Changes

- Add a dedicated `Analytics` NestJS module (`src/analytics/`), isolated from `auth`, `linkedin`, `reactions`, and `comments`.
- Add an `AnalyticsEvent` Prisma model (`id`, `articleId`, `eventType`, `sessionId`, `userId` nullable, `metadata` nullable JSON, `createdAt`).
- Add an `AnalyticsEventType` enum with `ARTICLE_VIEW`, `ARTICLE_PROGRESS`, `ARTICLE_READ`.
- `POST /api/v1/analytics/events` — public, no authentication required; accepts a single analytics event and validates it against its event type's rules.
- Treat `articleId` as an opaque external (Sanity) identifier; the backend never fetches or stores article content.
- Accept a frontend-supplied anonymous `sessionId` to correlate events without requiring an account; never derive identity from it.
- When a valid application session is present, associate the event with the authenticated user via `OptionalAuthGuard`/`@CurrentUser()` (existing `auth` module) — never trust a client-supplied `userId`.
- Deduplicate `ARTICLE_VIEW` events per `(articleId, sessionId)` within a configurable time window (new `ANALYTICS_VIEW_DEDUP_WINDOW_SECONDS` env var); repeated views inside the window are accepted (HTTP 2xx) but not persisted.
- Deduplicate `ARTICLE_PROGRESS` milestones per `(articleId, sessionId, progress)`; only new milestones for that session/article pair are persisted.
- Validate `progress` against the fixed milestone set `{25, 50, 75, 90}`, and validate `duration`/`maxProgress` as non-negative with reasonable upper bounds.
- Isolate persistence in an `AnalyticsRepository`, keep event/deduplication business rules in `AnalyticsService`, and keep `AnalyticsController` limited to HTTP concerns.
- Add `@nestjs/throttler` and apply a per-IP rate limit to the analytics endpoint, since it is public and otherwise unauthenticated. This is a new dependency, justified by the endpoint's exposure to abuse (the codebase has no existing rate-limiting mechanism to reuse).
- Add Swagger documentation for the new endpoint and its request/response shapes, consistent with existing modules.

## Capabilities

### New Capabilities
- `article-analytics`: Records anonymous and optionally-authenticated article engagement events (`ARTICLE_VIEW`, `ARTICLE_PROGRESS`, `ARTICLE_READ`) against an opaque Sanity article identifier, with view/progress deduplication, input validation, and no dependency on authentication or Sanity's content API.

### Modified Capabilities
None. This change only consumes the existing `session-authentication` capability's `OptionalAuthGuard`/`@CurrentUser()`; it does not change that capability's requirements.

## Impact

- New module: `src/analytics/` (`analytics.module.ts`, `controllers/`, `services/`, `repositories/`, `dto/`).
- New Prisma model `AnalyticsEvent` and `AnalyticsEventType` enum, plus a migration; `userId` is a nullable, non-cascading reference so deleting a user does not destroy historical analytics.
- New API surface: `POST /api/v1/analytics/events`.
- New env var `ANALYTICS_VIEW_DEDUP_WINDOW_SECONDS` (added to `.env.example` and `env.validation.ts`).
- New dependency: `@nestjs/throttler`, applied to the analytics endpoint only.
- No impact on `auth`, `users`, `linkedin`, `reactions`, `comments`, or `health` modules beyond `analytics` importing `AuthModule` for the optional-auth guard.
- No Sanity integration: the backend stores only the article identifier string, never article content.
- Out of scope (per proposal Non-Goals): analytics dashboards/admin UI, LinkedIn auth changes, IP-based identification, fingerprinting, and any metric computation beyond storing events - left to future OpenSpec changes.
