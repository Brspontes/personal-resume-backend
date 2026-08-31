## 1. Database & Schema

- [x] 1.1 Add `enum ReactionType { LIKE DISLIKE }` and a `Reaction` model (`id`, `userId`, `articleId`, `type`, `createdAt`, `updatedAt`, `@@unique([userId, articleId])`, `@@index([articleId])`) to `prisma/schema.prisma`.
- [x] 1.2 Add the inverse `reactions Reaction[]` relation to the `User` model.
- [x] 1.3 Generate and apply the Prisma migration against the local dev database.

## 2. Auth Module Extension

- [x] 2.1 Implement `OptionalAuthGuard` (`src/auth/guards/optional-auth.guard.ts`) that reads the session cookie, verifies it and loads the user when present, attaches it to `request.user` when valid, and always returns `true` (never rejects on a missing/invalid session).
- [x] 2.2 Export `OptionalAuthGuard` from `AuthModule` alongside `AuthGuard`.
- [x] 2.3 Unit test `OptionalAuthGuard`: allows the request through with no cookie (no `request.user`), allows it through with a valid cookie (`request.user` set), allows it through with an invalid/expired cookie (no `request.user`, no error thrown).

## 3. Reactions Module - Core

- [x] 3.1 Create `src/reactions/reactions.module.ts`, importing `AuthModule` for `AuthGuard`/`OptionalAuthGuard`/`@CurrentUser()`.
- [x] 3.2 Create `src/reactions/dto/create-reaction.dto.ts` with a `type` field validated via `@IsEnum(ReactionType)` (Prisma's generated enum from `@prisma/client`).
- [x] 3.3 Create `src/reactions/dto/reaction-summary.dto.ts` describing `{ likes: number, dislikes: number, userReaction: ReactionType | null }`.
- [x] 3.4 Implement `ReactionsService.applyReaction(userId, articleId, type)`: look up the existing reaction; create if none; delete if the existing type matches (toggle off); update if it differs. Catch the Prisma unique-constraint error (`P2002`) on the create path, re-fetch, and re-apply the same branching instead of surfacing a raw database error.
- [x] 3.5 Implement `ReactionsService.removeReaction(userId, articleId)`: delete the user's reaction if it exists; no-op (no error) if it doesn't.
- [x] 3.6 Implement `ReactionsService.getSummary(articleId, userId?)`: aggregate like/dislike counts for the article (e.g. via `groupBy`) and, when `userId` is provided, include that user's current reaction.

## 4. Reactions Module - Endpoints

- [x] 4.1 Implement `ReactionsController` with base route `articles/:articleId/reactions`.
- [x] 4.2 Implement `POST /api/v1/articles/:articleId/reactions`, guarded by `AuthGuard`, validating the body with `CreateReactionDto`, calling `applyReaction`, and returning the resulting reaction state.
- [x] 4.3 Implement `DELETE /api/v1/articles/:articleId/reactions`, guarded by `AuthGuard`, calling `removeReaction`, responding with a success status regardless of whether a reaction existed.
- [x] 4.4 Implement `GET /api/v1/articles/:articleId/reactions`, guarded by `OptionalAuthGuard`, calling `getSummary` with the optional current user, returning `ReactionSummaryDto`.
- [x] 4.5 Ensure the acting user's id is taken only from `@CurrentUser()` (the authenticated session), never from the request body, for the `POST` and `DELETE` handlers.
- [x] 4.6 Register `ReactionsModule` in `AppModule`.

## 5. Swagger Documentation

- [x] 5.1 Add Swagger decorators for all three endpoints (`@ApiTags`, `@ApiOperation`, `@ApiParam` for `articleId`, `@ApiResponse` including 400/401 cases), and document `ReactionSummaryDto`/`CreateReactionDto` for the generated schema.

## 6. Testing

- [x] 6.1 Unit test `ReactionsService.applyReaction`: creates on first reaction, updates on a different type, deletes on a resubmitted matching type, and recovers correctly from a simulated `P2002` unique-constraint error on create (mocked Prisma).
- [x] 6.2 Unit test `ReactionsService.removeReaction`: deletes an existing reaction; no-ops without error when none exists.
- [x] 6.3 Unit test `ReactionsService.getSummary`: returns correct like/dislike counts; returns the caller's `userReaction` when provided a `userId` with an existing reaction, `null` when the `userId` has none, and `null` when no `userId` is provided.
- [x] 6.4 E2E test for `POST /api/v1/articles/:articleId/reactions`: 401 without a session cookie; creates a reaction for a first-time authenticated request; changes an existing reaction to the opposite type; removes the reaction when the same type is resubmitted; rejects an invalid `type` with 400.
- [x] 6.5 E2E test for `DELETE /api/v1/articles/:articleId/reactions`: 401 without a session cookie; removes an existing reaction; behaves idempotently (no error) when no reaction exists.
- [x] 6.6 E2E test confirming a user cannot affect another user's reaction by supplying a different user identifier in the request body - the reaction is always applied to the authenticated session's own user.
- [x] 6.7 E2E test for `GET /api/v1/articles/:articleId/reactions`: returns correct counts and `userReaction` for an authenticated reacting user, `null` `userReaction` for an authenticated non-reacting user, and `null` `userReaction` with correct counts for an unauthenticated request - all without requiring a session cookie to succeed.
- [x] 6.8 Run the full test suite via the project's standard test commands and confirm it passes.

## 7. Build & Verification

- [x] 7.1 Run lint and fix any violations.
- [x] 7.2 Run the production build and confirm it completes without errors.
- [x] 7.3 Manually verify against the local dev database: create, change, toggle-off, and remove a reaction for a real authenticated session, and confirm `GET` reflects the correct counts and `userReaction` in each state.
