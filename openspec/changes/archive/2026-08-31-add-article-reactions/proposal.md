## Why

Visitors can now authenticate via LinkedIn, but the backend has no way for them to interact with articles beyond reading. Article reactions (like/dislike) are the simplest form of that interaction, and the rules governing them (one reaction per user per article, only the owner can change it) must be enforced server-side so the frontend cannot be tricked or bypassed.

## What Changes

- Add a dedicated `Reactions` NestJS module, isolated from `auth`, `users`, and any future `comments` module.
- Add a `Reaction` Prisma model (`userId`, `articleId`, `type`, timestamps) with a unique constraint on `(userId, articleId)`.
- Support exactly two reaction types: `LIKE` and `DISLIKE`.
- `POST /api/v1/articles/:articleId/reactions` — authenticated; creates a reaction, switches an existing reaction to the opposite type, or (submitting the same type again) removes it, giving the frontend a simple toggle.
- `DELETE /api/v1/articles/:articleId/reactions` — authenticated; removes the caller's reaction if one exists, idempotently.
- `GET /api/v1/articles/:articleId/reactions` — public; returns like/dislike counts plus the caller's own reaction (`null` when unauthenticated or when authenticated but not yet reacted).
- Reuse the existing `AuthGuard`/`@CurrentUser()` for the two mutating endpoints; no new authentication logic.
- Reject any reaction type outside `LIKE`/`DISLIKE` via DTO validation, consistent with the existing global `ValidationPipe`.

## Capabilities

### New Capabilities
- `article-reactions`: Authenticated like/dislike reactions on externally-managed (Sanity) articles - one reaction per user per article, toggle-to-remove semantics, and public reaction counts.

### Modified Capabilities
None. This change only consumes the existing `session-authentication` capability's `AuthGuard`; it does not change that capability's requirements.

## Impact

- New module: `src/reactions/`.
- New Prisma model `Reaction` and accompanying migration, referencing the existing `User` model via `userId`.
- New API surface under `/api/v1/articles/:articleId/reactions` (`POST`, `DELETE`, `GET`).
- No impact on `auth`, `users`, `linkedin`, or `health` modules beyond `reactions` importing `AuthGuard`.
- No Sanity integration: the backend stores only the article identifier string, never article content.
- Out of scope: comments, comment replies, article management/Sanity sync, additional reaction types, reaction history/analytics - left to separate future OpenSpec changes per the proposal's Non-Goals.
