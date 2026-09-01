## Context

Builds on `add-linkedin-auth` (`OptionalAuthGuard`, `@CurrentUser()`, `AuthModule`) and `init-backend` (Prisma, global `ValidationPipe`, centralized `HttpExceptionFilter`). See proposal.md - Why/What Changes for motivation and scope. This document covers the event/deduplication data model, how a single public endpoint validates three different event shapes, and the new rate-limiting dependency.

The codebase currently has no repository layer (`ReactionsService`/`CommentsService` call `PrismaService` directly) and no rate-limiting dependency. This change introduces both because the proposal explicitly requires them for this module: a repository layer (isolating persistence per proposal's Repository section) and abuse protection (the endpoint is public and unauthenticated, unlike the existing mutating endpoints which all require a session).

## Goals / Non-Goals

**Goals:**
- Make deduplication (view and progress) correct for the common case without adding a new table or cache layer - a time-windowed/exact-match query against `AnalyticsEvent` itself is sufficient at this scale.
- Keep `analytics/` fully decoupled from `linkedin/`: it only ever sees an optional authenticated `userId`, exactly like `reactions/`.
- Establish the `Controller → Service → Repository → Prisma` layering the proposal asks for, as a pattern other modules can adopt later without forcing a repo-wide refactor now.

**Non-Goals:**
- Exact-once delivery guarantees under concurrent duplicate requests - analytics is explicitly non-authoritative (proposal's Security section: "SHALL NOT be considered a trusted source of security-sensitive information"), so a rare race producing one extra row is acceptable.
- Any metric computation (totals, averages, completion rate) - only the event log is built; derivation is future work per proposal's Future Metrics section.
- General-purpose rate limiting for the whole API - `@nestjs/throttler` is wired up and applied only to the analytics endpoint in this change.

## Decisions

### Single endpoint, one DTO with conditional validation
`POST /api/v1/analytics/events` accepts all three event types through one `RecordAnalyticsEventDto`, discriminated by an `event` field (`AnalyticsEventType` enum). `progress` is required and validated (`@IsIn([25, 50, 75, 90])`) only when `event === ARTICLE_PROGRESS`; `duration`/`maxProgress` are required and bounded only when `event === ARTICLE_READ`, using `class-validator`'s `@ValidateIf`. Alternative considered: three separate DTOs behind a discriminated union - rejected because `class-validator`/`class-transformer` and Swagger's schema generation don't cleanly support discriminated unions without extra tooling, and a single DTO keeps the controller consistent with the rest of the codebase's one-DTO-per-endpoint pattern.

### Deduplication via query, not a separate state table
Both dedup rules are implemented as a read against `AnalyticsEvent` before writing, inside `AnalyticsService`:
- **View**: `AnalyticsRepository.findRecentView(articleId, sessionId, sinceTimestamp)` - if a matching `ARTICLE_VIEW` row exists with `createdAt >= now - ANALYTICS_VIEW_DEDUP_WINDOW_SECONDS`, skip the write.
- **Progress**: `AnalyticsRepository.findProgress(articleId, sessionId, progress)` - if a matching `ARTICLE_PROGRESS` row exists for that exact milestone (no time window), skip the write.

Alternative considered: a Redis or in-memory dedup cache. Rejected as premature - the existing stack has no cache layer, event volume for a personal portfolio site doesn't need one, and the query approach keeps the single source of truth in Postgres, matching the project's "no new abstraction without clear value" guideline.

Both checks are read-then-write, not enforced by a database constraint (unlike `Reaction`'s `@@unique`), because the view-dedup rule is time-windowed rather than a permanent uniqueness rule and cannot be expressed as a static unique index. A concurrent double-submit can therefore rarely produce one duplicate row; accepted per the Non-Goals above.

### Typed columns for event-specific fields, not JSON-only
`progress`, `durationSeconds`, and `maxProgress` are nullable typed columns on `AnalyticsEvent`, populated only for the event types that use them, rather than packed into `metadata`. This keeps the dedup queries (`WHERE articleId = ? AND sessionId = ? AND progress = ?`) simple typed Prisma queries consistent with `ReactionsService`/`CommentsService`, instead of Postgres JSON operators. `metadata` remains a nullable `Json` column, per the proposal's "metadata should remain extensible," but nothing is written to it in this change - it exists for future event context without needing a migration.

### `userId` uses `onDelete: SetNull`, not `Cascade`
`Reaction.userId` cascades because a reaction is meaningless without its owner. An `AnalyticsEvent` is different: it represents a historical, aggregate-relevant fact ("this article was read") that should survive user deletion for future metrics, just anonymized. `userId` is therefore nullable with `onDelete: SetNull`.

### Session identifier is treated as an opaque bounded string
The backend validates `sessionId` only for presence and a maximum length (e.g. 128 characters) - not a specific format (UUID, etc.) - to avoid coupling to the frontend's session-ID generation scheme, matching how `articleId` is treated as opaque.

### Response shape: `204 No Content`
Because a request can be valid but intentionally not persisted (deduplication), returning a body describing "created" vs "deduplicated" would leak internal state the frontend doesn't need and doesn't act on. The endpoint returns `204 No Content` on any successfully validated request, whether or not a row was written.

### `AnalyticsModule` imports `UsersModule` alongside `AuthModule`
Same NestJS DI requirement documented in `add-article-reactions`'s design: `OptionalAuthGuard` depends on both `AuthService` and `UsersService`, and Nest resolves a guard's dependencies within the *consuming* module's graph, not the exporting module's. `AnalyticsModule` therefore imports `UsersModule` directly, in addition to `AuthModule` - importing `AuthModule` alone is not sufficient, confirmed by an e2e dependency-resolution failure during implementation.

### New dependency: `@nestjs/throttler`
Every other public endpoint in the codebase is a `GET` (reactions summary, comments list, health) with no write side effect; this is the first public endpoint that writes data, so it's the first to need abuse protection. `@nestjs/throttler`'s `ThrottlerGuard` is applied only to `AnalyticsController` (via `@UseGuards(ThrottlerGuard)` on the controller, not a global `APP_GUARD`), with a fixed default limit configured in `AnalyticsModule`'s `ThrottlerModule.forRoot(...)` call. The limit is not exposed as an env var in this change - it's an implementation safety net, not environment-specific behavior like `FRONTEND_URL` or `DATABASE_URL`; it can be made configurable later if a real need arises, consistent with the project's "avoid premature abstraction" guidance.

### Data model
```
AnalyticsEvent
├── id              (cuid, primary key)
├── articleId        (opaque string - the Sanity document id)
├── eventType         (AnalyticsEventType: ARTICLE_VIEW | ARTICLE_PROGRESS | ARTICLE_READ)
├── sessionId         (opaque, frontend-generated anonymous session id)
├── userId            (nullable, references User.id, onDelete: SetNull)
├── progress          (nullable Int - milestone for ARTICLE_PROGRESS, maxProgress for ARTICLE_READ... see note)
├── durationSeconds    (nullable Int - ARTICLE_READ only)
├── maxProgress        (nullable Int - ARTICLE_READ only)
├── metadata           (nullable Json - reserved, unused in this change)
└── createdAt

@@index([articleId, sessionId, eventType, createdAt])  -- dedup + future per-article queries
```
Note: `progress` (used by `ARTICLE_PROGRESS`) and `maxProgress` (used by `ARTICLE_READ`) are distinct columns, not shared, so a milestone value is never ambiguous with a completion's max-progress value when queried.

## Risks / Trade-offs

- [Read-then-write dedup allows a rare duplicate row under truly concurrent identical requests] → Acceptable: analytics is explicitly non-authoritative and best-effort (proposal's Security section); a future metrics job can collapse near-duplicate rows if this ever matters in practice.
- [Rate limit threshold is hardcoded rather than env-configurable] → Revisit only if real abuse is observed or the limit needs environment-specific tuning; adding an env var later is a small, additive change.
- [No foreign-key relationship to an Article table means an event can reference an `articleId` that no longer exists in Sanity] → Accepted per the proposal's explicit non-goal of an Article entity, same precedent as `article-reactions` and `article-comments`.
- [A single conditionally-validated DTO is slightly harder to read than three separate DTOs] → Mitigated by keeping each conditional validator colocated with the field it governs and documenting the event-type-to-required-fields mapping in the DTO's Swagger metadata.

## Migration Plan

1. Add the `AnalyticsEventType` enum and `AnalyticsEvent` model to `prisma/schema.prisma` (plus the inverse nullable relation on `User`), and generate a new migration.
2. Add `ANALYTICS_VIEW_DEDUP_WINDOW_SECONDS` to `env.validation.ts` and `.env.example`.
3. Add `@nestjs/throttler` to `package.json`.
4. Deploy; no data backfill needed since this is a brand-new table.

Rollback: purely additive - no existing endpoint, table, or module is modified - so rollback is not routing traffic to `POST /api/v1/analytics/events` and, if needed, a down-migration dropping the `AnalyticsEvent` table and `AnalyticsEventType` enum.
