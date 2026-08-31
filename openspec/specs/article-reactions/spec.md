## Purpose

Lets an authenticated visitor express a like or dislike reaction on an article, with the one-reaction-per-user-per-article rule and reaction ownership enforced entirely by the backend, independent of the frontend.

## Requirements

### Requirement: Authentication Required For Mutations
The system SHALL require a valid authenticated session for both `POST /api/v1/articles/:articleId/reactions` and `DELETE /api/v1/articles/:articleId/reactions`, and SHALL reject unauthenticated requests to either without creating, changing, or removing any reaction.

#### Scenario: Unauthenticated request cannot create a reaction
- **WHEN** a client without a valid session cookie sends `POST /api/v1/articles/:articleId/reactions`
- **THEN** the system responds with HTTP 401 and does not create a reaction

#### Scenario: Unauthenticated request cannot remove a reaction
- **WHEN** a client without a valid session cookie sends `DELETE /api/v1/articles/:articleId/reactions`
- **THEN** the system responds with HTTP 401 and does not remove any reaction

### Requirement: Reaction Type Validation
The system SHALL accept only `LIKE` or `DISLIKE` as a reaction type on `POST /api/v1/articles/:articleId/reactions`, and SHALL reject any other value without creating or changing a reaction.

#### Scenario: Valid reaction type is accepted
- **WHEN** an authenticated client sends `POST /api/v1/articles/:articleId/reactions` with `{ "type": "LIKE" }` or `{ "type": "DISLIKE" }`
- **THEN** the system accepts the request and proceeds to apply the reaction

#### Scenario: Invalid reaction type is rejected
- **WHEN** an authenticated client sends `POST /api/v1/articles/:articleId/reactions` with a `type` other than `LIKE` or `DISLIKE`
- **THEN** the system responds with HTTP 400 and does not create or change any reaction

### Requirement: One Reaction Per User Per Article
The system SHALL allow at most one reaction per authenticated user per article, enforced at the data layer, even under concurrent requests for the same user and article.

#### Scenario: First reaction on an article is created
- **WHEN** an authenticated user with no existing reaction on an article submits a valid reaction type
- **THEN** the system creates exactly one reaction record for that user and article

#### Scenario: Concurrent first reactions do not create duplicates
- **WHEN** two requests to create a reaction for the same user and the same article are processed concurrently
- **THEN** the system ends up with exactly one reaction record for that user and article

### Requirement: Changing A Reaction
When an authenticated user already has a reaction on an article and submits a different reaction type, the system SHALL update the existing reaction to the newly submitted type rather than creating a second record.

#### Scenario: Like is changed to dislike
- **WHEN** an authenticated user whose current reaction on an article is `LIKE` submits `{ "type": "DISLIKE" }`
- **THEN** the system updates the existing reaction to `DISLIKE` without creating a new record

#### Scenario: Dislike is changed to like
- **WHEN** an authenticated user whose current reaction on an article is `DISLIKE` submits `{ "type": "LIKE" }`
- **THEN** the system updates the existing reaction to `LIKE` without creating a new record

### Requirement: Resubmitting The Same Reaction Removes It
When an authenticated user submits the same reaction type they already have on an article, the system SHALL remove the existing reaction, providing toggle behavior.

#### Scenario: Submitting the current reaction again clears it
- **WHEN** an authenticated user whose current reaction on an article is `LIKE` submits `{ "type": "LIKE" }` again
- **THEN** the system removes the existing reaction, leaving the user with no reaction on that article

### Requirement: Removing A Reaction
The system SHALL allow an authenticated user to remove their own reaction on an article via `DELETE /api/v1/articles/:articleId/reactions`, and SHALL treat removal as idempotent when no reaction exists.

#### Scenario: Existing reaction is removed
- **WHEN** an authenticated user with an existing reaction on an article sends `DELETE /api/v1/articles/:articleId/reactions`
- **THEN** the system removes the reaction

#### Scenario: Removing a nonexistent reaction is idempotent
- **WHEN** an authenticated user with no existing reaction on an article sends `DELETE /api/v1/articles/:articleId/reactions`
- **THEN** the system responds successfully without error and no reaction exists afterward

### Requirement: Users Can Only Modify Their Own Reaction
The system SHALL determine the acting user's identity from the authenticated session, and SHALL NOT accept a user identifier supplied by the client for create, change, or remove operations.

#### Scenario: Client-supplied user identifier is ignored
- **WHEN** an authenticated user sends `POST /api/v1/articles/:articleId/reactions` with a request body containing a user identifier different from their own
- **THEN** the system applies the reaction to the authenticated user's own identity, not the identifier supplied in the request body

### Requirement: Public Reaction Retrieval
The system SHALL expose `GET /api/v1/articles/:articleId/reactions` as a public endpoint returning the total like count, the total dislike count, and the requesting user's own current reaction when authenticated.

#### Scenario: Authenticated user retrieves counts and their own reaction
- **WHEN** an authenticated user who has reacted `LIKE` to an article sends `GET /api/v1/articles/:articleId/reactions`
- **THEN** the system responds with HTTP 200 including the article's like count, dislike count, and `"userReaction": "LIKE"`

#### Scenario: Unauthenticated client retrieves counts without a personal reaction
- **WHEN** a client without a valid session cookie sends `GET /api/v1/articles/:articleId/reactions`
- **THEN** the system responds with HTTP 200 including the article's like count and dislike count, and `"userReaction": null`

#### Scenario: Authenticated user with no reaction sees a null reaction
- **WHEN** an authenticated user who has not reacted to an article sends `GET /api/v1/articles/:articleId/reactions`
- **THEN** the system responds with HTTP 200 including the article's like count and dislike count, and `"userReaction": null`
