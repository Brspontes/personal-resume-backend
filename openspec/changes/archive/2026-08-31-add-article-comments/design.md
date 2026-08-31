## Context

Builds directly on `add-article-reactions` (the `OptionalAuthGuard`/`AuthGuard` cross-module sharing pattern, the "public read with per-item ownership flag" shape) and `add-linkedin-auth` (`AuthGuard`, `@CurrentUser()`, `AuthService`, `UsersService`). See proposal.md - Why/What Changes for motivation and scope. This document resolves the items the proposal explicitly deferred to design: the maximum content length, the exact shape of a deleted comment in the API response, the self-referencing Prisma schema, and how the two different route shapes (`/articles/:articleId/comments` vs `/comments/:commentId`) map onto NestJS controllers.

## Goals / Non-Goals

**Goals:**
- Fetch an article's full comment tree (top-level comments + their replies + both sets of authors) in one Prisma call, not N+1 queries.
- Make hard-deleting a comment that still has replies a database-level error, not just an application-level convention - soft delete is the only way replies survive, so the schema should make that the only viable path.
- Keep `comments/` fully decoupled from `reactions/` and `linkedin/`: it only ever sees an authenticated `userId`, reusing the exact guard-sharing pattern already established.

**Non-Goals:**
- Any Article persistence or Sanity synchronization (per proposal's Non-Goals) - `articleId` is an opaque string, same treatment as in `article-reactions`.
- More than one level of replies - enforced by rejecting a `parentCommentId` that itself has a non-null `parentCommentId`.
- Comment/reply pagination - the proposal only says to consider it "if the number of comments can grow significantly"; not needed for this change's scope, and would change the response shape if added later.

## Decisions

### Two controllers, one service
The proposal's routes don't share a single prefix: creation/listing are nested under the article (`/api/v1/articles/:articleId/comments`), but editing/deleting operate on a comment alone (`/api/v1/comments/:commentId`). Rather than force one NestJS controller to handle two unrelated base paths, use two thin controllers - `ArticleCommentsController` (`POST`/`GET` under `articles/:articleId/comments`) and `CommentsController` (`PATCH`/`DELETE` under `comments/:commentId`) - both delegating to the same `CommentsService`, which owns every business rule. This mirrors the existing controller/service split rather than inventing a new pattern.

### Maximum content length: 2000 characters
Long enough for a real comment or reply, short enough to keep payloads and the eventual rendered thread reasonable. Enforced via `class-validator`'s `@MaxLength(2000)` on the DTO, alongside a `@Matches(/\S/)` check so whitespace-only content fails the same way empty content does. Content is trimmed (leading/trailing whitespace) via a DTO `@Transform` before it ever reaches the service, so stored content is always trim-normalized.

### Soft delete: hide content in the response, keep the row and its original content in the database
`DELETE` sets `deletedAt`; it never removes the row or blanks the `content` column - the underlying content is preserved (for potential future moderation/audit, and because destroying it would be a one-way door a "soft" delete shouldn't take). `CommentsService`'s read path is the only place that hides it: when mapping a Prisma row to the response DTO, a non-null `deletedAt` makes the mapper emit `content: null` instead of the real text. Everything else (id, author, timestamps, replies, `isOwner`) stays populated, so the response tree stays structurally intact - only the proposal's explicit ask ("no longer expose its original content") is honored, nothing more.

### Self-referencing schema with a `Restrict` on the parent relation
```
model Comment {
  id              String    @id @default(cuid())
  articleId       String
  userId          String
  parentCommentId String?
  content         String
  deletedAt       DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  user    User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  parent  Comment?  @relation("CommentReplies", fields: [parentCommentId], references: [id], onDelete: Restrict)
  replies Comment[] @relation("CommentReplies")

  @@index([articleId])
  @@index([parentCommentId])
}
```
`onDelete: Restrict` on the self-relation means the database itself refuses to hard-delete a comment that still has reply rows pointing at it - matching the design's actual invariant (replies must always survive their parent) at the schema level, not just by convention in `CommentsService`. Since the API never issues a hard delete on a comment through any endpoint, this constraint should never actually fire in normal operation; it exists as a backstop.

### Reply validation lives entirely in `CommentsService.create`
Before inserting a reply, look up the referenced `parentCommentId` and reject (with a clear error, no insert) unless all of: it exists, `parent.articleId` matches the URL's `articleId`, `parent.parentCommentId` is `null` (it's a top-level comment, not itself a reply - this is what actually prevents nested replies-of-replies), and `parent.deletedAt` is `null`. All four checks happen in one service method so the rules the spec lists as separate scenarios stay easy to test independently.

### Loading the comment tree without N+1
`CommentsService.findByArticle(articleId, userId?)` issues a single Prisma call:
```
prisma.comment.findMany({
  where: { articleId, parentCommentId: null },
  orderBy: { createdAt: 'asc' },
  include: {
    user: { select: { id: true, name: true, avatarUrl: true } },
    replies: {
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    },
  },
})
```
Prisma resolves this as a small, fixed number of queries regardless of how many comments/replies exist (not one query per row), satisfying the proposal's "avoid N+1" goal without extra tooling. `isOwner` is computed afterward, per node, by comparing `userId` (from `OptionalAuthGuard`, possibly `undefined`) against each row's `userId` - no extra query needed.

### Author shape: `name` and `avatarUrl` only, no `linkedinUrl`
As noted in proposal.md - Impact, the `User` model has no `linkedinUrl` (LinkedIn's OIDC userinfo never returns one, decided in `add-linkedin-auth`). The author object returned for each comment/reply is `{ id, name, avatarUrl }`.

## Risks / Trade-offs

- [`Restrict` on the parent relation means a future "hard delete a user and cascade their data" feature can't simply cascade-delete a user's top-level comments that still have other users' replies attached] → Acceptable now (no user-deletion feature exists yet); that future change will need its own decision (e.g. soft-delete-first, or reassign orphaned replies) rather than a raw cascade.
- [Loading all replies for every top-level comment in one query means a very long-lived, heavily-replied article's comment payload isn't paginated] → Accepted per the Non-Goals; revisit only if real data shows this becoming a problem.
- [Content is never actually erased on deletion, only hidden in API responses] → Intentional (see Soft delete decision above); if a future requirement needs true erasure (e.g. right-to-be-forgotten), that is a separate, explicit change, not something to smuggle into this one.

## Migration Plan

1. Add the `Comment` model to `prisma/schema.prisma` (self-referencing `parentCommentId`, `user` relation) and generate a new migration.
2. Deploy; no data backfill needed since this is a brand-new table.

Rollback: the new module, controllers, and table are purely additive - no existing endpoint or table changes - so rollback is simply not routing traffic to the new endpoints and, if needed, a down-migration dropping the `Comment` table.
