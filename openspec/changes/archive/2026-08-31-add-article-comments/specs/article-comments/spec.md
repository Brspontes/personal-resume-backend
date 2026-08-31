## Purpose

Lets an authenticated visitor comment on an article and reply to existing comments, with ownership, one level of reply nesting, and soft deletion that preserves discussion structure all enforced entirely by the backend, independent of the frontend.

## ADDED Requirements

### Requirement: Authentication Required For Mutations
The system SHALL require a valid authenticated session for creating a comment or reply, editing a comment or reply, and deleting a comment or reply, and SHALL reject unauthenticated requests to any of these without creating, changing, or removing anything.

#### Scenario: Unauthenticated request cannot create a comment
- **WHEN** a client without a valid session cookie sends `POST /api/v1/articles/:articleId/comments`
- **THEN** the system responds with HTTP 401 and does not create a comment

#### Scenario: Unauthenticated request cannot edit a comment
- **WHEN** a client without a valid session cookie sends `PATCH /api/v1/comments/:commentId`
- **THEN** the system responds with HTTP 401 and does not modify the comment

#### Scenario: Unauthenticated request cannot delete a comment
- **WHEN** a client without a valid session cookie sends `DELETE /api/v1/comments/:commentId`
- **THEN** the system responds with HTTP 401 and does not delete the comment

### Requirement: Content Validation
The system SHALL require comment and reply content to be non-empty after trimming whitespace, and SHALL enforce a maximum length, rejecting requests that violate either rule without creating or changing a comment.

#### Scenario: Empty content is rejected
- **WHEN** an authenticated client sends `POST /api/v1/articles/:articleId/comments` with `{ "content": "" }`
- **THEN** the system responds with HTTP 400 and does not create a comment

#### Scenario: Whitespace-only content is rejected
- **WHEN** an authenticated client sends `POST /api/v1/articles/:articleId/comments` with content consisting only of whitespace
- **THEN** the system responds with HTTP 400 and does not create a comment

#### Scenario: Content exceeding the maximum length is rejected
- **WHEN** an authenticated client sends `POST /api/v1/articles/:articleId/comments` with content longer than the system's maximum allowed length
- **THEN** the system responds with HTTP 400 and does not create a comment

### Requirement: Creating A Top-Level Comment
The system SHALL allow an authenticated user to create a top-level comment on an article by sending `POST /api/v1/articles/:articleId/comments` without a `parentCommentId`, associating the comment with the authenticated user and the given article.

#### Scenario: Authenticated user creates a top-level comment
- **WHEN** an authenticated user sends `POST /api/v1/articles/:articleId/comments` with valid content and no `parentCommentId`
- **THEN** the system creates a new top-level comment associated with that user and that article

### Requirement: Creating A Reply
The system SHALL allow an authenticated user to reply to an existing top-level comment by sending `POST /api/v1/articles/:articleId/comments` with a `parentCommentId`, and SHALL reject the request if the parent comment does not exist, does not belong to the given article, is itself a reply, or is deleted.

#### Scenario: Authenticated user replies to a top-level comment
- **WHEN** an authenticated user sends `POST /api/v1/articles/:articleId/comments` with valid content and a `parentCommentId` referencing an existing top-level comment on that article
- **THEN** the system creates a new reply associated with that user, that article, and that parent comment

#### Scenario: Reply is rejected when the parent comment does not exist
- **WHEN** an authenticated user sends `POST /api/v1/articles/:articleId/comments` with a `parentCommentId` that does not reference any existing comment
- **THEN** the system responds with an appropriate error and does not create a reply

#### Scenario: Reply is rejected when the parent belongs to a different article
- **WHEN** an authenticated user sends `POST /api/v1/articles/:articleId/comments` with a `parentCommentId` referencing a comment that belongs to a different article
- **THEN** the system responds with an appropriate error and does not create a reply

#### Scenario: Reply to a reply is rejected
- **WHEN** an authenticated user sends `POST /api/v1/articles/:articleId/comments` with a `parentCommentId` referencing a comment that is itself a reply
- **THEN** the system responds with an appropriate error and does not create a reply

#### Scenario: Reply to a deleted comment is rejected
- **WHEN** an authenticated user sends `POST /api/v1/articles/:articleId/comments` with a `parentCommentId` referencing a comment that has been deleted
- **THEN** the system responds with an appropriate error and does not create a reply

### Requirement: Editing Own Comment Or Reply
The system SHALL allow an authenticated user to edit the content of their own, non-deleted comment or reply via `PATCH /api/v1/comments/:commentId`, and SHALL reject the request if the comment does not exist, does not belong to the authenticated user, or has been deleted.

#### Scenario: Owner edits their own comment
- **WHEN** an authenticated user sends `PATCH /api/v1/comments/:commentId` with valid new content for a non-deleted comment they own
- **THEN** the system updates the comment's content

#### Scenario: A user cannot edit another user's comment
- **WHEN** an authenticated user sends `PATCH /api/v1/comments/:commentId` for a comment owned by a different user
- **THEN** the system responds with an appropriate authorization error and does not modify the comment

#### Scenario: A deleted comment cannot be edited
- **WHEN** an authenticated user sends `PATCH /api/v1/comments/:commentId` for a comment they own that has already been deleted
- **THEN** the system responds with an appropriate error and does not modify the comment

### Requirement: Deleting Own Comment Or Reply
The system SHALL allow an authenticated user to soft-delete their own comment or reply via `DELETE /api/v1/comments/:commentId`, preserving any existing replies, and SHALL reject the request if the comment does not exist, does not belong to the authenticated user, or has already been deleted.

#### Scenario: Owner deletes their own comment
- **WHEN** an authenticated user sends `DELETE /api/v1/comments/:commentId` for a comment they own
- **THEN** the system marks the comment as deleted, and any existing replies to it remain retrievable

#### Scenario: A user cannot delete another user's comment
- **WHEN** an authenticated user sends `DELETE /api/v1/comments/:commentId` for a comment owned by a different user
- **THEN** the system responds with an appropriate authorization error and does not delete the comment

#### Scenario: A comment cannot be deleted twice
- **WHEN** an authenticated user sends `DELETE /api/v1/comments/:commentId` for a comment they own that has already been deleted
- **THEN** the system responds with an appropriate error and the comment's deletion state is unchanged

### Requirement: Deleted Comment Content Is Hidden
Once a comment is deleted, the system SHALL NOT expose its original content to any consumer of `GET /api/v1/articles/:articleId/comments`, while still returning the comment as a node in the discussion tree so its replies remain correctly nested.

#### Scenario: Deleted comment content is not exposed
- **WHEN** a client retrieves an article's comments and one of the top-level comments has been deleted
- **THEN** the system returns that comment's node without its original content, while still including its existing replies

### Requirement: Public Comment Retrieval
The system SHALL expose `GET /api/v1/articles/:articleId/comments` as a public endpoint returning an article's top-level comments with their replies nested underneath, including author information, timestamps, and an `isOwner` flag for each comment and reply.

#### Scenario: Comments are retrieved with nested replies
- **WHEN** a client sends `GET /api/v1/articles/:articleId/comments` for an article with top-level comments and replies
- **THEN** the system responds with HTTP 200 listing the top-level comments, each including its replies nested underneath

#### Scenario: Author information is included
- **WHEN** a client retrieves an article's comments
- **THEN** each comment and reply includes its author's name and avatar, and excludes any authentication secrets or tokens

### Requirement: Ownership Indicator Is Not An Authorization Mechanism
The system SHALL compute an `isOwner` value for each comment and reply returned by `GET /api/v1/articles/:articleId/comments`, reflecting whether the requester is authenticated as that comment's author, and SHALL independently enforce ownership on `PATCH`/`DELETE` regardless of any `isOwner` value a client may have previously observed.

#### Scenario: isOwner is true for the authenticated author's own comment
- **WHEN** an authenticated user who authored a comment retrieves that article's comments
- **THEN** that comment's `isOwner` is `true`

#### Scenario: isOwner is false for another user's comment
- **WHEN** an authenticated user retrieves an article's comments that include a comment authored by a different user
- **THEN** that comment's `isOwner` is `false`

#### Scenario: isOwner is false for unauthenticated requests
- **WHEN** a client without a valid session cookie retrieves an article's comments
- **THEN** every comment's `isOwner` is `false`
