## 1. Dependencies & Configuration

- [x] 1.1 Add `@nestjs/throttler` to `package.json` and install it.
- [x] 1.2 Add `ANALYTICS_VIEW_DEDUP_WINDOW_SECONDS` to `env.validation.ts` (numeric, with a sensible default) and document it in `.env.example`.

## 2. Database & Schema

- [x] 2.1 Add `enum AnalyticsEventType { ARTICLE_VIEW ARTICLE_PROGRESS ARTICLE_READ }` to `prisma/schema.prisma`.
- [x] 2.2 Add an `AnalyticsEvent` model (`id`, `articleId`, `eventType`, `sessionId`, `userId` nullable, `progress` nullable, `durationSeconds` nullable, `maxProgress` nullable, `metadata` nullable `Json`, `createdAt`) with `userId` referencing `User.id` via `onDelete: SetNull`, and `@@index([articleId, sessionId, eventType, createdAt])`.
- [x] 2.3 Add the inverse nullable `analyticsEvents AnalyticsEvent[]` relation to the `User` model.
- [x] 2.4 Generate and apply the Prisma migration against the local dev database.

## 3. Analytics Module - DTOs & Validation

- [x] 3.1 Create `src/analytics/analytics.module.ts`, importing `AuthModule` (for `OptionalAuthGuard`/`@CurrentUser()`) and registering `ThrottlerModule.forRoot(...)` with a fixed default rate limit.
- [x] 3.2 Create `src/analytics/dto/record-analytics-event.dto.ts`: `event` (`@IsEnum(AnalyticsEventType)`), `articleId` (`@IsString`, `@IsNotEmpty`), `sessionId` (`@IsString`, `@IsNotEmpty`, bounded max length), `progress` (`@ValidateIf` event === `ARTICLE_PROGRESS`, `@IsIn([25, 50, 75, 90])`), `duration` (`@ValidateIf` event === `ARTICLE_READ`, `@IsInt`, `@Min(0)`, bounded max), `maxProgress` (`@ValidateIf` event === `ARTICLE_READ`, `@IsInt`, `@Min(0)`, `@Max(100)`).
- [x] 3.3 Add Swagger metadata (`@ApiProperty`) to the DTO documenting which fields apply to which event type.

## 4. Analytics Module - Repository & Service

- [x] 4.1 Create `src/analytics/repositories/analytics.repository.ts` wrapping `PrismaService`: `create(data)`, `findRecentView(articleId, sessionId, since)`, `findProgress(articleId, sessionId, progress)`.
- [x] 4.2 Implement `AnalyticsService.recordEvent(dto, userId?: string)`:
  - For `ARTICLE_VIEW`: check `findRecentView` against `now - ANALYTICS_VIEW_DEDUP_WINDOW_SECONDS`; skip persistence if a recent view exists.
  - For `ARTICLE_PROGRESS`: check `findProgress` for the exact milestone; skip persistence if it already exists.
  - For `ARTICLE_READ`: persist unconditionally (no dedup rule).
  - In all cases, set `userId` only from the method's `userId` parameter (never from the DTO).
- [x] 4.3 Ensure `AnalyticsService` never accepts or persists a `userId` sourced from the request body/DTO.

## 5. Analytics Module - Controller & Endpoint

- [x] 5.1 Create `src/analytics/controllers/analytics.controller.ts` with base route `analytics/events`.
- [x] 5.2 Implement `POST /api/v1/analytics/events`, guarded by `OptionalAuthGuard` and `ThrottlerGuard`, validating the body with `RecordAnalyticsEventDto`, calling `AnalyticsService.recordEvent(dto, user?.id)`, and responding `204 No Content` regardless of whether the event was persisted or deduplicated.
- [x] 5.3 Add Swagger decorators (`@ApiTags`, `@ApiOperation`, `@ApiResponse` for 204/400/429) to the controller.
- [x] 5.4 Register `AnalyticsModule` in `AppModule`.

## 6. Testing

- [x] 6.1 Unit test `AnalyticsService.recordEvent` for `ARTICLE_VIEW`: persists a first view; skips persistence for a duplicate view inside the dedup window; persists again for a view after the window elapses (mocked Prisma/repository with controllable timestamps).
- [x] 6.2 Unit test `AnalyticsService.recordEvent` for `ARTICLE_PROGRESS`: persists a new milestone; skips a repeated identical milestone; persists a different, not-yet-seen milestone.
- [x] 6.3 Unit test `AnalyticsService.recordEvent` for `ARTICLE_READ`: persists with the supplied `duration` and `maxProgress`.
- [x] 6.4 Unit test that `AnalyticsService.recordEvent` always uses the `userId` parameter for association and ignores any user-identifying value present on the DTO.
- [x] 6.5 Unit test `RecordAnalyticsEventDto` validation: valid payloads per event type are accepted; invalid `event` values are rejected; missing/invalid `articleId` and `sessionId` are rejected; out-of-set `progress` values are rejected; negative or excessive `duration` is rejected; out-of-range `maxProgress` is rejected.
- [x] 6.6 E2E test for `POST /api/v1/analytics/events`: accepts a valid `ARTICLE_VIEW`/`ARTICLE_PROGRESS`/`ARTICLE_READ` request without a session cookie (anonymous); accepts the same requests with a valid session cookie and associates the event with the authenticated user; rejects malformed payloads with 400.
- [x] 6.7 E2E test confirming view deduplication: two `ARTICLE_VIEW` requests for the same `articleId`/`sessionId` within the configured window result in only one persisted event.
- [x] 6.8 E2E test confirming progress deduplication: resubmitting the same milestone for the same `articleId`/`sessionId` does not create a second event, while a new milestone does.
- [x] 6.9 E2E test confirming a client-supplied user identifier in the request body does not override the authenticated session's identity. (The DTO has no `userId` field at all - structurally enforced - covered directly by the unit test in 6.4; the e2e suite confirms the authenticated session, not the body, determines the association.)
- [x] 6.10 E2E test confirming an oversized payload or an out-of-bounds numerical value is rejected with a 4xx response.
- [x] 6.11 E2E test confirming the analytics response contains no authentication/session details.
- [x] 6.12 Run the full test suite via the project's standard test commands and confirm it passes.

## 7. Build & Verification

- [x] 7.1 Run lint and fix any violations.
- [x] 7.2 Run the production build and confirm it completes without errors.
- [x] 7.3 Manually verify against the local dev database: send `ARTICLE_VIEW`, `ARTICLE_PROGRESS`, and `ARTICLE_READ` events (anonymous and authenticated), confirm deduplication behavior, and confirm rows land correctly in `AnalyticsEvent`. (Anonymous path verified live against the local Postgres database; the authenticated-association path is covered by the e2e suite's real `AuthModule`/`OptionalAuthGuard` wiring, since manual verification would require live LinkedIn OAuth credentials.)
