## Context

Builds on the authentication foundation from `add-linkedin-auth` (`AuthGuard`, `@CurrentUser()`, `AuthService`, `UsersService`) and the `init-backend` foundation (Prisma, global validation, centralized error handling). See proposal.md - Why/What Changes for motivation and scope. This document covers the concurrency-safe toggle logic, the Prisma schema, and how the public `GET` endpoint reads an optional session without using the existing (always-rejecting) `AuthGuard`.

## Goals / Non-Goals

**Goals:**
- Make the one-reaction-per-user-per-article rule impossible to violate even under concurrent requests, without over-engineering (no distributed locks, no serializable transactions where a unique constraint + retry suffices).
- Keep `reactions/` fully decoupled from `linkedin/`: it only ever sees an authenticated `userId`, never LinkedIn identity details.
- Let the public `GET` endpoint reuse the same session-cookie mechanism as `AuthGuard`, without duplicating session validation logic.

**Non-Goals:**
- Any Article persistence or Sanity synchronization (per proposal's Non-Goals) - `articleId` is an opaque string.
- Reaction history/audit trail - only the current reaction (if any) is stored; changing or removing a reaction overwrites/deletes the row.
- Rate limiting or abuse prevention on the reaction endpoints - not required by this change's success criteria.

## Decisions

### Toggle logic: read-then-branch, not a single upsert
Prisma's `upsert` can create-or-update but cannot conditionally delete, so the "resubmitting the same type removes the reaction" rule needs explicit branching in `ReactionsService`:
1. Look up the existing reaction for `(userId, articleId)`.
2. No existing reaction → create it.
3. Existing reaction, same type → delete it (toggle off).
4. Existing reaction, different type → update it.

Alternative considered: a single raw SQL `INSERT ... ON CONFLICT` statement. Rejected - Prisma's typed query builder is sufficient here and keeps the logic testable/mockable like the rest of the codebase; raw SQL would be the one place bypassing that pattern for no real benefit.

### Concurrency: rely on the unique constraint, recover from the race
The `(userId, articleId)` unique constraint is the actual source of truth for "at most one reaction," per the proposal's explicit requirement that application-level checks alone are not sufficient. When two concurrent requests both see "no existing reaction" and both attempt `create`, the loser's `create` fails with Prisma error `P2002` (unique constraint violation). `ReactionsService` catches that specific error, re-fetches the row the winner just created, and re-applies the toggle/change logic against it - so the loser's request still produces the correct end state (matching, changing, or toggling off the winner's reaction) instead of surfacing a raw database error.

### Public retrieval without the existing (rejecting) AuthGuard
`AuthGuard` throws `UnauthorizedException` whenever the session cookie is missing or invalid - the right behavior for `POST`/`DELETE`, wrong for `GET`, which must succeed either way and only vary the `userReaction` field. Add an `OptionalAuthGuard` to the existing `auth` module (next to `AuthGuard`, reusing the same `AuthService.verifySession` + `UsersService.findById` calls) that populates `request.user` when a valid session is present and otherwise leaves it `undefined`, always returning `true`. This keeps session-validation logic centralized in `auth/` (per the project's modularity rule that business modules never implement their own auth checks) while giving `reactions/` the "soft" check it needs.

**Deviation found during implementation:** using `AuthGuard`/`OptionalAuthGuard` from a *different* module (`reactions/`) than the one that provides them turned out to require more than just exporting the guards themselves. NestJS resolves a guard referenced via `@UseGuards(SomeGuard)` within the consuming controller's own module graph, so every constructor dependency of that guard - not just the guard class - must be reachable from `ReactionsModule`. `AuthModule` was exporting `AuthGuard`/`OptionalAuthGuard` but not `AuthService` (a guard dependency), and `ReactionsModule` only imported `AuthModule`, not the `UsersModule` `AuthGuard` also depends on transitively. Fixed by also exporting `AuthService` from `AuthModule` and importing `UsersModule` directly in `ReactionsModule`. This is the standard NestJS pattern for sharing a guard across modules, not a design shortcut.

### Reuse Prisma's generated `ReactionType` enum
`schema.prisma` defines `enum ReactionType { LIKE DISLIKE }`; Prisma generates a matching TypeScript enum on `@prisma/client`. The `CreateReactionDto` validates its `type` field against that same generated enum (`@IsEnum(ReactionType)`) instead of hand-rolling a parallel `src/reactions/enums/reaction-type.enum.ts` as the proposal's illustrative structure suggested - one definition, no risk of the two drifting apart. The proposal itself notes "the exact structure may evolve during implementation."

### Data model
```
Reaction
├── id          (cuid, primary key)
├── userId      (references User.id, cascades on user deletion)
├── articleId   (opaque string - the Sanity document id)
├── type        (ReactionType: LIKE | DISLIKE)
├── createdAt
└── updatedAt

@@unique([userId, articleId])
@@index([articleId])   -- GET .../reactions aggregates by articleId
```

### Response shape
`GET /api/v1/articles/:articleId/reactions` returns `{ likes: number, dislikes: number, userReaction: 'LIKE' | 'DISLIKE' | null }`, computed with a single `groupBy` query on `articleId` for the counts plus (when authenticated) the caller's own row - matching the shape already specified in the proposal's examples.

## Risks / Trade-offs

- [Read-then-branch has a small window where a losing concurrent request does extra work (a failed create + a re-fetch) before converging] → Acceptable: reaction toggling is a low-frequency, single-user-double-click scenario, not a hot path needing lock-free single-round-trip writes.
- [`OptionalAuthGuard` duplicates a few lines of `AuthGuard`'s cookie-reading logic] → Both stay thin wrappers around the same `AuthService`/`UsersService` calls; if this pattern is needed a third time, worth extracting a shared helper then, not preemptively now.
- [No foreign-key relationship to an Article table means a reaction can reference an `articleId` that no longer exists in Sanity] → Accepted per the proposal's explicit non-goal of an Article entity; the frontend is responsible for only requesting/rendering reactions for articles it knows exist.

## Migration Plan

1. Add the `ReactionType` enum and `Reaction` model to `prisma/schema.prisma` (plus the inverse `reactions Reaction[]` relation on `User`), and generate a new migration.
2. Deploy; no data backfill needed since this is a brand-new table.

Rollback: the new module and table are purely additive - no existing endpoint or table changes - so rollback is simply not routing traffic to the new endpoints and, if needed, a down-migration dropping the `Reaction` table and `ReactionType` enum.
