## Why

The portfolio already supports LinkedIn authentication and article reactions. The next interaction visitors need is discussion: authenticated users commenting on articles and replying to each other, with the backend as the sole authority on who owns what and who may change it.

## What Changes

- Add a dedicated `Comments` NestJS module, independent from `auth`, `users`, `reactions`, and Sanity article management.
- Add a `Comment` Prisma model: `articleId`, `userId`, `parentCommentId` (nullable, self-referencing), `content`, `deletedAt`, timestamps.
- `POST /api/v1/articles/:articleId/comments` — authenticated; creates a top-level comment, or (with `parentCommentId`) a reply to an existing top-level comment on the same article.
- `PATCH /api/v1/comments/:commentId` — authenticated; edits the caller's own, non-deleted comment or reply.
- `DELETE /api/v1/comments/:commentId` — authenticated; soft-deletes the caller's own comment or reply (sets `deletedAt`), preserving any existing replies.
- `GET /api/v1/articles/:articleId/comments` — public; returns top-level comments with their replies nested, author info, and an `isOwner` flag per comment/reply computed from the caller's session (never a substitute for server-side authorization).
- Exactly one level of replies: a reply can never itself be the parent of another reply.
- Reuse the existing `AuthGuard` (mutations) and `OptionalAuthGuard` (public read with optional identity) from `add-linkedin-auth`/`add-article-reactions`; no new authentication logic.
- Reject content that is missing, empty, or whitespace-only, and enforce a maximum length via DTO validation.

## Capabilities

### New Capabilities
- `article-comments`: Authenticated comments and single-level replies on externally-managed (Sanity) articles - ownership-enforced edit/delete, soft deletion that preserves reply structure, and public reads with per-item `isOwner` information.

### Modified Capabilities
None. This change only consumes the existing `session-authentication` capability's guards; it does not change their requirements. It does not touch `article-reactions`.

## Impact

- New module: `src/comments/`.
- New Prisma model `Comment` (self-referencing via `parentCommentId`) and accompanying migration, referencing the existing `User` model via `userId`.
- New API surface: `/api/v1/articles/:articleId/comments` (`POST`, `GET`) and `/api/v1/comments/:commentId` (`PATCH`, `DELETE`).
- No impact on `auth`, `users`, `linkedin`, `reactions`, or `health` modules beyond `comments` importing the existing guards.
- No Sanity integration: the backend stores only the article identifier string, never article content.
- The proposal's example author object includes `linkedinUrl`; the application's `User` model has no such field (LinkedIn's OpenID Connect userinfo endpoint, used since `add-linkedin-auth`, never returns a profile URL - documented in that change's design.md). Author responses will expose `name` and `avatarUrl` only; `linkedinUrl` is dropped, consistent with that earlier decision.
- Out of scope: comment moderation, reporting, notifications, comment reactions, nested replies beyond one level, rich text/Markdown rendering, article management/Sanity sync - left to separate future OpenSpec changes per the proposal's Non-Goals.
