## Purpose

Provides the provider-agnostic authenticated-session mechanism the rest of the backend relies on: how a session is carried on the request, how it is queried and cleared, and how endpoints declare that they require it, all without callers needing to know a session originated from LinkedIn.

## Requirements

### Requirement: Session Cookie
Upon successful login, the system SHALL establish the application session as a signed token stored in an httpOnly, secure cookie scoped to the backend's domain. The system SHALL NOT expose the session token to frontend JavaScript.

#### Scenario: Session cookie set on login
- **WHEN** an application session is established for an authenticated visitor
- **THEN** the system sets an httpOnly, secure cookie containing the session token on the response

#### Scenario: Session cookie is not readable by client-side script
- **WHEN** the session cookie is inspected by client-side JavaScript in a standards-compliant browser
- **THEN** the cookie value is not accessible, because it is marked httpOnly

### Requirement: Current User Endpoint
The system SHALL expose `GET /api/v1/auth/me` that returns the currently authenticated user's non-sensitive profile information when a valid session is present, and responds with HTTP 401 when it is not.

#### Scenario: Authenticated request returns the current user
- **WHEN** a client sends `GET /api/v1/auth/me` with a valid session cookie
- **THEN** the system responds with HTTP 200 and the authenticated user's profile information, excluding any authentication secrets or tokens

#### Scenario: Unauthenticated request is rejected
- **WHEN** a client sends `GET /api/v1/auth/me` without a valid session cookie
- **THEN** the system responds with HTTP 401 and does not return any user information

### Requirement: Logout
The system SHALL expose `POST /api/v1/auth/logout` that invalidates the caller's application session, without requiring direct interaction with LinkedIn.

#### Scenario: Logout clears the session
- **WHEN** a client with a valid session cookie sends `POST /api/v1/auth/logout`
- **THEN** the system invalidates the session, and a subsequent request to `GET /api/v1/auth/me` using the same cookie responds with HTTP 401

### Requirement: Reusable Authentication Guard
The system SHALL provide a reusable authentication guard that any endpoint can apply to require a valid session. Endpoints protected by the guard SHALL have access to the authenticated user's identity without implementing their own session validation.

#### Scenario: Guarded endpoint allows an authenticated request
- **WHEN** a client with a valid session cookie requests an endpoint protected by the authentication guard
- **THEN** the request proceeds to the endpoint's business logic with the authenticated user available to it

#### Scenario: Guarded endpoint rejects an unauthenticated request
- **WHEN** a client without a valid session cookie requests an endpoint protected by the authentication guard
- **THEN** the system responds with HTTP 401 and the endpoint's business logic is not executed

#### Scenario: Guarded endpoint rejects an invalid or expired session
- **WHEN** a client presents a session cookie that is malformed, has an invalid signature, or has expired
- **THEN** the system responds with HTTP 401 and the endpoint's business logic is not executed
