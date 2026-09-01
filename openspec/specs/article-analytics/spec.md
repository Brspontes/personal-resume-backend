## Purpose

Records anonymous and optionally-authenticated article consumption events (views, reading progress, and completed reading sessions) against an opaque, frontend-supplied article identifier, without requiring authentication, so article engagement can be measured for visitors who never log in, react, or comment.

## Requirements

### Requirement: Analytics Endpoint Requires No Authentication
The system SHALL expose `POST /api/v1/analytics/events` as a public endpoint that accepts a valid analytics event regardless of whether the request carries a valid authenticated session.

#### Scenario: Unauthenticated request is accepted
- **WHEN** a client without a session cookie sends `POST /api/v1/analytics/events` with a valid `ARTICLE_VIEW` payload
- **THEN** the system accepts and processes the event without rejecting it for lack of authentication

#### Scenario: Authenticated request is also accepted
- **WHEN** a client with a valid session cookie sends `POST /api/v1/analytics/events` with a valid payload
- **THEN** the system accepts and processes the event the same way as an unauthenticated request, in addition to associating it with the authenticated user

### Requirement: Event Type Validation
The system SHALL accept only `ARTICLE_VIEW`, `ARTICLE_PROGRESS`, or `ARTICLE_READ` as the `event` field, and SHALL reject any other value without persisting an event.

#### Scenario: Supported event type is accepted
- **WHEN** a client sends a payload with `event` equal to `ARTICLE_VIEW`, `ARTICLE_PROGRESS`, or `ARTICLE_READ` and otherwise-valid fields for that type
- **THEN** the system accepts the request and applies the corresponding event handling rules

#### Scenario: Unsupported event type is rejected
- **WHEN** a client sends a payload with an `event` value other than `ARTICLE_VIEW`, `ARTICLE_PROGRESS`, or `ARTICLE_READ`
- **THEN** the system responds with HTTP 400 and does not persist an event

### Requirement: Article And Session Identifier Validation
The system SHALL require a non-empty `articleId` and a non-empty `sessionId` on every analytics event, and SHALL reject a request missing either without persisting an event.

#### Scenario: Missing article identifier is rejected
- **WHEN** a client sends an analytics event without an `articleId`
- **THEN** the system responds with HTTP 400 and does not persist an event

#### Scenario: Missing session identifier is rejected
- **WHEN** a client sends an analytics event without a `sessionId`
- **THEN** the system responds with HTTP 400 and does not persist an event

#### Scenario: Malformed session identifier is rejected
- **WHEN** a client sends a `sessionId` that does not conform to the expected identifier format (for example, exceeding the maximum accepted length)
- **THEN** the system responds with HTTP 400 and does not persist an event

### Requirement: Article View Recording
The system SHALL record an `ARTICLE_VIEW` event associating the given `articleId` and `sessionId`, subject to view deduplication.

#### Scenario: First view for a session and article is recorded
- **WHEN** a client sends a valid `ARTICLE_VIEW` event for an `articleId`/`sessionId` pair with no prior recorded view within the deduplication window
- **THEN** the system persists a new `ARTICLE_VIEW` event

### Requirement: View Deduplication Window
The system SHALL treat repeated `ARTICLE_VIEW` events for the same `articleId` and `sessionId` within a configurable deduplication window as a single view, and SHALL NOT reject the request because of deduplication.

#### Scenario: Duplicate view within the window is not persisted again
- **WHEN** a client sends a second `ARTICLE_VIEW` event for the same `articleId` and `sessionId` before the configured deduplication window has elapsed since the last recorded view
- **THEN** the system responds successfully but does not persist a second `ARTICLE_VIEW` event

#### Scenario: View after the window elapses is recorded again
- **WHEN** a client sends an `ARTICLE_VIEW` event for the same `articleId` and `sessionId` after the configured deduplication window has elapsed since the last recorded view
- **THEN** the system persists a new `ARTICLE_VIEW` event

### Requirement: Reading Progress Recording
The system SHALL accept an `ARTICLE_PROGRESS` event only when `progress` is one of the supported milestone values (`25`, `50`, `75`, `90`), and SHALL reject any other value without persisting an event.

#### Scenario: Supported milestone is accepted
- **WHEN** a client sends an `ARTICLE_PROGRESS` event with `progress` equal to `25`, `50`, `75`, or `90`
- **THEN** the system accepts the request and applies progress deduplication before persisting

#### Scenario: Unsupported progress value is rejected
- **WHEN** a client sends an `ARTICLE_PROGRESS` event with a `progress` value outside the supported milestone set
- **THEN** the system responds with HTTP 400 and does not persist an event

### Requirement: Progress Deduplication
The system SHALL NOT persist more than one `ARTICLE_PROGRESS` event for the same `articleId`, `sessionId`, and milestone value.

#### Scenario: Repeated identical milestone is ignored
- **WHEN** a client sends an `ARTICLE_PROGRESS` event with a milestone already recorded for the same `articleId` and `sessionId`
- **THEN** the system responds successfully but does not persist a duplicate event

#### Scenario: Different milestone is accepted
- **WHEN** a client sends an `ARTICLE_PROGRESS` event with a milestone not yet recorded for the same `articleId` and `sessionId`, following a previously recorded lower milestone
- **THEN** the system persists the new milestone event

### Requirement: Reading Session Completion Recording
The system SHALL accept an `ARTICLE_READ` event containing a non-negative `duration` (active reading time in seconds) and a `maxProgress` value, and SHALL reject the event when either value is invalid.

#### Scenario: Valid read event is accepted
- **WHEN** a client sends an `ARTICLE_READ` event with a non-negative `duration` and a valid `maxProgress` within accepted bounds
- **THEN** the system persists the `ARTICLE_READ` event with the supplied `duration` and `maxProgress`

#### Scenario: Negative duration is rejected
- **WHEN** a client sends an `ARTICLE_READ` event with a negative `duration`
- **THEN** the system responds with HTTP 400 and does not persist an event

#### Scenario: Excessive duration is rejected
- **WHEN** a client sends an `ARTICLE_READ` event with a `duration` exceeding the system's configured upper bound
- **THEN** the system responds with HTTP 400 and does not persist an event

#### Scenario: Invalid max progress is rejected
- **WHEN** a client sends an `ARTICLE_READ` event with a `maxProgress` outside the valid `0`-`100` range
- **THEN** the system responds with HTTP 400 and does not persist an event

### Requirement: Authenticated User Association Is Server-Derived
When a request carries a valid authenticated session, the system SHALL associate the resulting analytics event with that session's user identity, and SHALL NOT accept a client-supplied user identifier as authoritative for that association.

#### Scenario: Authenticated event is linked to the session user
- **WHEN** a client with a valid session cookie sends a valid analytics event
- **THEN** the system persists the event with `userId` set to the authenticated user's identifier, derived from the session, not from the request body

#### Scenario: Client-supplied user identifier is ignored
- **WHEN** a client sends an analytics event whose body includes a user identifier field
- **THEN** the system disregards the client-supplied value and determines the associated user, if any, solely from the authenticated session

#### Scenario: Anonymous event has no user association
- **WHEN** a client without a valid session sends a valid analytics event
- **THEN** the system persists the event with `userId` set to null

### Requirement: Numerical And Payload Bounds
The system SHALL apply reasonable upper bounds to numerical fields and overall payload size, and SHALL reject requests that exceed those bounds without persisting an event.

#### Scenario: Oversized payload is rejected
- **WHEN** a client sends an analytics request whose body exceeds the system's configured maximum payload size
- **THEN** the system responds with an HTTP 4xx error and does not persist an event

#### Scenario: Out-of-range numerical value is rejected
- **WHEN** a client sends an analytics event containing a numerical field (such as `duration` or `progress`) outside its defined valid range
- **THEN** the system responds with HTTP 400 and does not persist an event

### Requirement: Analytics Endpoint Does Not Expose Authentication Information
The system SHALL NOT include session tokens, authentication credentials, or other authentication-mechanism details in the analytics endpoint's response.

#### Scenario: Response omits authentication details
- **WHEN** a client, authenticated or not, sends a valid analytics event
- **THEN** the system's response contains no session token, credential, or other authentication-mechanism detail
