## Purpose

Defines the cross-cutting REST API behavior every endpoint in the backend must honor: versioned routing, request validation, cross-origin access control, and consistent error responses, independent of any specific business feature.

## Requirements

### Requirement: API Versioning
All public API endpoints SHALL be exposed under the `/api/v1` prefix.

#### Scenario: Endpoint reachable under versioned prefix
- **WHEN** a client sends a request to `/api/v1/<resource>`
- **THEN** the system routes the request to the corresponding handler

#### Scenario: Unversioned path is not routed
- **WHEN** a client sends a request to a path without the `/api/v1` prefix that only exists under `/api/v1`
- **THEN** the system responds with HTTP 404

### Requirement: Global Request Validation
The system SHALL validate all incoming request payloads against their defined DTO before executing business logic, and SHALL reject invalid payloads without invoking the underlying handler logic.

#### Scenario: Invalid payload is rejected
- **WHEN** a client sends a request whose body fails DTO validation (missing required field, wrong type, or disallowed property)
- **THEN** the system responds with HTTP 400 and a response body describing the validation error, without executing the endpoint's business logic

#### Scenario: Valid payload is accepted
- **WHEN** a client sends a request whose body satisfies the DTO validation rules
- **THEN** the system proceeds to execute the endpoint's business logic

### Requirement: Cross-Origin Access Control
The system SHALL restrict cross-origin requests to the origin configured via the `FRONTEND_URL` environment variable, and SHALL NOT allow unrestricted wildcard origins in production. The system SHALL support credentialed cross-origin requests (cookies) from that configured origin, since authenticated sessions are carried via cookie.

#### Scenario: Configured frontend origin is allowed
- **WHEN** a browser sends a cross-origin request from the origin configured in `FRONTEND_URL`
- **THEN** the system includes CORS headers permitting that origin

#### Scenario: Unconfigured origin is rejected
- **WHEN** a browser sends a cross-origin request from an origin other than the one configured in `FRONTEND_URL`
- **THEN** the system does not include CORS headers permitting that origin

#### Scenario: Credentialed request from the configured origin is allowed
- **WHEN** a browser sends a cross-origin request with credentials (cookies) included from the origin configured in `FRONTEND_URL`
- **THEN** the system includes CORS headers that permit the browser to expose the response to that credentialed request

### Requirement: Centralized Error Handling
The system SHALL handle all unhandled and expected errors through a centralized mechanism that returns a consistent HTTP error response and SHALL NOT expose stack traces, database credentials, SQL queries, or other internal implementation details in any API response.

#### Scenario: Unexpected server error is sanitized
- **WHEN** an unhandled exception occurs while processing a request
- **THEN** the system responds with a generic HTTP 5xx error body that contains no stack trace or internal implementation details

#### Scenario: Client error follows consistent format
- **WHEN** a request fails due to client input (validation error, not found, etc.)
- **THEN** the system responds with an HTTP 4xx status code and an error body following the same consistent structure used across all endpoints
