## 1. Database & Schema

- [x] 1.1 Add a `Comment` model to `prisma/schema.prisma`: `id`, `articleId`, `userId`, `parentCommentId` (nullable, self-referencing via a `"CommentReplies"` relation with `onDelete: Restrict`), `content`, `deletedAt`, `createdAt`, `updatedAt`, plus `@@index([articleId])` and `@@index([parentCommentId])`.
- [x] 1.2 Add the `user` relation to `User` (`onDelete: Cascade`), consistent with the existing `Reaction` relation.
- [x] 1.3 Generate and apply the Prisma migration against the local dev database.

## 2. Comments Module - Core

- [x] 2.1 Create `src/comments/comments.module.ts`, importing `AuthModule` and `UsersModule` (same cross-module guard-sharing pattern as `ReactionsModule`).
- [x] 2.2 Create `src/comments/dto/create-comment.dto.ts`: `content` (`@Matches(/\S/)`, `@MaxLength(2000)`, trimmed via `@Transform`), optional `parentCommentId` (`@IsOptional()`, `@IsString()`).
- [x] 2.3 Create `src/comments/dto/update-comment.dto.ts`: `content` with the same validation as creation.
- [x] 2.4 Create `src/comments/dto/comment-author.dto.ts` and `src/comments/dto/comment.dto.ts` describing the response shape: `{ id, content: string | null, author: { id, name, avatarUrl }, isOwner, createdAt, updatedAt, deletedAt, replies: CommentDto[] }`.
- [x] 2.5 Implement `CommentsService.createComment(userId, articleId, dto)`: validates a supplied `parentCommentId` (parent exists, belongs to the same article, is not itself a reply, is not deleted) before creating; creates a top-level comment when `parentCommentId` is absent.
- [x] 2.6 Implement `CommentsService.updateComment(userId, commentId, dto)`: rejects if the comment does not exist, is not owned by `userId`, or is deleted; otherwise updates `content`.
- [x] 2.7 Implement `CommentsService.deleteComment(userId, commentId)`: rejects if the comment does not exist, is not owned by `userId`, or is already deleted; otherwise sets `deletedAt`.
- [x] 2.8 Implement `CommentsService.findByArticle(articleId, userId?)`: fetches top-level comments with nested replies and authors in a single Prisma call (per design.md), maps deleted comments to `content: null`, and computes `isOwner` per node from `userId`.

## 3. Comments Module - Endpoints

- [x] 3.1 Implement `ArticleCommentsController` (`articles/:articleId/comments`): `POST` guarded by `AuthGuard` (creates a comment or reply), `GET` guarded by `OptionalAuthGuard` (returns the comment tree via `findByArticle`).
- [x] 3.2 Implement `CommentsController` (`comments/:commentId`): `PATCH` guarded by `AuthGuard` (edits via `updateComment`), `DELETE` guarded by `AuthGuard` (removes via `deleteComment`).
- [x] 3.3 Ensure the acting user's id is taken only from `@CurrentUser()` for `POST`, `PATCH`, and `DELETE` - never from the request body.
- [x] 3.4 Register `CommentsModule` in `AppModule`.

## 4. Swagger Documentation

- [x] 4.1 Add Swagger decorators for all four endpoints (`@ApiTags`, `@ApiOperation`, `@ApiParam` for `articleId`/`commentId`, `@ApiResponse` including 400/401/403/404 cases as applicable), and document `CommentDto`/`CreateCommentDto`/`UpdateCommentDto` for the generated schema.

## 5. Testing

- [x] 5.1 Unit test `CommentsService.createComment`: creates a top-level comment; creates a reply to a valid top-level comment; rejects a reply whose parent does not exist, belongs to a different article, is itself a reply, or is deleted.
- [x] 5.2 Unit test `CommentsService.updateComment`: updates content for the owner; rejects when the comment does not exist, is owned by another user, or is deleted.
- [x] 5.3 Unit test `CommentsService.deleteComment`: soft-deletes for the owner; rejects when the comment does not exist, is owned by another user, or is already deleted.
- [x] 5.4 Unit test `CommentsService.findByArticle`: returns nested replies under their parent; hides content (`content: null`) for a deleted comment while still returning its replies; computes `isOwner` correctly for the owner, another user, and an unauthenticated (`userId` undefined) caller.
- [x] 5.5 E2E test for `POST /api/v1/articles/:articleId/comments`: 401 without a session cookie; creates a top-level comment for an authenticated request; creates a reply to a valid parent; rejects empty/whitespace-only content with 400; rejects content over the maximum length with 400; rejects a reply to a reply; rejects a reply whose parent belongs to a different article.
- [x] 5.6 E2E test for `PATCH /api/v1/comments/:commentId`: 401 without a session cookie; updates content for the owner; 403/appropriate error for a non-owner; appropriate error when the comment is deleted.
- [x] 5.7 E2E test for `DELETE /api/v1/comments/:commentId`: 401 without a session cookie; soft-deletes for the owner; 403/appropriate error for a non-owner; appropriate error when already deleted; a deleted comment's existing replies remain retrievable afterward.
- [x] 5.8 E2E test for `GET /api/v1/articles/:articleId/comments`: returns top-level comments with nested replies and author info for both authenticated and unauthenticated requests; `isOwner` is `true` only for the authenticated author's own comments/replies and `false` otherwise (including for all comments when unauthenticated); a deleted comment's content is `null` while its replies remain visible.
- [x] 5.9 Run the full test suite via the project's standard test commands and confirm it passes.

## 6. Build & Verification

- [x] 6.1 Run lint and fix any violations.
- [x] 6.2 Run the production build and confirm it completes without errors.
- [x] 6.3 Manually verify against the local dev database with a real authenticated session: create a comment, reply to it, edit both, delete the top-level comment and confirm its reply remains visible with the parent's content hidden, and confirm `GET` reflects each state correctly.
